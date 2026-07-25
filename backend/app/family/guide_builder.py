"""Build non-judgmental conversation guides from reviewed session data.

This module intentionally has no LLM, generation-engine, or prompt-builder
imports.  It only formats facts already present in curated content and the
discussion responses supplied during a family session.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from typing import Iterable

from app.models.orm import CheckpointResponse, CompanionExchange, FamilySession, RedFlagSpan

_TEMPLATE_PATH = Path(__file__).parent.parent / "config" / "family_discussion_prompts.json"
_DISALLOWED_LANGUAGE = re.compile(r"\b(?:wrong|incorrect|failed|score|grade|accuracy|mistakes)\b", re.IGNORECASE)


def _templates_for(category: str) -> list[str]:
    with _TEMPLATE_PATH.open(encoding="utf-8") as template_file:
        templates = json.load(template_file)
    return list(templates.get(category, templates["grooming"]))


def _display_tactic(tag: str) -> str:
    """Turn stored tactic identifiers into a factual, readable label."""
    return _DISALLOWED_LANGUAGE.sub("that concern", tag.replace("_", " "))


def _neutral_excerpt(text: str) -> str:
    """Preserve the participant's meaning without reproducing grading language."""
    collapsed = " ".join(text.split())[:500]
    return _DISALLOWED_LANGUAGE.sub("that point", collapsed)


def _scenario_summary(category: str, spans: Iterable[RedFlagSpan]) -> str:
    tactics = list(dict.fromkeys(_display_tactic(span.tactic_tag) for span in spans))
    category_name = category.replace("_", " ")
    if tactics:
        return f"This {category_name} scenario included these reviewed safety concerns: {', '.join(tactics)}."
    return f"This {category_name} scenario is a reviewed example for discussing online safety together."


def _reasoning_excerpt(responses: Iterable[CheckpointResponse], spans: Iterable[RedFlagSpan], companion_exchanges: Iterable[CompanionExchange]) -> dict[str, object]:
    child_responses = [response for response in responses if response.responder_role == "child"]
    flagged_message_ids = sorted({
        message_id for response in child_responses for message_id in (response.flagged_message_ids or [])
    })
    reviewed_sequences = sorted({span.message_sequence for span in spans if span.message_sequence is not None})
    return {
        "child_responses": [
            {"checkpoint_message_id": response.checkpoint_message_id, "excerpt": _neutral_excerpt(response.response_text)}
            for response in child_responses
        ],
        "detective_observations": {
            "flagged_message_ids": flagged_message_ids,
            "messages_with_reviewed_red_flags": reviewed_sequences,
        },
        "reasoning_explanations": [
            _neutral_excerpt(exchange.child_text)
            for exchange in companion_exchanges
            if exchange.exchange_type == "explain"
        ],
    }


def _discussion_prompts(category: str, responses: list[CheckpointResponse]) -> list[str]:
    prompts = _templates_for(category)[:3]
    child_response = next((response for response in responses if response.responder_role == "child"), None)
    if child_response:
        excerpt = _neutral_excerpt(child_response.response_text)
        prompts[-1] = f"You mentioned \"{excerpt}\". What support would feel helpful if something like this happened?"
    return prompts


def build_conversation_guide(
    session: FamilySession,
    category: str,
    red_flag_spans: Iterable[RedFlagSpan],
    checkpoint_responses: Iterable[CheckpointResponse],
    companion_exchanges: Iterable[CompanionExchange] = (),
) -> dict[str, object]:
    """Return fields for ``ConversationGuide`` without evaluating anyone's responses."""
    spans = list(red_flag_spans)
    responses = list(checkpoint_responses)
    return {
        "scenario_summary": _scenario_summary(category, spans),
        "child_reasoning_excerpt": _reasoning_excerpt(responses, spans, companion_exchanges),
        "discussion_prompts": _discussion_prompts(category, responses),
        "completed_together": session.parent_user_id is not None,
    }
