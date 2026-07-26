"""Authenticated, safety-scaffolded companion endpoints for family sessions."""
from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.companion.persona import DISCLOSURE_SUPPORT_MESSAGE, SENSITIVE_CONTENT_REDIRECT
from app.companion.resources import resources_for
from app.companion.safety import contains_explicit_content, is_real_disclosure, redact_personal_info, requests_antagonist_roleplay
from app.companion.service import build_companion_context, generate_attempt_feedback, generate_companion_response
from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.llm.llm_service import LLMService
from app.models.orm import (
    CheckpointResponse, CompanionExchange, CuratedMessage, CuratedSceneElement,
    CuratedTranscript, FamilySession, FamilySessionParticipant, FlagAttempt,
    RedFlagSpan, SessionProgress, User, ValidatedFinding, get_db,
)
from app.models.schemas import (
    CheckpointResponseOut, CompanionCheckpointOut, CompanionCheckpointRequest,
    CompanionExplainOut, CompanionExplainRequest, FindingVisibility, FlagAttemptOut,
    FlagAttemptRequest, FlagValidationResult, HintOut, HintRequest, ParticipantRole,
    SessionProgressOut, ValidatedFindingOut,
)

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


def _load_participant_session(session_id: int, user: User, db: Session) -> tuple[FamilySession, FamilySessionParticipant]:
    session = db.get(FamilySession, session_id)
    participant = db.query(FamilySessionParticipant).filter(
        FamilySessionParticipant.family_session_id == session_id,
        FamilySessionParticipant.user_id == user.id,
        FamilySessionParticipant.left_at.is_(None),
    ).first()
    if not session or not participant:
        raise HTTPException(404, "Family session not found")
    if session.completed_at or session.state in {"abandoned", "expired"}:
        raise HTTPException(409, "This family session is no longer active")
    return session, participant


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


def _target(session: FamilySession, element_key: str, db: Session) -> CuratedSceneElement:
    target = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.element_key == element_key,
    ).first()
    if not target:
        raise HTTPException(422, "The selected item does not belong to this session")
    if not target.selectable:
        raise HTTPException(422, "This item cannot be inspected")
    if target.sequence > session.revealed_up_to:
        raise HTTPException(409, "Reveal this item before inspecting it")
    return target


def _annotations(session: FamilySession, target: CuratedSceneElement, db: Session) -> list[RedFlagSpan]:
    source = db.get(CuratedMessage, target.source_message_id) if target.source_message_id else None
    query = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == session.transcript_id)
    if source:
        query = query.filter(or_(RedFlagSpan.scene_element_id == target.id, RedFlagSpan.message_sequence == source.sequence))
    else:
        query = query.filter(RedFlagSpan.scene_element_id == target.id)
    return query.order_by(RedFlagSpan.id).all()


def _findings(session: FamilySession, db: Session, element_id: int | None = None) -> list[ValidatedFindingOut]:
    query = db.query(ValidatedFinding, CuratedSceneElement, RedFlagSpan).join(
        CuratedSceneElement, CuratedSceneElement.id == ValidatedFinding.element_id
    ).join(RedFlagSpan, RedFlagSpan.id == ValidatedFinding.red_flag_span_id).filter(
        ValidatedFinding.family_session_id == session.id
    )
    if element_id is not None:
        query = query.filter(ValidatedFinding.element_id == element_id)
    return [ValidatedFindingOut(
        element_key=element.element_key, annotation_id=span.id, tactic_tag=span.tactic_tag,
        explanation=span.child_safe_explanation, discovered_at=finding.discovered_at.isoformat(),
        visibility=FindingVisibility(finding.visibility),
    ) for finding, element, span in query.order_by(ValidatedFinding.discovered_at, ValidatedFinding.id).all()]


def _progress(session: FamilySession, db: Session) -> SessionProgressOut:
    progress = db.get(SessionProgress, session.id)
    return SessionProgressOut(
        reviewed_element_count=progress.reviewed_element_count if progress else 0,
        validated_finding_count=progress.validated_finding_count if progress else 0,
        eligible_target_count=progress.eligible_target_count if progress else 0,
        required_finding_count=progress.required_finding_count if progress else 0,
        checkpoint_progress=progress.checkpoint_progress if progress else 0,
        content_progress=progress.content_progress if progress else 0,
        completion_ready=bool(progress and progress.completion_ready),
    )


def _attempt_out(attempt: FlagAttempt, target: CuratedSceneElement, session: FamilySession, db: Session) -> FlagAttemptOut:
    feedback = attempt.feedback_snapshot or {}
    return FlagAttemptOut(
        id=attempt.id, element_key=target.element_key, claim=attempt.claim,
        validation_result=FlagValidationResult(attempt.validation_result), feedback=feedback,
        disclosure_triggered=attempt.disclosure_state == "triggered", created_at=attempt.created_at.isoformat(),
        findings=_findings(session, db, target.id), progress=_progress(session, db),
    )


async def _respond(session: FamilySession, category: str, child_text: str, context: list[CuratedMessage], llm: LLMService, prompt: str | None = None):
    if is_real_disclosure(child_text):
        session.disclosure_flagged = True
        return DISCLOSURE_SUPPORT_MESSAGE, True, resources_for(category)
    if contains_explicit_content(child_text):
        return SENSITIVE_CONTENT_REDIRECT, False, resources_for(category)
    if requests_antagonist_roleplay(child_text):
        return "The scenario messages are already part of the activity, so I won't role-play that person. What would you want to do if a message felt uncomfortable?", False, []
    return await generate_companion_response(llm, child_text, context, prompt), False, []


