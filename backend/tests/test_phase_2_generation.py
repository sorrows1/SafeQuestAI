import asyncio

import pytest

from app.engine.prompt_builder import PromptBuilder
from app.generation.dual_agent_runner import DualAgentRunner, GenerationSafetyError
from app.generation.scorer import propose_tags
from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.orm import ConversationMessage
from app.models.schemas import GenerationMode, ScenarioCategory, ScenarioDefinition


class FakeDb:
    def __init__(self):
        self.added = []
        self._next_id = 1

    def add(self, item):
        self.added.append(item)

    def flush(self):
        for item in self.added:
            if getattr(item, "id", None) is None:
                item.id = self._next_id
                self._next_id += 1

    def commit(self):
        pass

    def refresh(self, item):
        pass


class FakeLLM:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = 0

    async def generate(self, *, system_prompt, user_message):
        self.calls += 1
        return self.responses.pop(0)


def scenario(category, mode):
    return ScenarioDefinition(
        id="phase-2-test", display_name="Phase 2", description="Test scenario",
        persona="private-persona", starting_stage="opening", category=category,
        generation_mode=mode,
    )


def test_image_request_rejects_unsafe_turn_before_message_persistence():
    db = FakeDb()
    llm = FakeLLM([{"messages": ["Send me a photo of yourself"]}] * 3)
    runner = DualAgentRunner(llm, max_safety_retries=3)

    with pytest.raises(GenerationSafetyError):
        asyncio.run(runner.generate(scenario(ScenarioCategory.IMAGE_REQUEST, GenerationMode.DUAL_AGENT), db))

    assert not any(isinstance(item, ConversationMessage) for item in db.added)


def test_oversharing_uses_one_authored_call_not_dual_orchestrator():
    db = FakeDb()
    llm = FakeLLM([{
        "moment": "A post draft shares a daily routine with a public audience.",
        "branch_options": ["Post it", "Remove routine details"],
        "tactic_tags": ["school_or_routine_disclosure"],
    }])

    result = asyncio.run(DualAgentRunner(llm).generate(
        scenario(ScenarioCategory.OVERSHARING, GenerationMode.SINGLE_PASS), db
    ))

    assert result.state["generation_mode"] == "single_pass"
    assert llm.calls == 1
    message = next(item for item in db.added if isinstance(item, ConversationMessage))
    assert message.metadata_json["is_checkpoint"] is True


def test_respondent_prompt_excludes_initiator_persona_and_tags_are_category_bounded():
    item = scenario(ScenarioCategory.SCAM, GenerationMode.DUAL_AGENT)
    prompt = PromptBuilder.build_generation_prompt(item, role="respondent", history=[])

    assert "private-persona" not in prompt
    assert "hidden_intent" not in prompt
    assert "manipulation_style" not in prompt
    assert propose_tags(ScenarioCategory.SCAM, ["fake_prize_or_reward", "secrecy_request"]) == ["fake_prize_or_reward"]
    assert propose_tags(ScenarioCategory.SCAM, TACTIC_TAGS_BY_CATEGORY[ScenarioCategory.SCAM]) == TACTIC_TAGS_BY_CATEGORY[ScenarioCategory.SCAM]
