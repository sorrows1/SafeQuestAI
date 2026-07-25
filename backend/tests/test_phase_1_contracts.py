import pytest
from pydantic import ValidationError

from app.models.schemas import GenerationMode, ScenarioCategory, ScenarioDefinition
from app.repositories.content_repo import validate_scenario_references


def test_dual_agent_scenarios_require_canonical_bindings() -> None:
    with pytest.raises(ValidationError, match="initiator.persona_id"):
        ScenarioDefinition(id="incomplete", display_name="Incomplete", description="", starting_stage="opening")
    scenario = ScenarioDefinition(
        id="canonical", display_name="Canonical", description="", starting_stage="opening",
        initiator={"persona_id": "initiator", "dialogue_prompt_id": "initiator_dialogue"},
        respondent={"persona_id": "respondent", "dialogue_prompt_id": "respondent_dialogue"},
    )
    assert scenario.initiator.persona_id == "initiator"
    assert scenario.respondent.persona_id == "respondent"


def test_oversharing_requires_single_pass_mode() -> None:
    with pytest.raises(ValidationError, match="single_pass"):
        ScenarioDefinition(
            id="oversharing", display_name="Oversharing", description="", starting_stage="opening", category=ScenarioCategory.OVERSHARING,
        )


def test_reference_validation_reports_actor_and_stage_problems() -> None:
    class EmptyDatabase:
        def get(self, model, key):
            return None

    scenario = ScenarioDefinition(
        id="broken", display_name="Broken", description="", starting_stage="missing", initiator={"persona_id": "missing", "dialogue_prompt_id": "initiator"}, respondent={"persona_id": "missing", "dialogue_prompt_id": "respondent"}
    )
    with pytest.raises(ValueError, match="initiator.persona_id.*does not exist"):
        validate_scenario_references(EmptyDatabase(), scenario)
