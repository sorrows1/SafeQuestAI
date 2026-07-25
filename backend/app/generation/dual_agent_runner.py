"""Offline, category-aware transcript generation for admin review only."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Iterable

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.engine.prompt_builder import PromptBuilder
from app.engine.scenario_loader import ScenarioLoader
from app.generation.scorer import TranscriptScore, propose_tags, score_transcript
from app.llm.llm_service import LLMService
from app.models.content_schemas import ConstraintDefinition
from app.models.orm import ConversationMessage, ConversationSession
from app.models.schemas import GenerationMode, ScenarioCategory, ScenarioDefinition

_IMAGE_REQUEST_CONSTRAINT = ConstraintDefinition(
    id="image_request_no_visual_descriptions",
    description="Image-request examples must not describe image/photo content or physical appearance.",
    forbidden_topics=["image or photo descriptions", "physical descriptions", "body or appearance details"],
)
_VISUAL_PATTERN = re.compile(
    r"\b(?:photo|picture|selfie|image|nude|naked|body|bodies|face|looks?|appearance|what\s+you\s+look\s+like)\b",
    re.IGNORECASE,
)


class GenerationSafetyError(RuntimeError):
    """A generated turn exceeded a hard generation-time safety boundary."""


@dataclass(frozen=True)
class SafetyCheckResult:
    safe: bool
    reason: str | None = None


def check_image_request_content(content: str) -> SafetyCheckResult:
    """Reject visual/physical-description content before it reaches persistence."""
    if _VISUAL_PATTERN.search(content):
        return SafetyCheckResult(False, "image-request output contains visual or physical-description content")
    return SafetyCheckResult(True)


def paced_message_delay(pace: str, content: str) -> float:
    """Return bounded, deterministic server-side live-mode pacing for one bubble."""
    base = {"quick": 0.40, "normal": 0.75, "soon": 0.75,
            "after_a_pause": 1.55, "much_later": 2.75}.get(pace, 0.75)
    jitter = ((sum(map(ord, content)) % 17) - 8) / 100
    return max(0.40, min(4.0, base + min(len(content) * 0.012, 1.1) + jitter))


class DualAgentRunner:
    """Generate reviewed-later transcripts; it is never used by player routes."""

    def __init__(
        self,
        llm: LLMService,
        loader: ScenarioLoader | None = None,
        *,
        max_rounds: int = 3,
        max_safety_retries: int = 3,
    ) -> None:
        self._llm = llm
        self._loader = loader
        self._max_rounds = max_rounds
        self._max_safety_retries = max_safety_retries

    async def generate(
        self,
        scenario: ScenarioDefinition,
        db: Session,
        *,
        difficulty: str | None = None,
        is_negative_example: bool = False,
        max_rounds: int | None = None,
        session: ConversationSession | None = None,
    ) -> ConversationSession:
        """Persist an offline generated session after all per-message checks pass."""
        if scenario.generation_mode is GenerationMode.SINGLE_PASS:
            return await self._generate_single_pass(scenario, db, difficulty, is_negative_example, session)
        return await self._generate_dual_agent(
            scenario, db, difficulty, is_negative_example, max_rounds or self._max_rounds, session
        )

    run = generate
    generate_session = generate

    def _constraints_for(self, scenario: ScenarioDefinition) -> list[ConstraintDefinition]:
        constraints: list[ConstraintDefinition] = []
        if self._loader is not None:
            ids = {constraint_id for step in scenario.stage_sequence for constraint_id in step.constraints}
            for constraint_id in ids:
                try:
                    constraints.append(self._loader.get_constraint(constraint_id))
                except KeyError:
                    continue
        if scenario.category is ScenarioCategory.IMAGE_REQUEST:
            constraints.append(_IMAGE_REQUEST_CONSTRAINT)
        return constraints

    async def _generate_dual_agent(
        self, scenario: ScenarioDefinition, db: Session, difficulty: str | None,
        is_negative_example: bool, max_rounds: int, session: ConversationSession | None = None,
    ) -> ConversationSession:
        if session is None:
            session = ConversationSession(
                scenario_id=scenario.id, difficulty=difficulty or scenario.difficulty.value,
                state={},
            )
        session.state = {**(session.state or {}), "generation_mode": GenerationMode.DUAL_AGENT.value,
                         "category": scenario.category.value, "is_negative_example": is_negative_example}
        db.add(session)
        db.flush()
        history: list[dict[str, str]] = []
        persisted: list[ConversationMessage] = []
        constraints = self._constraints_for(scenario)
        for _ in range(max_rounds):
            for role in ("initiator", "respondent"):
                result = await self._generate_turn(scenario, role, history, constraints, is_negative_example)
                messages, tags = self._normalise_turn(result, scenario.category)
                if not messages:
                    continue
                for index, content in enumerate(messages):
                    self._assert_safe(scenario.category, content)
                    checkpoint = bool(tags) and role == "initiator" and index == len(messages) - 1
                    metadata = {"tactic_tags": tags, "pace": "quick" if len(messages) > 1 else "normal"}
                    if checkpoint:
                        metadata.update({"is_checkpoint": True, "checkpoint_prompt": "What stands out here, and who could you talk to about it?"})
                    message = ConversationMessage(session_id=session.id, sender=role, content=content, metadata_json=metadata)
                    db.add(message)
                    persisted.append(message)
                    history.append({"sender": role, "content": content})
        score = score_transcript(scenario.category, persisted, is_negative_example=is_negative_example)
        session.state = {**session.state, "tactic_tags": score.tactic_tags, "coverage": score.coverage}
        db.commit()
        db.refresh(session)
        return session

    async def _generate_single_pass(
        self, scenario: ScenarioDefinition, db: Session, difficulty: str | None, is_negative_example: bool,
        session: ConversationSession | None = None,
    ) -> ConversationSession:
        """Oversharing has one authoring call and does not enter the dual loop."""
        prompt = "\n\n".join([
            "Author one short oversharing safety moment; no antagonist is involved.",
            PromptBuilder.category_guidance(scenario.category, "respondent"),
            "Return only JSON with moment, branch_options (2-3 strings), checkpoint_prompt, and tactic_tags.",
        ])
        raw = await self._call_llm(prompt, "Create the authored decision moment.")
        moment = str(raw.get("moment") or raw.get("reply") or "").strip()
        if not moment:
            raise HTTPException(status_code=502, detail="LLM returned no oversharing moment")
        options = raw.get("branch_options", raw.get("options", []))
        if not isinstance(options, list):
            options = []
        options = [str(option) for option in options[:3]]
        tags = propose_tags(scenario.category, raw.get("tactic_tags", raw.get("flags", [])))
        if session is None:
            session = ConversationSession(
                scenario_id=scenario.id, difficulty=difficulty or scenario.difficulty.value, state={}
            )
        session.state = {**(session.state or {}), "generation_mode": GenerationMode.SINGLE_PASS.value,
                         "category": scenario.category.value, "is_negative_example": is_negative_example}
        db.add(session)
        db.flush()
        db.add(ConversationMessage(
            session_id=session.id, sender="authored_moment", content=moment,
            metadata_json={"tactic_tags": tags, "branch_options": options, "is_checkpoint": True,
                           "checkpoint_prompt": str(raw.get("checkpoint_prompt") or "What would you change before sharing this, and who could you ask for help?"),
                           "pace": "normal"},
        ))
        score = score_transcript(scenario.category, [{"metadata": {"tactic_tags": tags}}], is_negative_example=is_negative_example)
        session.state = {**session.state, "tactic_tags": score.tactic_tags, "coverage": score.coverage}
        db.commit()
        db.refresh(session)
        return session

    async def _generate_turn(self, scenario: ScenarioDefinition, role: str, history: list[dict[str, str]], constraints: Iterable[ConstraintDefinition], is_negative_example: bool) -> dict[str, Any]:
        prompt = PromptBuilder.build_generation_prompt(scenario, role=role, history=history, constraints=constraints, negative_example=is_negative_example)
        for attempt in range(self._max_safety_retries):
            raw = await self._call_llm(prompt, "Write the next one or two message chunks.")
            messages, _ = self._normalise_turn(raw, scenario.category)
            if all(check_image_request_content(message).safe for message in messages) or scenario.category is not ScenarioCategory.IMAGE_REQUEST:
                return raw
            prompt += "\nYour previous attempt was rejected. Do not mention or describe visuals, images, photos, or appearance."
        raise GenerationSafetyError("image-request turn could not be generated safely")

    async def _call_llm(self, prompt: str, instruction: str) -> dict[str, Any]:
        try:
            return await self._llm.generate(system_prompt=prompt, user_message=instruction)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"LLM generation failed: {exc}") from exc

    @staticmethod
    def _normalise_turn(raw: dict[str, Any], category: ScenarioCategory) -> tuple[list[str], list[str]]:
        values = raw.get("messages")
        if not isinstance(values, list):
            values = [raw.get("reply", "")]
        messages = [str(value).strip() for value in values[:2] if str(value).strip()]
        tags = propose_tags(category, raw.get("tactic_tags", raw.get("flags", [])))
        return messages, tags

    @staticmethod
    def _assert_safe(category: ScenarioCategory, content: str) -> None:
        if category is ScenarioCategory.IMAGE_REQUEST:
            result = check_image_request_content(content)
            if not result.safe:
                raise GenerationSafetyError(result.reason or "unsafe image-request output")


def score_session(category: ScenarioCategory, messages: Iterable[ConversationMessage], *, is_negative_example: bool = False) -> TranscriptScore:
    """Convenience export for admin callers."""
    return score_transcript(category, messages, is_negative_example=is_negative_example)
