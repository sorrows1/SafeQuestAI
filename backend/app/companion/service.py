"""Companion generation with a fixed persona and server-derived curated context."""
from collections.abc import Sequence
from fastapi import HTTPException
from app.companion.persona import COMPANION_SYSTEM_PROMPT
from app.companion.safety import redact_personal_info
from app.llm.llm_service import LLMService
from app.models.orm import CuratedMessage

def curated_context(messages: Sequence[CuratedMessage]) -> str:
    return "\n".join(f"Scenario message {m.sequence} ({m.speaker_label}): {m.content}" for m in messages)

async def generate_companion_response(llm: LLMService, child_text: str, messages: Sequence[CuratedMessage], checkpoint_prompt: str | None = None) -> str:
    user_message = (f"Reviewed scenario context:\n{curated_context(messages)}\n\n"
        f"Checkpoint prompt: {checkpoint_prompt or 'Invite the child to think aloud.'}\n\n"
        f"Child's thought (identifiers removed): {redact_personal_info(child_text)}")
    try:
        result = await llm.generate(COMPANION_SYSTEM_PROMPT, user_message)
    except Exception as exc:
        raise HTTPException(502, "The companion is unavailable right now. Please try again shortly.") from exc
    response = result.get("response_text") if isinstance(result, dict) else None
    if not isinstance(response, str) or not response.strip():
        raise HTTPException(502, "The companion returned an invalid response.")
    return redact_personal_info(response.strip())
