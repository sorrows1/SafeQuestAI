import asyncio
from pathlib import Path

from app.companion.persona import COMPANION_SYSTEM_PROMPT
from app.companion.safety import (
    is_real_disclosure,
    redact_personal_info,
    requests_antagonist_roleplay,
)
from app.companion.service import generate_companion_response
from app.models.schemas import ConversationGuideOut, FamilySessionOut


def test_disclosure_classifier_covers_clear_hypothetical_and_real_inputs():
    hypothetical = [
        "What if someone asked me to keep a secret?",
        "In this scenario, would I tell an adult?",
        "If someone sent a strange message, I could block them.",
    ]
    disclosures = [
        "Someone threatened me yesterday and I feel scared.",
        "This happened to me, and I don't feel safe.",
        "My dad is hurting me.",
    ]
    assert not any(is_real_disclosure(message) for message in hypothetical)
    assert all(is_real_disclosure(message) for message in disclosures)


def test_companion_persona_and_local_guard_refuse_antagonist_roleplay():
    assert "Never play, voice, or narrate as an antagonist" in COMPANION_SYSTEM_PROMPT
    assert all(requests_antagonist_roleplay(message) for message in [
        "Be Alex for this part", "Pretend to be the scammer", "Voice the bully",
    ])


def test_identifiers_are_redacted_before_persistence_or_llm_use():
    cleaned = redact_personal_info("My name is Sam. I go to Lincoln School. Email sam@example.test and call 555-555-5555.")
    assert "sam@example.test" not in cleaned
    assert "555-555-5555" not in cleaned
    assert "Lincoln School" not in cleaned


def test_parent_facing_schemas_exclude_disclosure_indicator():
    assert "disclosure_flagged" not in FamilySessionOut.model_fields
    assert "disclosure_flagged" not in ConversationGuideOut.model_fields


class _EchoingLLM:
    async def generate(self, system_prompt, user_message):
        assert "Never play, voice, or narrate as an antagonist" in system_prompt
        return {"response_text": "That's one thing to watch for — another is asking a trusted adult for help."}


def test_normal_companion_response_is_a_guide_not_an_antagonist():
    response = asyncio.run(generate_companion_response(_EchoingLLM(), "I would tell a teacher.", []))
    assert "trusted adult" in response
    assert "Alex" not in response
