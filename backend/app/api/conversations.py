"""Public conversations API — the messaging layer visible to end users."""
from __future__ import annotations

import random
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.models.orm import Conversation, UserMessage, User, get_db
from app.repositories import content_repo

router = APIRouter(prefix="/api/conversations", tags=["Conversations"])

# ── Pydantic schemas ──────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: int
    sender: str
    content: str
    timestamp: datetime
    is_read: bool
    model_config = {"from_attributes": True}


class ConversationOut(BaseModel):
    id: int
    contact_name: str
    contact_avatar: Optional[str]
    status: str
    last_message_at: Optional[datetime]
    unread_count: int
    last_message: Optional[str]
    model_config = {"from_attributes": True}


class ConversationDetailOut(BaseModel):
    id: int
    contact_name: str
    contact_avatar: Optional[str]
    status: str
    messages: list[MessageOut]
    model_config = {"from_attributes": True}


class SendMessageRequest(BaseModel):
    content: str


class AcceptRequestBody(BaseModel):
    scenario_id: str
    difficulty: str = "Medium"


class PatchConversationBody(BaseModel):
    status: str  # "active" | "archived"


# ── Helpers ───────────────────────────────────────────────────────────────────

CONTACT_NAMES = ["Alex", "Jamie", "Sam", "Casey", "Jordan", "Taylor", "Morgan", "Riley", "Avery", "Quinn"]
AVATAR_COLORS = ["#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"]

def _generate_contact_name() -> str:
    return random.choice(CONTACT_NAMES)

def _generate_avatar_color() -> str:
    return random.choice(AVATAR_COLORS)


def _conv_summary(conv: Conversation) -> ConversationOut:
    visible = [m for m in conv.messages if conv.status != "deleted"]
    last    = visible[-1] if visible else None
    unread  = sum(1 for m in visible if not m.is_read and m.sender == "contact")
    return ConversationOut(
        id=conv.id,
        contact_name=conv.contact_name,
        contact_avatar=conv.contact_avatar,
        status=conv.status,
        last_message_at=conv.last_message_at,
        unread_count=unread,
        last_message=last.content[:80] if last else None,
    )


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/", response_model=list[ConversationOut])
def list_conversations(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_id == current_user.id, Conversation.status != "deleted")
        .order_by(Conversation.last_message_at.desc().nullslast())
        .all()
    )
    return [_conv_summary(c) for c in convs]


@router.post("/", response_model=ConversationOut, status_code=status.HTTP_201_CREATED)
def accept_request(
    body: AcceptRequestBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Accept a new message request — starts a conversation for a scenario."""
    scenario = content_repo.get_scenario(db, body.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found")

    # Generate a contact identity from the persona
    persona = content_repo.get_persona(db, scenario.persona)
    contact_name = persona.display_name if persona else _generate_contact_name()
    avatar = f"color:{_generate_avatar_color()}"

    conv = Conversation(
        user_id=current_user.id,
        scenario_id=body.scenario_id,
        contact_name=contact_name,
        contact_avatar=avatar,
        difficulty=body.difficulty,
        engine_state={},
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return _conv_summary(conv)


@router.get("/requests", response_model=list[dict])
def get_message_requests(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Return scenarios not yet started by this user as pending message requests."""
    started_ids = {
        c.scenario_id
        for c in db.query(Conversation.scenario_id)
               .filter(Conversation.user_id == current_user.id)
               .all()
    }
    scenarios = content_repo.list_scenarios(db)
    available = [s for s in scenarios if s.id not in started_ids]

    # Build request cards — strip internal metadata
    result = []
    for s in available:
        persona = content_repo.get_persona(db, s.persona)
        contact_name = persona.display_name if persona else _generate_contact_name()
        result.append({
            "scenario_id": s.id,
            "contact_name": contact_name,
            "contact_avatar": f"color:{_generate_avatar_color()}",
            "preview": f"{contact_name} wants to connect with you.",
            "difficulty": s.difficulty,
        })
    return result


@router.get("/{conv_id}", response_model=ConversationDetailOut)
def get_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == current_user.id
    ).first()
    if not conv or conv.status == "deleted":
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Mark contact messages as read
    for m in conv.messages:
        if m.sender == "contact" and not m.is_read:
            m.is_read = True
    db.commit()

    return ConversationDetailOut(
        id=conv.id, contact_name=conv.contact_name,
        contact_avatar=conv.contact_avatar, status=conv.status,
        messages=conv.messages,
    )


