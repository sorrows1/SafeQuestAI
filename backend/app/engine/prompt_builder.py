"""Prompt construction for the legacy simulator and offline generation."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Iterable

from app.engine.scenario_loader import ScenarioLoader
from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.content_schemas import ConstraintDefinition
from app.models.schemas import ScenarioCategory, ScenarioDefinition

logger = logging.getLogger(__name__)
_SEP = "\n" + "─" * 60 + "\n"


class PromptBuilder:
    """Assemble layered legacy prompts and role-isolated generation prompts."""

    def __init__(self, loader: ScenarioLoader) -> None:
        self._loader = loader
        self._system_prompt: str | None = None

    def build(
        self,
        template_name: str,
        prompt_blocks: dict[str, str],
        *,
        category: ScenarioCategory | None = None,
        role: str = "initiator",
    ) -> str:
        """Build the existing simulator prompt, optionally with category guidance."""
        del template_name  # Kept for the established public API.
        parts = [
            self._get_system_prompt(),
            _SEP + "## PERSONA & SCENARIO\n" + prompt_blocks.get("persona", ""),
            _SEP + "## CURRENT STAGE\n" + prompt_blocks.get("stage", ""),
            _SEP + "## TURN STATE\n" + prompt_blocks.get("turn_state", ""),
            _SEP + "## RECENT CONVERSATION\n" + prompt_blocks.get("history", "(conversation just started)"),
        ]
        if category is not None:
            parts.append(_SEP + "## CATEGORY & ROLE GUIDANCE\n" + self.category_guidance(category, role))
        parts.append(_SEP + self._get_output_schema())
        return "\n".join(parts)

    @staticmethod
    def category_guidance(category: ScenarioCategory, role: str) -> str:
        """Build category-specific, taxonomy-backed instructions for one role."""
        if role not in {"initiator", "respondent"}:
            raise ValueError("role must be 'initiator' or 'respondent'")
        role_instruction = (
            "You write the initiator side. Use tactics only as pattern-level, "
            "age-appropriate signals; do not produce explicit or operationally harmful content."
            if role == "initiator"
            else "You write the simulated respondent side. You have no hidden intent, "
            "manipulation style, or private persona information. Respond naturally and "
            "do not invent adversary goals."
        )
        category_instruction = {
            ScenarioCategory.GROOMING: "Keep the example age-appropriate and pattern-focused; do not use explicit content.",
            ScenarioCategory.CYBERBULLYING: "Show exclusion, pile-on, or social-pressure structure without composing ready-to-reuse insults or targeted harassment scripts.",
            ScenarioCategory.SCAM: "Realistic urgency and fake-brand/domain details are allowed where useful for recognition, but never request real credentials or money.",
            ScenarioCategory.IMAGE_REQUEST: "Do not describe images, photos, bodies, appearance, or physical features. Keep any concerning pattern abstract and non-visual.",
            ScenarioCategory.OVERSHARING: "Focus on a safe-to-display draft post and the audience/context mismatch, not an antagonist conversation.",
        }[category]
        return json.dumps(
            {
                "category": category.value,
                "allowed_tactic_tags": TACTIC_TAGS_BY_CATEGORY[category],
                "role": role,
                "role_instruction": role_instruction,
                "category_instruction": category_instruction,
                "message_chunking": "Return one or two short messages when a double-text feels natural; otherwise return one.",
            },
            indent=2,
        )

    @classmethod
    def build_generation_prompt(
        cls,
        scenario: ScenarioDefinition,
        *,
        role: str,
        history: Iterable[dict[str, str]],
        constraints: Iterable[ConstraintDefinition] = (),
        negative_example: bool = False,
    ) -> str:
        """Build an offline prompt without leaking initiator-only information.

        The respondent prompt is made from public scenario fields and transcript
        history only. It never receives the persona's manipulation style or a
        hidden objective.
        """
        public_scenario = {
            "id": scenario.id,
            "display_name": scenario.display_name,
            "description": scenario.description,
            "category": scenario.category.value,
            "difficulty": scenario.difficulty.value,
            "negative_example": negative_example,
        }
        if role == "initiator":
            public_scenario["persona_id"] = scenario.persona
        constraint_block = [
            {
                "id": item.id,
                "description": item.description,
                "forbidden_actions": item.forbidden_actions,
                "forbidden_topics": item.forbidden_topics,
                "forbidden_phrases": item.forbidden_phrases,
            }
            for item in constraints
        ]
        return "\n\n".join(
            [
                "You are authoring an offline, pre-review digital-safety example. Never address a real child.",
                "SCENARIO\n" + json.dumps(public_scenario, indent=2),
                "CATEGORY GUIDANCE\n" + cls.category_guidance(scenario.category, role),
                "ACTIVE CONSTRAINTS\n" + json.dumps(constraint_block, indent=2),
                "TRANSCRIPT SO FAR\n" + json.dumps(list(history), indent=2),
                "Return only JSON: {\"messages\": [\"one short message\"], \"tactic_tags\": [\"a tag from allowed_tactic_tags\"]}. Messages must contain one or two short chunks.",
            ]
        )

    def _get_system_prompt(self) -> str:
        if self._system_prompt is not None:
            return self._system_prompt
        try:
            self._system_prompt = self._loader.get_prompt_template("system_prompt").content
            return self._system_prompt
        except KeyError:
            pass
        system_file = self._loader._config_dir / "prompts" / "system_prompt.txt"
        if system_file.exists():
            self._system_prompt = system_file.read_text(encoding="utf-8")
            return self._system_prompt
        logger.warning("system_prompt.txt not found — using minimal fallback")
        self._system_prompt = "You are a realistic person chatting on a messaging app. Respond naturally. Never sound like an AI assistant."
        return self._system_prompt

    @staticmethod
    def _get_output_schema() -> str:
        return (
            "## YOUR RESPONSE\nYou MUST respond ONLY with a valid JSON object. No prose before or after.\n\n"
            '{"reply":"Your message as the character","current_stage":"stage id","next_stage":"stage id",'
            '"current_objective":"objective id","objective_completed":false,"trust_delta":0.0,'
            '"suspicion_delta":0.0,"flags":[],"reasoning":"brief reason","confidence":0.8}'
        )

    @staticmethod
    def extract_variables(template_content: str) -> list[str]:
        del template_content
        return []
