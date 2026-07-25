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
    assert set(RenderSkin) == {RenderSkin.CHAT, RenderSkin.EMAIL, RenderSkin.SOCIAL_FEED}

    scenario = ScenarioDefinition(
        id="oversharing-test",
        display_name="Oversharing test",
        description="A feed-shaped scenario.",
        persona="sample-persona",
        starting_stage="opening",
        category=ScenarioCategory.OVERSHARING,
        render_skin=RenderSkin.SOCIAL_FEED,
        generation_mode=GenerationMode.SINGLE_PASS,
    )
    assert scenario.category is ScenarioCategory.OVERSHARING


def test_conversation_guide_has_no_scoring_columns() -> None:
    prohibited = {"score", "grade", "accuracy", "mistakes"}
    assert prohibited.isdisjoint(ConversationGuide.__table__.columns.keys())
