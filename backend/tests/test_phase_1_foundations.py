import importlib.util
import sys
from pathlib import Path

from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.orm import ConversationGuide
from app.models.schemas import (
    GenerationMode,
    RenderSkin,
    ScenarioCategory,
    ScenarioDefinition,
)


def test_all_categories_and_skins_are_representable() -> None:
    assert set(ScenarioCategory) == set(TACTIC_TAGS_BY_CATEGORY)
    assert set(RenderSkin) == {RenderSkin.CHAT, RenderSkin.EMAIL, RenderSkin.SOCIAL_FEED, RenderSkin.GAME_CHAT, RenderSkin.FORUM, RenderSkin.MARKETPLACE}

    scenario = ScenarioDefinition(
        id="oversharing-test",
        display_name="Oversharing test",
        description="A feed-shaped scenario.",
        starting_stage="opening",
        authoring={"persona_id": "sample-persona", "dialogue_prompt_id": "authoring-prompt"},
        category=ScenarioCategory.OVERSHARING,
        render_skin=RenderSkin.SOCIAL_FEED,
        generation_mode=GenerationMode.SINGLE_PASS,
    )
    assert scenario.category is ScenarioCategory.OVERSHARING


def test_conversation_guide_has_no_scoring_columns() -> None:
    prohibited = {"score", "grade", "accuracy", "mistakes"}
    assert prohibited.isdisjoint(ConversationGuide.__table__.columns.keys())


def test_seed_dry_run_validates_offline_without_opening_a_database(monkeypatch) -> None:
    script = Path(__file__).resolve().parents[1] / "scripts" / "migrate_json_to_db.py"
    spec = importlib.util.spec_from_file_location("phase_one_seed_content", script)
    assert spec and spec.loader
    seed_content = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = seed_content
    spec.loader.exec_module(seed_content)

    def fail_if_opened():
        raise AssertionError("dry-run must not open a database session")

    monkeypatch.setattr(seed_content, "SessionLocal", fail_if_opened)
    counts = seed_content.seed(dry_run=True)

    content = seed_content.load_seed_content()
    assert counts["demo_fixtures"]["unchanged"] == len(content.demo_fixtures)
    assert counts["scenarios"]["unchanged"] == len(content.scenarios)
