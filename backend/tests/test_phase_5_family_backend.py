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
        "id", "title", "summary", "category", "render_skin", "difficulty", "tags",
        "learning_objectives", "message_count", "checkpoint_count", "published_at",
        "supported_participation_modes",
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



def test_published_catalog_filters_sorts_pages_and_hides_internal_snapshot_fields():
    from datetime import datetime, timezone
    from app.api.family_sessions import list_scenarios
    from app.models.orm import CuratedMessage, CuratedTranscript
    from app.models.schemas import ScenarioCategory

    def transcript(id, title, category, difficulty, published_at):
        return CuratedTranscript(id=id, category=category, render_skin="chat", difficulty=difficulty, reviewed_at=published_at, published_at=published_at, is_published=True, public_metadata_snapshot={"display_name": title, "description": title + " summary", "category": category, "render_skin": "chat", "difficulty": difficulty, "tags": ["privacy"], "learning_objectives": ["Ask for help"], "tactic_tags": ["private"]})

    class CountQuery:
        def __init__(self, db): self.db = db
        def filter(self, *args): return self
        def count(self): return self.db.counts.pop(0)

    class TranscriptQuery:
        def __init__(self, values): self.values = values
        def filter(self, *args): return self
        def all(self): return self.values

    class Db:
        def __init__(self, values): self.values, self.counts = values, [4, 1] * len(values)
        def query(self, model): return TranscriptQuery(self.values) if model is CuratedTranscript else CountQuery(self)

    now = datetime(2026, 7, 25, tzinfo=timezone.utc)
    values = [transcript(1, "Zebra", "scam", "Hard", now), transcript(2, "Alpha", "grooming", "Easy", now.replace(day=24)), transcript(3, "Middle", "scam", "Medium", now.replace(day=23))]
    scam = list_scenarios(search=None, category=[ScenarioCategory.SCAM], difficulty=[], render_skin=[], sort="shortest", page=1, limit=1, db=Db(values), _=None)
    assert scam.total == 2 and [item.id for item in scam.items] == [3]
    title = list_scenarios(search="summary", category=[], difficulty=[], render_skin=[], sort="title", page=1, limit=2, db=Db(values), _=None)
    assert [item.title for item in title.items] == ["Alpha", "Middle"]
    item = title.items[0]
    assert "tactic_tags" not in item.model_dump() and set(item.model_dump()) == set(PublishedScenarioOut.model_fields)
