"""Build template-only, non-judgmental guides from explicitly shared session data.

No LLM, generation engine, or private companion exchange is used here.  The
result is a discussion aid, never a learner evaluation.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable

from app.models.orm import (
    CheckpointResponse,
    FamilyCaregiverComment,
    FamilySession,
    FlagAttempt,
    RedFlagSpan,
    ValidatedFinding,
)

_TEMPLATE_PATH = Path(__file__).parent.parent / "config" / "family_discussion_prompts.json"
_DISALLOWED_LANGUAGE = re.compile(r"\b(?:wrong|incorrect|failed|score|grade|accuracy|mistakes)\b", re.IGNORECASE)


def _templates_for(category: str) -> list[str]:
    with _TEMPLATE_PATH.open(encoding="utf-8") as template_file:
        templates = json.load(template_file)
    return list(templates.get(category, templates["grooming"]))


def _display_tactic(tag: str) -> str:
    return _DISALLOWED_LANGUAGE.sub("that concern", tag.replace("_", " "))


def _neutral_excerpt(text: str) -> str:
    collapsed = " ".join(text.split())[:500]
    return _DISALLOWED_LANGUAGE.sub("that point", collapsed)


def _scenario_summary(category: str, spans: Iterable[RedFlagSpan]) -> str:
    tactics = list(dict.fromkeys(_display_tactic(span.tactic_tag) for span in spans))
    category_name = category.replace("_", " ")
    if tactics:
        return f"This {category_name} scenario included these reviewed safety concerns: {', '.join(tactics)}."
    return f"This {category_name} scenario is a reviewed example for discussing online safety together."


def _shared_excerpt(
    responses: Iterable[CheckpointResponse],
    spans: Iterable[RedFlagSpan],
    attempts: Iterable[FlagAttempt],
    findings: Iterable[ValidatedFinding],
    comments: Iterable[FamilyCaregiverComment],
) -> dict[str, object]:
    span_by_id = {span.id: span for span in spans if span.id is not None}
    shared_responses = [
        response for response in responses
        if response.responder_role == "child" and response.visibility == "shared"
    ]
    shared_attempts = [attempt for attempt in attempts if attempt.visibility == "shared"]
    validated = []
    for finding in findings:
        span = span_by_id.get(finding.red_flag_span_id)
        if not span:
            continue
        validated.append({
            "tactic": _display_tactic(span.tactic_tag),
            "explanation": _neutral_excerpt(span.child_safe_explanation or "This is a reviewed safety concern."),
        })
    return {
        "child_responses": [
            {"checkpoint_message_id": response.checkpoint_message_id, "excerpt": _neutral_excerpt(response.response_text)}
            for response in shared_responses
        ],
        "shared_reflections": [
            {"responder_role": response.responder_role, "excerpt": _neutral_excerpt(response.response_text)}
            for response in responses
            if response.visibility == "shared"
        ],
        "shared_attempts": [
            {"claim": attempt.claim, "excerpt": _neutral_excerpt(attempt.sanitized_reasoning)}
            for attempt in shared_attempts
        ],
        "validated_findings": validated,
        "caregiver_comments": [
            {"label": comment.child_visible_label, "excerpt": _neutral_excerpt(comment.text)}
            for comment in comments
            if comment.deleted_at is None
        ],
    }


def _discussion_prompts(category: str, responses: list[CheckpointResponse]) -> list[str]:
    prompts = _templates_for(category)[:3]
    child_response = next(
        (response for response in responses if response.responder_role == "child" and response.visibility == "shared"),
        None,
    )
    if child_response:
        excerpt = _neutral_excerpt(child_response.response_text)
        prompts[-1] = f"You mentioned \"{excerpt}\". What support would feel helpful if something like this happened?"
    return prompts


def build_conversation_guide(
    session: FamilySession,
    category: str,
    red_flag_spans: Iterable[RedFlagSpan],
    checkpoint_responses: Iterable[CheckpointResponse],
    companion_exchanges: Iterable[object] = (),
    *,
    shared_attempts: Iterable[FlagAttempt] = (),
    validated_findings: Iterable[ValidatedFinding] = (),
    caregiver_comments: Iterable[FamilyCaregiverComment] = (),
) -> dict[str, object]:
    """Return guide fields without exposing private companion or disclosure data."""
    del companion_exchanges  # Backward-compatible argument; private exchanges never enter guides.
    spans = list(red_flag_spans)
    responses = list(checkpoint_responses)
    return {
        "scenario_summary": _scenario_summary(category, spans),
        "child_reasoning_excerpt": _shared_excerpt(
            responses, spans, list(shared_attempts), list(validated_findings), list(caregiver_comments),
        ),
        "discussion_prompts": _discussion_prompts(category, responses),
        "completed_together": session.parent_user_id is not None,
    }
