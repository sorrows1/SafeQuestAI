"""Grounded companion generation for reviewed family scenarios.

The provider can assess a child's reasoning, but it never decides whether an item is a
red flag or which tactics are present. Those facts come solely from curated annotations.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from pydantic import BaseModel, Field, ValidationError

from app.companion.persona import COMPANION_SYSTEM_PROMPT
from app.companion.safety import redact_personal_info
from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.llm.llm_service import LLMService
from app.models.orm import CompanionExchange, CuratedSceneElement, CuratedMessage, CuratedTranscript, RedFlagSpan
from app.models.schemas import ScenarioCategory

PROMPT_CONTEXT_VERSION = "phase4-grounded-v1"
MAX_CONTEXT_ELEMENTS = 30
MAX_CONTEXT_EXCHANGES = 4
MAX_CONTEXT_FINDINGS = 20
MAX_ELEMENT_TEXT = 2_000


class CompanionStructuredOutput(BaseModel):
    acknowledgment: str = Field(min_length=1, max_length=1_000)
    reasoning_assessment: str = Field(min_length=1, max_length=2_000)
    red_flag_result: bool
    explanation: str = Field(min_length=1, max_length=2_000)
    tactic_tags: list[str] = Field(default_factory=list)
    next_hint_or_action: str = Field(min_length=1, max_length=2_000)
    response_text: str = Field(min_length=1, max_length=4_000)


def _tag_definition(tag: str) -> str:
    return tag.replace("_", " ")


def curated_context(messages: Sequence[CuratedMessage]) -> str:
    """Compatibility helper for the existing checkpoint/explain companion path."""
    return "\n".join(
        f"Scenario message {m.sequence} ({m.speaker_label}): {m.content[:MAX_ELEMENT_TEXT]}"
        for m in messages[-MAX_CONTEXT_ELEMENTS:]
    )


def build_companion_context(
    *,
    transcript: CuratedTranscript,
    revealed_elements: Sequence[CuratedSceneElement],
    selected_element: CuratedSceneElement | None = None,
    annotations: Sequence[RedFlagSpan] = (),
    claim: str | None = None,
    reasoning: str | None = None,
    checkpoint: str | None = None,
    exchanges: Sequence[CompanionExchange] = (),
    current_findings: Sequence[dict[str, Any]] = (),
    hint_level: int = 0,
    channel: str = "private_child",
) -> dict[str, Any]:
    """Create the minimal, redacted context permitted for a companion request.

    Annotation data is supplied only by the flag-attempt route after a child submits
    reasoning. This function deliberately has no participant database identifiers.
    """
    snapshot = transcript.public_metadata_snapshot or {}
    category = ScenarioCategory(transcript.category)
    selected_key = selected_element.element_key if selected_element else None
    nearby_keys = {selected_key, selected_element.parent_element_key if selected_element else None}
    public_elements = [
        {
            "element_key": item.element_key,
            "parent_element_key": item.parent_element_key,
            "element_type": item.element_type,
            "semantic_role": item.semantic_role,
            "display_text": (item.content or "")[:MAX_ELEMENT_TEXT],
            "relationship": "selected" if item.element_key == selected_key else ("nearby" if item.parent_element_key in nearby_keys else "revealed"),
        }
        for item in revealed_elements[-MAX_CONTEXT_ELEMENTS:]
    ]
    allowed_tags = sorted({span.tactic_tag for span in annotations if span.tactic_tag in TACTIC_TAGS_BY_CATEGORY[category]})
    return {
        "context_version": PROMPT_CONTEXT_VERSION,
        "scenario": {
            "category": category.value,
            "public_objective": str(snapshot.get("learning_objectives", ["Notice pressure and choose safe next steps"])[0] if snapshot.get("learning_objectives") else "Notice pressure and choose safe next steps"),
            "summary": str(snapshot.get("description") or "A reviewed online-safety scenario."),
            "age_band_guidance": str(snapshot.get("age_band") or "Use clear, calm language suitable for young people."),
            "skin_semantic_type": transcript.render_skin,
        },
        "revealed_scene_elements": public_elements,
        "selected_element_key": selected_key,
        "curator_result": bool(annotations),
        "child_safe_explanation": " ".join(filter(None, (span.child_safe_explanation for span in annotations))),
        "allowed_tactic_tags": {tag: _tag_definition(tag) for tag in allowed_tags},
        "current_validated_findings": list(current_findings)[-MAX_CONTEXT_FINDINGS:],
        "child_submission": {"claim": claim, "reasoning": redact_personal_info(reasoning or "")},
        "current_checkpoint": checkpoint,
        "prior_relevant_exchanges": [
            {"child": redact_personal_info(item.child_text), "companion": redact_personal_info(item.companion_text)}
            for item in exchanges[-MAX_CONTEXT_EXCHANGES:]
        ],
        "hint_level": hint_level,
        "channel_rules": "This is a private child companion channel; do not reveal it to family participants." if channel == "private_child" else "This is shared family feedback; never include private companion exchanges.",
    }


def deterministic_attempt_feedback(*, is_concerning: bool, explanations: Sequence[str], allowed_tags: Sequence[str], claim: str) -> dict[str, Any]:
    explanation = " ".join(filter(None, explanations)) or (
        "This item has a reviewed safety concern worth talking through." if is_concerning
        else "This item is not one of the reviewed concerns in this scene. It can still be useful to pause and think about how it feels."
    )
    result = "This item is a reviewed concern." if is_concerning else "This item is not a reviewed concern."
    return {
        "acknowledgment": "Thanks for explaining what you noticed.",
        "reasoning_assessment": "You are practicing looking for details and thinking about safe next steps.",
        "red_flag_result": is_concerning,
        "explanation": explanation,
        "tactic_tags": list(dict.fromkeys(allowed_tags)) if is_concerning else [],
        "next_hint_or_action": "Consider what you could say or do next, including asking a trusted adult for help.",
        "response_text": f"{result} {explanation} Consider a safe next step or a trusted adult who could help.",
        "claim": claim,
        "fallback": True,
    }


async def generate_attempt_feedback(
    llm: LLMService,
    context: dict[str, Any],
    *,
    is_concerning: bool,
    explanations: Sequence[str],
    allowed_tags: Sequence[str],
    claim: str,
) -> dict[str, Any]:
    fallback = deterministic_attempt_feedback(
        is_concerning=is_concerning, explanations=explanations, allowed_tags=allowed_tags, claim=claim
    )
    try:
        result = await llm.generate(COMPANION_SYSTEM_PROMPT, str(context))
        parsed = CompanionStructuredOutput.model_validate(result)
    except (Exception, ValidationError):
        return fallback
    # Curator facts always win, even if a provider produces conflicting JSON.
    payload = parsed.model_dump()
    payload["red_flag_result"] = is_concerning
    payload["tactic_tags"] = list(dict.fromkeys(tag for tag in parsed.tactic_tags if tag in allowed_tags)) if is_concerning else []
    payload["response_text"] = redact_personal_info(payload["response_text"].strip())
    payload["fallback"] = False
    return payload


async def generate_companion_response(
    llm: LLMService,
    child_text: str,
    messages: Sequence[CuratedMessage],
    checkpoint_prompt: str | None = None,
) -> str:
    """Compatibility response for checkpoint and free-form explain endpoints."""
    user_message = (
        f"Reviewed scenario context:\n{curated_context(messages)}\n\n"
        f"Checkpoint prompt: {checkpoint_prompt or 'Invite the child to think aloud.'}\n\n"
        f"Child's thought (identifiers removed): {redact_personal_info(child_text)}"
    )
    try:
        result = await llm.generate(COMPANION_SYSTEM_PROMPT, user_message)
    except Exception:
        return "Thanks for sharing your thought. Pause, notice what feels concerning, and consider a trusted adult who could help."
    response = result.get("response_text") if isinstance(result, dict) else None
    if not isinstance(response, str) or not response.strip():
        return "Thanks for sharing your thought. Pause, notice what feels concerning, and consider a trusted adult who could help."
    return redact_personal_info(response.strip())
