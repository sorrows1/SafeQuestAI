"""Category-bounded scoring for offline generated transcripts."""
from __future__ import annotations

import re
from collections import Counter
from dataclasses import dataclass
from typing import Any, Iterable

from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.schemas import DifficultyModifier, ScenarioCategory


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


_VISUAL_PATTERN = re.compile(
    r"\b(?:photo|picture|selfie|image|nude|naked|body|bodies|face|looks?|appearance|what\s+you\s+look\s+like|show\s+me|send\s+(?:me\s+)?(?:a|your))\b",
    re.IGNORECASE,
)


@dataclass(frozen=True)
class QualityIssue:
    code: str
    message: str


def image_request_content_is_safe(content: str) -> bool:
    """Keep image-request practice examples non-visual before they persist."""
    return _VISUAL_PATTERN.search(content) is None


def selected_modifier(scenario: dict[str, Any]) -> DifficultyModifier:
    modifiers = scenario.get("difficulty_modifiers", {})
    raw = modifiers.get(str(scenario.get("difficulty", "Medium")), {})
    return DifficultyModifier.model_validate(raw)


def scene_quality_issues(draft: Any, modifier: DifficultyModifier | None = None) -> list[QualityIssue]:
    """Return publication-quality issues for a structured admin scene."""
    modifier = modifier or DifficultyModifier()
    elements = {element.element_key: element for element in draft.scene.elements}
    targets = [annotation.element_key for annotation in draft.annotations]
    tag_counts = Counter(annotation.tactic_tag for annotation in draft.annotations)
    issues: list[QualityIssue] = []

    if len(set(targets)) != len(targets):
        issues.append(QualityIssue("ONE_TACTIC_PER_TARGET", "Each red-flag target must have one primary teaching tactic."))
    if len(set(targets)) > modifier.max_suspicious_targets:
        issues.append(QualityIssue("TARGET_BUDGET", f"Scene has {len(set(targets))} suspicious targets; its difficulty budget is {modifier.max_suspicious_targets}."))
    repeated_with_justification = all(
        count == 1 or all((annotation.repeat_justification or "").strip() for annotation in draft.annotations if annotation.tactic_tag == tag)
        for tag, count in tag_counts.items()
    )
    if len(targets) and len(set(tag_counts)) < min(modifier.min_distinct_tactics, len(set(targets))) and not repeated_with_justification:
        issues.append(QualityIssue("TACTIC_DIVERSITY", "Use distinct primary tactics across red-flag targets where the target budget allows, or record a repeat justification."))

    allowed = set(TACTIC_TAGS_BY_CATEGORY[draft.category])
    for annotation in draft.annotations:
        if annotation.tactic_tag not in allowed:
            issues.append(QualityIssue("INVALID_TACTIC_TAG", f"{annotation.tactic_tag!r} is not available for {draft.category.value}."))
        if not (annotation.explanation or "").strip():
            issues.append(QualityIssue("MISSING_EXPLANATION", f"{annotation.element_key!r} needs a child-safe explanation."))
        if tag_counts[annotation.tactic_tag] > 1 and not (annotation.repeat_justification or "").strip():
            issues.append(QualityIssue("REPEATED_TACTIC", f"Repeated tactic {annotation.tactic_tag!r} needs an explicit author justification."))

    if draft.category is ScenarioCategory.IMAGE_REQUEST:
        unsafe = [element.element_key for element in elements.values() if element.content and not image_request_content_is_safe(element.content)]
        if unsafe:
            issues.append(QualityIssue("IMAGE_REQUEST_SAFETY", "Image-request scenes must stay non-visual: " + ", ".join(unsafe)))
    return issues


def validate_scene_quality(draft: Any, modifier: DifficultyModifier | None = None) -> None:
    issues = scene_quality_issues(draft, modifier)
    if issues:
        raise ValueError("; ".join(issue.message for issue in issues))


