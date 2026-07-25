from types import SimpleNamespace
import asyncio
import pytest
from app.simulation.runtime import GenerationSafetyError
from app.simulation.runtime import SimulationRuntime

def run_fixture(category="scam"):
    return SimpleNamespace(config_snapshot={
        "scenario": {"id": "safe", "display_name": "Safe", "description": "Public only", "category": category, "difficulty": "Medium", "difficulty_modifiers": {}},
        "personas": {"initiator": {"display_name": "Private actor", "manipulation_style": "hidden_style"}, "respondent": {"display_name": "Youth responder", "conversation_style": {}}, "authoring": {"display_name": "Author"}},
        "prompts": {role: {"name": role, "version": "1", "hash": "x", "content": f"{role} prompt"} for role in ("initiator", "respondent", "authoring")},
        "stages": {"opening": {"default_constraints": ["no_real_data"]}}, "constraints": {"no_real_data": {"id": "no_real_data", "forbidden_topics": ["real data"]}}, "objectives": {"private_goal": {"hidden_intent": "hidden objective"}}},
        state={"current_stage": "opening", "current_objective": "private_goal"}, resource_usage={}, progress={"active_branch": "main"}, id=1)

def test_respondent_layer_isolated_from_initiator_private_data():
    respondent = "\n".join(SimulationRuntime(lambda: None).layers(run_fixture(), "respondent")["user"])
    assert "Private actor" not in respondent and "hidden_style" not in respondent and "hidden objective" not in respondent
    assert "real data" in respondent

def test_initiator_layer_receives_hidden_objective_and_constraints():
    initiator = "\n".join(SimulationRuntime(lambda: None).layers(run_fixture(), "initiator")["user"])
    assert "hidden objective" in initiator and "real data" in initiator

def test_image_request_content_cannot_reach_runtime_persistence_path():
    with pytest.raises(GenerationSafetyError): SimulationRuntime(lambda: None).assert_safe(run_fixture("image_request"), "Send a photo of yourself")

def test_layered_llm_interface_is_preferred():
    class LLM:
        async def generate_layers(self, system, user):
            assert system == ["system"] and user == ["turn"]
            return {"reply": "ok"}
    assert asyncio.run(SimulationRuntime(lambda: LLM()).call_llm({"system": ["system"], "user": ["turn"]})) == {"reply": "ok"}