@router.post("/sessions/{family_session_id}/flag-attempts", response_model=FlagAttemptOut, status_code=status.HTTP_201_CREATED)
async def submit_flag_attempt(
    family_session_id: int, body: FlagAttemptRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), llm: LLMService = Depends(get_llm_service),
):
    session, participant = _load_participant_session(family_session_id, current_user, db)
    target = _target(session, body.element_key, db)
    existing = db.query(FlagAttempt).filter(
        FlagAttempt.family_session_id == session.id, FlagAttempt.client_command_id == body.client_command_id,
    ).first()
    if existing:
        if existing.element_id != target.id or existing.claim != body.claim:
            raise HTTPException(409, "A command ID cannot be reused for another flag attempt")
        return _attempt_out(existing, target, session, db)

    annotations = _annotations(session, target, db)
    sanitized_reasoning = redact_personal_info(body.reasoning)
    disclosure = is_real_disclosure(body.reasoning)
    is_concerning = bool(annotations)
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(404, "Scenario not found")
    from app.models.schemas import ScenarioCategory
    allowed_tags = [span.tactic_tag for span in annotations if span.tactic_tag in TACTIC_TAGS_BY_CATEGORY[ScenarioCategory(transcript.category)]]
    if disclosure:
        session.disclosure_flagged = True
        feedback = {
            "acknowledgment": "Thank you for telling me.", "reasoning_assessment": "You deserve support.",
            "red_flag_result": is_concerning, "explanation": "We can pause this activity and focus on support.",
            "tactic_tags": allowed_tags if is_concerning else [], "next_hint_or_action": "Reach out to a trusted adult when it is safe.",
            "response_text": DISCLOSURE_SUPPORT_MESSAGE, "support_resources": resources_for(transcript.category), "fallback": True,
        }
        result = "needs_support"
    elif current_user.id == session.child_user_id:
        revealed = db.query(CuratedSceneElement).filter(
            CuratedSceneElement.transcript_id == session.transcript_id,
            CuratedSceneElement.sequence <= session.revealed_up_to,
        ).order_by(CuratedSceneElement.sequence, CuratedSceneElement.id).all()
        exchanges = db.query(CompanionExchange).filter(
            CompanionExchange.family_session_id == session.id, CompanionExchange.disclosure_triggered.is_(False)
        ).order_by(CompanionExchange.created_at, CompanionExchange.id).all()
        context = build_companion_context(
            transcript=transcript, revealed_elements=revealed, selected_element=target, annotations=annotations,
            claim=body.claim, reasoning=sanitized_reasoning, exchanges=exchanges,
            current_findings=[finding.model_dump() for finding in _findings(session, db)], channel="private_child",
        )
        feedback = await generate_attempt_feedback(
            llm, context, is_concerning=is_concerning,
            explanations=[span.child_safe_explanation or "" for span in annotations], allowed_tags=allowed_tags, claim=body.claim,
        )
        db.add(CompanionExchange(family_session_id=session.id, exchange_type="flag_attempt", child_text=sanitized_reasoning,
            companion_text=feedback["response_text"], disclosure_triggered=False))
        result = "validated" if is_concerning else "not_a_flag"
    else:
        # A caregiver may contribute a shared attempt, but never receives the child's private companion context.
        from app.companion.service import deterministic_attempt_feedback
        feedback = deterministic_attempt_feedback(is_concerning=is_concerning,
            explanations=[span.child_safe_explanation or "" for span in annotations], allowed_tags=allowed_tags, claim=body.claim)
        result = "validated" if is_concerning else "not_a_flag"

    attempt = FlagAttempt(family_session_id=session.id, participant_id=participant.id, element_id=target.id,
        sanitized_reasoning=sanitized_reasoning, claimed_red_flag=body.claim == "red_flag", claim=body.claim,
        client_command_id=body.client_command_id, validation_result=result, feedback_snapshot=feedback,
        disclosure_state="triggered" if disclosure else "none")
    db.add(attempt)
    if is_concerning:
        for annotation in annotations:
            finding = db.query(ValidatedFinding).filter(
                ValidatedFinding.family_session_id == session.id, ValidatedFinding.element_id == target.id,
                ValidatedFinding.red_flag_span_id == annotation.id,
            ).first()
            if not finding:
                db.add(ValidatedFinding(family_session_id=session.id, participant_id=participant.id, element_id=target.id,
                    red_flag_span_id=annotation.id, visibility="shared"))
    db.flush()
    progress = db.get(SessionProgress, session.id)
    if progress:
        progress.validated_finding_count = db.query(ValidatedFinding).filter(ValidatedFinding.family_session_id == session.id).count()
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt, target, session, db)


@router.post("/sessions/{family_session_id}/hints", response_model=HintOut)
def request_hint(
    family_session_id: int, body: HintRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    session, _ = _load_participant_session(family_session_id, current_user, db)
    target = _target(session, body.element_key, db)
    prior = db.query(CompanionExchange).filter(
        CompanionExchange.family_session_id == session.id,
        CompanionExchange.exchange_type.like(f"hint:{target.element_key}:%"),
    ).count()
    level = prior + 1
    annotations = _annotations(session, target, db)
    hints = [hint for span in annotations for hint in (span.tiered_hints or [])]
    generic = [
        "Read this item closely and notice whether it asks you to rush or share something personal.",
        "Think about boundaries: does this leave room to say no and talk to a trusted adult?",
        "Consider what a safe next step could be if this made you uncomfortable.",
    ]
    hint = hints[min(level - 1, len(hints) - 1)] if hints else generic[min(level - 1, len(generic) - 1)]
    db.add(CompanionExchange(family_session_id=session.id, exchange_type=f"hint:{target.element_key}:{level}",
        child_text="", companion_text=hint, disclosure_triggered=False))
    db.commit()
    return HintOut(element_key=target.element_key, hint_level=level, hint=hint)


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