@router.post("/{conv_id}/message", response_model=MessageOut)
async def send_message(
    conv_id: int,
    body: SendMessageRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a user message and get the contact's reply via the dialogue engine."""
    from app.engine.conversation_state import ConversationState
    from app.engine.dialogue_policy import DialoguePolicyEngine
    from app.engine.prompt_builder import PromptBuilder
    from app.engine.state_updater import StateUpdater
    from app.engine.validator import Validator
    from app.main import llm_service

    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == current_user.id
    ).first()
    if not conv or conv.status == "deleted":
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Store user message
    user_msg = UserMessage(
        conversation_id=conv_id, sender="user",
        content=body.content, is_read=True,
    )
    db.add(user_msg)
    db.commit()

    scenario = content_repo.get_scenario(db, conv.scenario_id)
    if not scenario or not llm_service:
        raise HTTPException(status_code=503, detail="Engine not available")

    # Deserialize state
    if not conv.engine_state:
        # Initialize
        first_step = scenario.stage_sequence[0] if scenario.stage_sequence else None
        first_obj = ""
        if first_step:
            if first_step.mandatory_objectives:
                first_obj = first_step.mandatory_objectives[0]
            elif first_step.optional_objectives:
                first_obj = first_step.optional_objectives[0]

        state = ConversationState(
            session_id=conv.id,
            scenario_id=scenario.id,
            difficulty=conv.difficulty,
            current_stage=scenario.starting_stage,
            stage_sequence_index=0,
            current_objective=first_obj,
        )
    else:
        state = ConversationState.from_db_dict(conv.engine_state)

    state.add_message(sender="user", content=body.content)

    # Build a temporary loader for the engine
    from app.engine.scenario_loader import ScenarioLoader as _Loader
    from pathlib import Path
    _loader = _Loader(Path("/tmp"))
    _loader._scenarios = {s.id: s for s in content_repo.list_scenarios(db)}
    _loader._personas  = {p.id: p for p in content_repo.list_personas(db)}
    _loader._stages    = {s.id: s for s in content_repo.list_stages(db)}
    _loader._objectives= {o.id: o for o in content_repo.list_objectives(db)}
    _loader._constraints={c.id: c for c in content_repo.list_constraints(db)}
    _loader._prompt_templates = {t.name: t for t in content_repo.list_prompts(db)}

    policy_engine = DialoguePolicyEngine(_loader)
    try:
        decision = policy_engine.decide(state)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    prompt_builder = PromptBuilder(_loader)
    prompt = prompt_builder.build(scenario.prompt_template, decision.prompt_blocks)

    try:
        raw_output = await llm_service.generate(system_prompt=prompt, user_message=body.content)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    _validator = Validator()
    known_stage_ids = list(_loader._stages.keys())
    validation_result = _validator.validate(
        raw_output=raw_output,
        known_stage_ids=known_stage_ids,
        valid_next_stages=decision.valid_next_stages,
        active_constraints=decision.active_constraints,
    )

    if not validation_result.valid:
        # Fallback response
        from app.models.schemas import LLMOutputSchema
        llm_output = LLMOutputSchema(
            reply="Hmm, let me think about that... What else are you up to today?",
            current_stage=state.current_stage,
            next_stage=state.current_stage,
            current_objective=state.current_objective,
            objective_completed=False,
            trust_delta=0,
            suspicion_delta=0,
            flags=["validation_failure"],
            reasoning=f"Validation failed: {validation_result.errors}",
            confidence=0.0
        )
    else:
        llm_output = validation_result.output

    diff_modifier = scenario.difficulty_modifiers.get(state.difficulty)
    trust_multiplier = diff_modifier.trust_delta_multiplier if diff_modifier else 1.0

    state_updater = StateUpdater(policy_engine)
    state = state_updater.apply(state, llm_output, trust_multiplier)

    conv.engine_state = state.to_db_dict()
    conv.last_message_at = datetime.now(timezone.utc)

    contact_msg = UserMessage(
        conversation_id=conv_id, sender="contact",
        content=llm_output.reply, is_read=False,
        metadata_json=llm_output.model_dump(),
    )
    db.add(contact_msg)
    db.commit()
    db.refresh(contact_msg)

    return contact_msg


@router.patch("/{conv_id}", response_model=ConversationOut)
def patch_conversation(
    conv_id: int,
    body: PatchConversationBody,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    if body.status not in ("active", "archived"):
        raise HTTPException(status_code=400, detail="Invalid status")
    conv.status = body.status
    db.commit()
    db.refresh(conv)
    return _conv_summary(conv)


@router.delete("/{conv_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_conversation(
    conv_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conv = db.query(Conversation).filter(
        Conversation.id == conv_id, Conversation.user_id == current_user.id
    ).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    conv.status = "deleted"
    db.commit()
