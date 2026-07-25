"""Authenticated, safety-scaffolded companion endpoints for family sessions."""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.auth.security import get_current_user
from app.companion.persona import DISCLOSURE_SUPPORT_MESSAGE, SENSITIVE_CONTENT_REDIRECT
from app.companion.resources import resources_for
from app.companion.safety import contains_explicit_content, is_real_disclosure, redact_personal_info, requests_antagonist_roleplay
from app.companion.service import generate_companion_response
from app.llm.llm_service import LLMService
from app.models.orm import CheckpointResponse, CompanionExchange, CuratedMessage, FamilySession, User, get_db
from app.models.schemas import (CheckpointResponseOut, CompanionCheckpointOut, CompanionCheckpointRequest,
    CompanionExplainOut, CompanionExplainRequest, ParticipantRole)

router = APIRouter(prefix="/api/companion", tags=["Companion AI"])

def get_llm_service() -> LLMService:
    from app.main import llm_service
    if llm_service is None:
        raise HTTPException(503, "The companion is unavailable right now.")
    return llm_service

def _load_child_session(session_id: int, user: User, db: Session) -> FamilySession:
    session = db.get(FamilySession, session_id)
    if not session or session.child_user_id != user.id:
        raise HTTPException(404, "Family session not found")
    if session.completed_at:
        raise HTTPException(409, "Family session is already complete")
    return session

def _out(response: CheckpointResponse) -> CheckpointResponseOut:
    return CheckpointResponseOut(id=response.id, checkpoint_message_id=response.checkpoint_message_id,
        responder_role=ParticipantRole(response.responder_role), response_text=response.response_text,
        flagged_message_ids=response.flagged_message_ids or [], tactic_tag_guess=response.tactic_tag_guess,
        created_at=response.created_at.isoformat())

def _checkpoint(session: FamilySession, checkpoint_id: int, db: Session) -> CuratedMessage:
    checkpoint = db.query(CuratedMessage).filter(CuratedMessage.id == checkpoint_id,
        CuratedMessage.transcript_id == session.transcript_id, CuratedMessage.is_checkpoint.is_(True)).first()
    if not checkpoint:
        raise HTTPException(422, "Checkpoint message does not belong to this session")
    return checkpoint

def _validate_flags(session: FamilySession, ids: list[int], db: Session) -> None:
    if not ids:
        return
    found = {item[0] for item in db.query(CuratedMessage.id).filter(
        CuratedMessage.transcript_id == session.transcript_id, CuratedMessage.id.in_(ids)).all()}
    if found != set(ids):
        raise HTTPException(422, "A flagged message does not belong to this session")

async def _respond(session: FamilySession, category: str, child_text: str, context: list[CuratedMessage], llm: LLMService, prompt: str | None = None):
    if is_real_disclosure(child_text):
        session.disclosure_flagged = True
        return DISCLOSURE_SUPPORT_MESSAGE, True, resources_for(category)
    if contains_explicit_content(child_text):
        return SENSITIVE_CONTENT_REDIRECT, False, resources_for(category)
    if requests_antagonist_roleplay(child_text):
        return "The scenario messages are already part of the activity, so I won't role-play that person. What would you want to do if a message felt uncomfortable?", False, []
    return await generate_companion_response(llm, child_text, context, prompt), False, []

@router.post("/sessions/{family_session_id}/checkpoint", response_model=CompanionCheckpointOut, status_code=status.HTTP_201_CREATED)
async def companion_checkpoint(family_session_id: int, body: CompanionCheckpointRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), llm: LLMService = Depends(get_llm_service)):
    session = _load_child_session(family_session_id, current_user, db)
    if not session.companion_mode:
        raise HTTPException(422, "Companion checkpoint responses require companion mode")
    checkpoint = _checkpoint(session, body.checkpoint_message_id, db)
    _validate_flags(session, body.flagged_message_ids, db)
    context = db.query(CuratedMessage).filter(CuratedMessage.transcript_id == session.transcript_id,
        CuratedMessage.sequence <= checkpoint.sequence).order_by(CuratedMessage.sequence).all()
    response_text, disclosure, resources = await _respond(session, checkpoint.transcript.category, body.child_response_text,
        context, llm, checkpoint.checkpoint_prompt)
    child = CheckpointResponse(family_session_id=session.id, checkpoint_message_id=checkpoint.id,
        responder_role=ParticipantRole.CHILD.value, response_text=redact_personal_info(body.child_response_text),
        flagged_message_ids=body.flagged_message_ids, tactic_tag_guess=body.tactic_tag_guess)
    companion = CheckpointResponse(family_session_id=session.id, checkpoint_message_id=checkpoint.id,
        responder_role=ParticipantRole.AI_COMPANION.value, response_text=response_text, flagged_message_ids=[], tactic_tag_guess=None)
    db.add_all([child, companion])
    db.commit(); db.refresh(child); db.refresh(companion)
    return CompanionCheckpointOut(response_text=response_text, child_response=_out(child), checkpoint_response=_out(companion),
        disclosure_triggered=disclosure, support_resources=resources)

@router.post("/sessions/{family_session_id}/explain", response_model=CompanionExplainOut)
async def explain_reasoning(family_session_id: int, body: CompanionExplainRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), llm: LLMService = Depends(get_llm_service)):
    session = _load_child_session(family_session_id, current_user, db)
    context = db.query(CuratedMessage).filter(CuratedMessage.transcript_id == session.transcript_id,
        CuratedMessage.sequence <= session.revealed_up_to).order_by(CuratedMessage.sequence).all()
    first = context[0] if context else db.query(CuratedMessage).filter(CuratedMessage.transcript_id == session.transcript_id).order_by(CuratedMessage.sequence).first()
    if not first:
        raise HTTPException(404, "Scenario messages not found")
    response_text, disclosure, resources = await _respond(session, first.transcript.category, body.message, context, llm)
    db.add(CompanionExchange(family_session_id=session.id, exchange_type="explain", child_text=redact_personal_info(body.message),
        companion_text=response_text, disclosure_triggered=disclosure))
    db.commit()
    return CompanionExplainOut(response_text=response_text, disclosure_triggered=disclosure, support_resources=resources)