def generation_quality_issues(
    *, category: ScenarioCategory, modifier: DifficultyModifier, raw: dict[str, Any], texts: Iterable[str], existing_messages: Iterable[Any],
) -> list[QualityIssue]:
    """Validate an LLM candidate before appending any of its messages."""
    candidate_texts = [text.strip() for text in texts]
    existing = list(existing_messages)
    allowed = set(TACTIC_TAGS_BY_CATEGORY[category])
    proposed = [str(tag) for tag in raw.get("tactic_tags", [])]
    # Strip any proposed tags that are not in the allowed taxonomy — propose_tags() will
    # do this downstream anyway, so we only validate tags that ARE in the taxonomy.
    valid_proposed = [t for t in proposed if t in allowed]
    plan = raw.get("tactic_plan", [])
    if not isinstance(plan, list):
        return [QualityIssue("TACTIC_PLAN", "Generation tactic_plan must be a list.")]
    plan_tags = [str(item.get("tactic_tag", item)) if isinstance(item, dict) else str(item) for item in plan]
    valid_plan_tags = [t for t in plan_tags if t in allowed]
    issues: list[QualityIssue] = []
    # Note: INVALID_TACTIC_TAG is NOT a hard-fail — propose_tags() strips invalid tags
    # before persisting. Retrying on an invalid tag name just wastes LLM calls.
    if valid_proposed and not valid_plan_tags:
        issues.append(QualityIssue("TACTIC_PLAN", "A flagged generated turn must include a tactic plan before dialogue."))
    if any(tag not in valid_plan_tags for tag in valid_proposed):
        issues.append(QualityIssue("TACTIC_PLAN", "Generated tactic tags must be declared in the tactic plan."))
    if len(set(valid_proposed)) != len(valid_proposed):
        issues.append(QualityIssue("TACTIC_DIVERSITY", "Do not repeat a tactic within one generated target."))
    if len(candidate_texts) != len(set(text.lower() for text in candidate_texts)):
        issues.append(QualityIssue("REPEATED_LANGUAGE", "Do not repeat identical manipulation language in one turn."))
    historical = [str(getattr(message, "content", "")).strip().lower() for message in existing]
    if any(text.lower() in historical for text in candidate_texts):
        issues.append(QualityIssue("REPEATED_LANGUAGE", "Do not repeat an earlier message verbatim."))
    if category is ScenarioCategory.IMAGE_REQUEST and any(not image_request_content_is_safe(text) for text in candidate_texts):
        issues.append(QualityIssue("IMAGE_REQUEST_SAFETY", "Image-request generation must stay non-visual."))
    existing_targets = sum(bool((getattr(message, "metadata_json", {}) or {}).get("tactic_tags")) for message in existing)
    target_count = existing_targets + bool(valid_proposed)
    total_messages = len(existing) + len(candidate_texts)
    # Safe message ratio is evaluated at transcript review time, not per-turn,
    # to avoid premature retry exhaustion on short conversations.
    existing_tags = {str(tag) for message in existing for tag in (getattr(message, "metadata_json", {}) or {}).get("tactic_tags", [])}
    if any(tag in existing_tags for tag in valid_proposed):
        issues.append(QualityIssue("TACTIC_DIVERSITY", "Do not repeat a tactic tag that was already used in a previous turn."))
    elif any(tag in existing_tags for tag in valid_plan_tags):
        issues.append(QualityIssue("TACTIC_DIVERSITY", "Do not include previously used tactic tags in the tactic plan."))
    all_tags = existing_tags | set(valid_proposed)
    if target_count >= modifier.min_distinct_tactics and len(all_tags) < modifier.min_distinct_tactics:
        issues.append(QualityIssue("TACTIC_DIVERSITY", "Generated targets do not meet the tactic-diversity goal."))
    # DIFFICULTY_FIT mismatch is NOT a hard-fail — it indicates the LLM declared the wrong
    # difficulty metadata but the content itself may be valid. Retrying wastes LLM calls.
    if raw.get("is_checkpoint") and any((getattr(message, "metadata_json", {}) or {}).get("is_checkpoint") for message in existing[-2:]):
        issues.append(QualityIssue("CHECKPOINT_SPACING", "Keep a non-checkpoint message between checkpoints."))
    return issues


def transcript_quality_issues(messages: Iterable[Any], annotations: Iterable[Any], modifier: DifficultyModifier) -> list[QualityIssue]:
    """Run complete-scene checks after generation and before publication."""
    items = list(messages)
    spans = list(annotations)
    target_sources = {
        getattr(span, "message_sequence", None)
        for span in spans
        if getattr(span, "message_sequence", None) is not None
    }
    issues: list[QualityIssue] = []
    if len(target_sources) > modifier.max_suspicious_targets:
        issues.append(QualityIssue("TARGET_BUDGET", "Reviewed transcript exceeds its suspicious-target budget."))
    if items and (len(items) - len(target_sources)) / len(items) < modifier.min_safe_message_ratio:
        issues.append(QualityIssue("SAFE_MESSAGE_RATIO", "Reviewed transcript needs more meaningful safe or neutral messages."))
    tags = {str(getattr(span, "tactic_tag", "")) for span in spans}
    if len(target_sources) >= modifier.min_distinct_tactics and len(tags) < modifier.min_distinct_tactics:
        issues.append(QualityIssue("TACTIC_DIVERSITY", "Reviewed transcript does not meet the tactic-diversity goal."))
    if any(getattr(item, "is_checkpoint", False) and getattr(next_item, "is_checkpoint", False) for item, next_item in zip(items, items[1:])):
        issues.append(QualityIssue("CHECKPOINT_SPACING", "Reviewed transcript has adjacent checkpoints."))
    return issues
