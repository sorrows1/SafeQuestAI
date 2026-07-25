"""Category-bounded scoring for offline generated transcripts."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Iterable

from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.schemas import ScenarioCategory


@dataclass(frozen=True)
class TranscriptScore:
    category: ScenarioCategory
    tactic_tags: list[str]
    coverage: float
    is_negative_example: bool


def propose_tags(
    category: ScenarioCategory,
    candidates: Iterable[str],
) -> list[str]:
    """Keep tag proposals within the canonical list for the selected category."""
    allowed = TACTIC_TAGS_BY_CATEGORY[category]
    candidate_set = {str(value) for value in candidates}
    return [tag for tag in allowed if tag in candidate_set]


def score_transcript(
    category: ScenarioCategory,
    messages: Iterable[Any],
    *,
    is_negative_example: bool = False,
) -> TranscriptScore:
    """Produce admin-only coverage data without inventing taxonomy values."""
    candidates: list[str] = []
    for message in messages:
        metadata = getattr(message, "metadata_json", None)
        if metadata is None and isinstance(message, dict):
            metadata = message.get("metadata_json", message.get("metadata", {}))
        if isinstance(metadata, dict):
            candidates.extend(metadata.get("tactic_tags", []))
    tags = propose_tags(category, candidates)
    coverage = len(tags) / len(TACTIC_TAGS_BY_CATEGORY[category])
    return TranscriptScore(category, tags, coverage, is_negative_example)


class TranscriptScorer:
    """Small compatibility wrapper for callers that prefer an object API."""

    def score(self, category: ScenarioCategory, messages: Iterable[Any], *, is_negative_example: bool = False) -> TranscriptScore:
        return score_transcript(category, messages, is_negative_example=is_negative_example)
