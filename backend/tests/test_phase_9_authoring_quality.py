from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.generation.scorer import generation_quality_issues, propose_tags
from app.models.schemas import (
    AdminSceneDraft,
    Difficulty,
    DifficultyModifier,
    ElementType,
    RenderSkin,
    SceneAnnotationDraft,
    SceneDefinition,
    SceneElement,
    ScenarioCategory,
    default_difficulty_modifiers,
    validate_scene_draft_for_publication,
)
from app.simulation.runtime import SimulationRuntime


def element(key: str, content: str) -> SceneElement:
    return SceneElement(
        element_key=key, element_type=ElementType.MESSAGE, sequence=0,
        content=content, selectable=True, accessible_label=key, semantic_role="article",
    )


def draft(category=ScenarioCategory.SCAM, annotations=None, elements=None) -> AdminSceneDraft:
    return AdminSceneDraft(
        category=category,
        scene=SceneDefinition(render_skin=RenderSkin.CHAT, elements=elements or [element("flag", "A message that asks you to hurry.")]),
        annotations=annotations or [SceneAnnotationDraft(element_key="flag", tactic_tag="urgency_pressure", explanation="The hurry can make it harder to pause.", tiered_hints=["Notice the deadline."])],
    )


def test_difficulty_modifiers_have_bounded_scene_quality_controls():
    modifiers = default_difficulty_modifiers()
    assert modifiers[Difficulty.EASY].red_flag_visibility.value == "high"
    assert modifiers[Difficulty.MEDIUM].red_flag_visibility.value == "medium"
    assert modifiers[Difficulty.HARD].red_flag_visibility.value == "low"
    assert modifiers[Difficulty.EASY].max_suspicious_targets < modifiers[Difficulty.HARD].max_suspicious_targets
    assert all(0.4 <= modifier.min_safe_message_ratio <= 0.9 for modifier in modifiers.values())


def test_publication_requires_one_primary_tactic_per_target_and_explanations():
    duplicate = draft(annotations=[
        SceneAnnotationDraft(element_key="flag", tactic_tag="urgency_pressure", explanation="It pressures a quick choice."),
        SceneAnnotationDraft(element_key="flag", tactic_tag="suspicious_link", explanation="The link needs checking."),
    ])
    with pytest.raises(ValueError, match="one primary teaching tactic"):
        validate_scene_draft_for_publication(duplicate)

    incomplete = draft(annotations=[SceneAnnotationDraft(element_key="flag", tactic_tag="urgency_pressure")])
    with pytest.raises(ValueError, match="requires an explanation"):
        validate_scene_draft_for_publication(incomplete)


def test_category_tags_and_image_request_safety_are_publication_gates():
    with pytest.raises(ValidationError, match="not allowed"):
        draft(annotations=[SceneAnnotationDraft(element_key="flag", tactic_tag="direct_request", explanation="Wrong category.")])

    unsafe = draft(
        category=ScenarioCategory.IMAGE_REQUEST,
        elements=[element("flag", "Send a photo of yourself.")],
        annotations=[SceneAnnotationDraft(element_key="flag", tactic_tag="direct_request", explanation="This asks for visual material.")],
    )
    with pytest.raises(ValueError, match="non-visual"):
        validate_scene_draft_for_publication(unsafe)


def test_generation_quality_ignores_invalid_taxonomy_tags_and_avoids_repeat_language():
    issues = generation_quality_issues(
        category=ScenarioCategory.SCAM,
        modifier=DifficultyModifier(),
        raw={
            "tactic_tags": ["not_a_taxonomy_tag"],
            "tactic_plan": ["not_a_taxonomy_tag"],
        },
        texts=["Please hurry."],
        existing_messages=[],
    )
    assert not any(issue.code == "INVALID_TACTIC_TAG" for issue in issues)

    issues = generation_quality_issues(
        category=ScenarioCategory.SCAM,
        modifier=DifficultyModifier(),
        raw={
            "tactic_tags": ["urgency_pressure"],
            "tactic_plan": ["urgency_pressure"],
        },
        texts=["Please hurry.", "Please hurry."],
        existing_messages=[],
    )
    assert any(issue.code == "REPEATED_LANGUAGE" for issue in issues)


def test_prompt_layers_request_tactic_plans_without_leaking_hidden_intent():
    run = SimpleNamespace(
        config_snapshot={
            "scenario": {"id": "safe", "display_name": "Safe", "description": "Public", "category": "scam", "difficulty": "Medium", "difficulty_modifiers": {}},
            "personas": {"initiator": {"display_name": "Hidden"}, "respondent": {"display_name": "Learner"}},
            "prompts": {"initiator": {"content": "i"}, "respondent": {"content": "r"}}, "system_prompts": {},
            "stages": {"opening": {"default_constraints": []}}, "constraints": {},
            "objectives": {"private": {"hidden_intent": "secret objective"}},
        }, state={"current_stage": "opening", "current_objective": "private"},
    )
    runtime = SimulationRuntime(lambda: None)
    respondent = "\n".join(runtime.layers(run, "respondent")["user"])
    initiator = "\n".join(runtime.layers(run, "initiator")["user"])
    assert "tactic_plan" in initiator and "secret objective" in initiator
    assert "secret objective" not in respondent and "Hidden" not in respondent


def test_propose_tags_strips_non_taxonomy_tags():
    tags = propose_tags(
        ScenarioCategory.SCAM,
        ["urgency_pressure", "not_a_taxonomy_tag"],
    )

    assert tags == ["urgency_pressure"]