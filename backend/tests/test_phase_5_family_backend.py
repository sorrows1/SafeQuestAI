from pathlib import Path

from app.family.guide_builder import build_conversation_guide
from app.models.orm import CheckpointResponse, FamilySession, RedFlagSpan
from app.models.schemas import ConversationGuideOut, PublishedScenarioOut


def _session(parent_user_id: int | None) -> FamilySession:
    return FamilySession(id=1, transcript_id=1, child_user_id=2, parent_user_id=parent_user_id)


def _guide(parent_user_id: int | None):
    return build_conversation_guide(
        _session(parent_user_id),
        "scam",
        [RedFlagSpan(message_sequence=2, tactic_tag="fake_prize_or_reward")],
        [CheckpointResponse(
            checkpoint_message_id=9,
            responder_role="child",
            response_text="I got it wrong and failed to notice the link.",
            flagged_message_ids=[7],
        )],
    )


def test_guides_are_non_grading_for_parent_and_companion_sessions():
    parent_guide = _guide(parent_user_id=3)
    companion_guide = _guide(parent_user_id=None)

    assert parent_guide["completed_together"] is True
    assert companion_guide["completed_together"] is False
    assert set(parent_guide) == set(companion_guide) == {
        "scenario_summary", "child_reasoning_excerpt", "discussion_prompts", "completed_together"
    }
    rendered = str(parent_guide).lower()
    for prohibited in ("score", "wrong", "incorrect", "failed", "grade", "accuracy", "mistakes"):
        assert prohibited not in rendered


def test_player_schemas_exclude_answer_key_and_scoring_fields():
    assert set(PublishedScenarioOut.model_fields) == {
        "id", "category", "render_skin", "difficulty", "message_count"
    }
    prohibited = {"score", "grade", "accuracy", "mistakes", "is_grooming", "tactic_tags", "red_flag_spans"}
    assert prohibited.isdisjoint(ConversationGuideOut.model_fields)
    assert prohibited.isdisjoint(PublishedScenarioOut.model_fields)


def test_family_path_has_no_llm_or_generation_imports():
    family_sources = [
        Path("app/api/family_sessions.py"),
        Path("app/family/guide_builder.py"),
    ]
    text = "\n".join(source.read_text(encoding="utf-8") for source in family_sources).lower()
    for prohibited in ("app.llm", "app.generation", "prompt_builder", "dual_agent_runner"):
        assert prohibited not in text
