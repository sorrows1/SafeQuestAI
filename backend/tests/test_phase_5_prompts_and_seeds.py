"""Phase 5 contract coverage for canonical prompts, seeds, and safe fixtures."""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path
from types import SimpleNamespace

from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.schemas import GenerationMode, ScenarioCategory
from app.simulation.runtime import SimulationRuntime


_SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "migrate_json_to_db.py"
_SPEC = importlib.util.spec_from_file_location("seed_content", _SCRIPT)
assert _SPEC and _SPEC.loader
seed_content = importlib.util.module_from_spec(_SPEC)
sys.modules[_SPEC.name] = seed_content
_SPEC.loader.exec_module(seed_content)


def test_canonical_seed_content_is_complete_and_mode_specific():
    content = seed_content.load_seed_content()
    seed_content._validate_seed_references(content)

    scenarios = {scenario.id: scenario for scenario in content.scenarios}
    assert set(scenarios) == {"gaming_chat_boundary_pressure", "pause_before_posting"}
    assert scenarios["gaming_chat_boundary_pressure"].generation_mode is GenerationMode.DUAL_AGENT
    assert scenarios["gaming_chat_boundary_pressure"].initiator is not None
    assert scenarios["gaming_chat_boundary_pressure"].respondent is not None
    assert scenarios["pause_before_posting"].generation_mode is GenerationMode.SINGLE_PASS
    assert scenarios["pause_before_posting"].authoring is not None
    assert scenarios["pause_before_posting"].initiator is None
    assert scenarios["pause_before_posting"].respondent is None


def test_prompt_audit_uses_exact_metadata_aware_templates():
    content = seed_content.load_seed_content()
    prompts = {prompt.name: prompt for prompt in content.prompts}
    assert {(name, prompt.kind, prompt.role_scope) for name, prompt in prompts.items()} == {
        ("simulation_initiator_system", "system", "initiator"),
        ("simulation_respondent_system", "system", "respondent"),
        ("single_pass_authoring_system", "system", "authoring"),
        ("initiator_realistic_dialogue", "dialogue", "initiator"),
        ("respondent_natural_dialogue", "dialogue", "respondent"),
        ("oversharing_decision_authoring", "single_pass", "authoring"),
    }


def test_fixture_message_elements_reuse_actor_keys_per_speaker():
    fixture = {
        "messages": [
            {"sequence": 0, "speaker_label": "Nova", "content": "Hello"},
            {"sequence": 1, "speaker_label": "Riley", "content": "Hi"},
            {"sequence": 2, "speaker_label": "Nova", "content": "Ready?"},
        ]
    }

    elements = seed_content._fixture_scene_elements(fixture)

    assert [element["actor_key"] for element in elements] == [
        "speaker-nova", "speaker-riley", "speaker-nova"
    ]


def test_demo_fixtures_are_reviewed_unpublished_and_taxonomy_bounded():
    content = seed_content.load_seed_content()
    fixtures = {fixture["source_scenario_id"]: fixture for fixture in content.demo_fixtures}
    assert set(fixtures) == {"gaming_chat_boundary_pressure", "pause_before_posting"}
    for fixture in fixtures.values():
        assert fixture["reviewed_at"]
        assert fixture["public_metadata"]
        category = ScenarioCategory(fixture["category"])
        assert set(fixture["tactic_tags"]).issubset(TACTIC_TAGS_BY_CATEGORY[category])
        assert all(span["tactic_tag"] in TACTIC_TAGS_BY_CATEGORY[category] for span in fixture["red_flag_spans"])


def test_demo_red_flags_target_initiator_style_messages_not_respondent_messages():
    content = seed_content.load_seed_content()
    for fixture in content.demo_fixtures:
        messages = {message["sequence"]: message for message in fixture["messages"]}
        assert all(messages[span["message_sequence"]]["speaker_label"] != "Riley" for span in fixture["red_flag_spans"])


def test_runtime_layers_include_role_system_prompt_and_isolate_respondent():
    run = SimpleNamespace(
        config_snapshot={
            "scenario": {"id": "gaming", "display_name": "Gaming", "description": "Public", "category": "image_request", "difficulty": "Medium", "difficulty_modifiers": {}},
            "personas": {"initiator": {"display_name": "Hidden contact"}, "respondent": {"display_name": "Riley"}},
            "prompts": {"initiator": {"content": "initiator dialogue"}, "respondent": {"content": "respondent dialogue"}},
            "system_prompts": {"initiator": {"content": "initiator system"}, "respondent": {"content": "respondent system"}},
            "stages": {"opening": {"default_constraints": []}}, "constraints": {},
            "objectives": {"hidden": {"hidden_intent": "private objective"}},
        },
        state={"current_stage": "opening", "current_objective": "hidden"},
    )
    runtime = SimulationRuntime(lambda: None)
    respondent = runtime.layers(run, "respondent")
    initiator = runtime.layers(run, "initiator")
    assert respondent["system"] == ["respondent system", "respondent dialogue"]
    assert "Hidden contact" not in "\n".join(respondent["user"])
    assert "private objective" not in "\n".join(respondent["user"])
    assert initiator["system"] == ["initiator system", "initiator dialogue"]
    assert "private objective" in "\n".join(initiator["user"])
