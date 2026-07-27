"""Authenticated, safety-scaffolded companion endpoints for family sessions."""
from __future__ import annotations

from datetime import datetime, timezone
from hashlib import sha256

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.config.rollout import FeatureFlag, require_feature
from app.telemetry import record as telemetry_record
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
from app.api.family_sessions import _emit_event
from app.models.schemas import (
    CheckpointResponseOut, CompanionCheckpointOut, CompanionCheckpointRequest,
    CompanionExplainOut, CompanionExplainRequest, FindingVisibility, FlagAttemptOut,
    FlagAttemptRequest, FlagValidationResult, HintOut, HintRequest, ParticipantRole,
    SessionProgressOut, ValidatedFindingOut, SharedCompanionFeedbackRequest, SharedCompanionFeedbackOut,
    FamilySessionEventType,
)

router = APIRouter(prefix="/api/companion", tags=["Companion AI"])


def get_llm_service() -> LLMService | None:
    """Provider outages fall back to deterministic reviewed-content guidance."""
    from app.main import llm_service
    return llm_service


def _load_child_session(session_id: int | str, user: User, db: Session) -> FamilySession:
    session = None
    if isinstance(session_id, int) or (isinstance(session_id, str) and session_id.isdigit()):
        session = db.get(FamilySession, int(session_id))
    if not session:
        session = db.query(FamilySession).filter(FamilySession.public_id == str(session_id)).first()
    if not session or session.child_user_id != user.id:
        raise HTTPException(404, "Family session not found")
    if session.completed_at:
        raise HTTPException(409, "Family session is already complete")
    return session


def _load_participant_session(session_id: int | str, user: User, db: Session) -> tuple[FamilySession, FamilySessionParticipant]:
    session = None
    if isinstance(session_id, int) or (isinstance(session_id, str) and session_id.isdigit()):
        session = db.get(FamilySession, int(session_id))
    if not session:
        session = db.query(FamilySession).filter(FamilySession.public_id == str(session_id)).first()
    if not session:
        raise HTTPException(404, "Family session not found")
    participant = db.query(FamilySessionParticipant).filter(
        FamilySessionParticipant.family_session_id == session.id,
        FamilySessionParticipant.user_id == user.id,
        FamilySessionParticipant.left_at.is_(None),
    ).first()
    if not participant:
        raise HTTPException(404, "Family session not found")
    if session.completed_at or session.state in {"abandoned", "expired"}:
        raise HTTPException(409, "This family session is no longer active")
    return session, participant


def _out(response: CheckpointResponse) -> CheckpointResponseOut:
    return CheckpointResponseOut(id=response.id, checkpoint_message_id=response.checkpoint_message_id,
        responder_role=ParticipantRole(response.responder_role), response_text=response.response_text,
        flagged_message_ids=response.flagged_message_ids or [], tactic_tag_guess=response.tactic_tag_guess,
        created_at=response.created_at.isoformat(), visibility=FindingVisibility(response.visibility or "private"))


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
    grouped: dict[str, dict] = {}
    for finding, element, span in query.order_by(ValidatedFinding.discovered_at, ValidatedFinding.id).all():
        # Curators may annotate the same tactic and explanation on several scene
        # instances. Learners see one durable lesson with every supporting item.
        tactic_tag = span.tactic_tag.strip().casefold()
        explanation = " ".join((span.child_safe_explanation or "").split())
        normalized = f"{tactic_tag}\n{explanation.casefold()}"
        insight_key = sha256(normalized.encode("utf-8")).hexdigest()[:24]
        group = grouped.setdefault(insight_key, {
            "element_key": element.element_key, "annotation_id": span.id,
            "tactic_tag": span.tactic_tag, "explanation": span.child_safe_explanation,
            "element_keys": [], "annotation_ids": [], "discovered_at": finding.discovered_at,
            "visibility": FindingVisibility(finding.visibility),
        })
        if element.element_key not in group["element_keys"]:
            group["element_keys"].append(element.element_key)
        if span.id not in group["annotation_ids"]:
            group["annotation_ids"].append(span.id)
        if finding.discovered_at < group["discovered_at"]:
            group["discovered_at"] = finding.discovered_at
    return [ValidatedFindingOut(
        insight_key=key, element_key=item["element_key"], annotation_id=item["annotation_id"],
        tactic_tag=item["tactic_tag"], explanation=item["explanation"],
        element_keys=item["element_keys"], annotation_ids=item["annotation_ids"],
        discovered_at=item["discovered_at"].isoformat(), visibility=item["visibility"],
    ) for key, item in grouped.items()]


def _progress(session: FamilySession, db: Session) -> SessionProgressOut:
    progress = db.get(SessionProgress, session.id)
    merged_finding_count = len(_findings(session, db))
    return SessionProgressOut(
        reviewed_element_count=progress.reviewed_element_count if progress else 0,
        validated_finding_count=merged_finding_count,
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


async def _respond(session: FamilySession, category: str, child_text: str, context: list[CuratedMessage], llm: LLMService | None, prompt: str | None = None):
    if is_real_disclosure(child_text):
        session.disclosure_flagged = True
        return DISCLOSURE_SUPPORT_MESSAGE, True, resources_for(category)
    if contains_explicit_content(child_text):
        return SENSITIVE_CONTENT_REDIRECT, False, resources_for(category)
    if requests_antagonist_roleplay(child_text):
        return "The scenario messages are already part of the activity, so I won't role-play that person. What would you want to do if a message felt uncomfortable?", False, []
    if llm is None:
        telemetry_record("companion.fallback", reason="provider_unavailable", channel="checkpoint")
        return "Let’s pause and look at what the message asks for. You can choose a boundary and talk with someone you trust.", False, resources_for(category)
    try:
        return await generate_companion_response(llm, child_text, context, prompt), False, []
    except Exception:
        telemetry_record("companion.fallback", reason="provider_failure", channel="checkpoint")
        return "Let’s pause and look at what the message asks for. You can choose a boundary and talk with someone you trust.", False, resources_for(category)


@router.post("/sessions/{family_session_id}/flag-attempts", response_model=FlagAttemptOut, status_code=status.HTTP_201_CREATED)
async def submit_flag_attempt(
    family_session_id: str, body: FlagAttemptRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), llm: LLMService | None = Depends(get_llm_service),
):
    require_feature(FeatureFlag.FLAG_ATTEMPTS)
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
    explicit_content = contains_explicit_content(body.reasoning)
    is_concerning = bool(annotations)
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(404, "Scenario not found")
    from app.models.schemas import ScenarioCategory
    allowed_tags = [span.tactic_tag for span in annotations if span.tactic_tag in TACTIC_TAGS_BY_CATEGORY[ScenarioCategory(transcript.category)]]
    created_findings: list[tuple[ValidatedFinding, RedFlagSpan]] = []
    if disclosure:
        session.disclosure_flagged = True
        feedback = {
            "acknowledgment": "Thank you for telling me.", "reasoning_assessment": "You deserve support.",
            "red_flag_result": is_concerning, "explanation": "We can pause this activity and focus on support.",
            "tactic_tags": list(dict.fromkeys(allowed_tags)) if is_concerning else [], "next_hint_or_action": "Reach out to a trusted adult when it is safe.",
            "response_text": DISCLOSURE_SUPPORT_MESSAGE, "support_resources": resources_for(transcript.category), "fallback": True,
        }
        result = "needs_support"
    elif explicit_content:
        feedback = {
            "acknowledgment": "Thanks for checking in.",
            "reasoning_assessment": "You do not need to share private or explicit details here.",
            "red_flag_result": is_concerning,
            "explanation": "We can keep this discussion focused on safe next steps and support.",
            "tactic_tags": list(dict.fromkeys(allowed_tags)) if is_concerning else [],
            "next_hint_or_action": "Talk with a trusted adult when it is safe.",
            "response_text": SENSITIVE_CONTENT_REDIRECT,
            "support_resources": resources_for(transcript.category), "fallback": True,
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
        from app.companion.service import deterministic_attempt_feedback
        try:
            if llm is None:
                raise RuntimeError("companion provider unavailable")
            feedback = await generate_attempt_feedback(
                llm, context, is_concerning=is_concerning,
                explanations=[span.child_safe_explanation or "" for span in annotations], allowed_tags=allowed_tags, claim=body.claim,
            )
        except Exception:
            telemetry_record("companion.fallback", reason="provider_failure", channel="flag_attempt")
            feedback = deterministic_attempt_feedback(is_concerning=is_concerning,
                explanations=[span.child_safe_explanation or "" for span in annotations], allowed_tags=allowed_tags, claim=body.claim)
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
        disclosure_state="triggered" if disclosure else "none",
        visibility="shared" if participant.role == "caregiver" or body.share_reasoning_with_caregiver else "private")
    db.add(attempt)
    if is_concerning:
        for annotation in annotations:
            finding = db.query(ValidatedFinding).filter(
                ValidatedFinding.family_session_id == session.id, ValidatedFinding.element_id == target.id,
                ValidatedFinding.red_flag_span_id == annotation.id,
            ).first()
            if not finding:
                finding = ValidatedFinding(family_session_id=session.id, participant_id=participant.id, element_id=target.id,
                    red_flag_span_id=annotation.id, visibility="shared")
                db.add(finding)
                created_findings.append((finding, annotation))
    db.flush()
    _emit_event(db, session, FamilySessionEventType.ATTEMPT_SUBMITTED, {
        "element_key": target.element_key, "claim": body.claim, "validation_result": result,
    }, actor_participant=participant)
    for finding, annotation in created_findings:
        _emit_event(db, session, FamilySessionEventType.FINDING_VALIDATED, {
            "element_key": target.element_key, "annotation_id": annotation.id,
            "tactic_tag": annotation.tactic_tag, "explanation": annotation.child_safe_explanation,
        }, actor_participant=participant)
    progress = db.get(SessionProgress, session.id)
    if progress:
        # Learner-visible progress follows merged insights, never raw annotation rows.
        progress.validated_finding_count = len(_findings(session, db))
    db.commit()
    db.refresh(attempt)
    return _attempt_out(attempt, target, session, db)


@router.post("/sessions/{family_session_id}/hints", response_model=HintOut)
def request_hint(
    family_session_id: str, body: HintRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user),
):
    require_feature(FeatureFlag.FLAG_ATTEMPTS)
    session, _ = _load_participant_session(family_session_id, current_user, db)
    if current_user.id != session.child_user_id:
        raise HTTPException(403, "Private companion hints are available only to the learner")
    target = _target(session, body.element_key, db)
    prior_records = db.query(CompanionExchange).filter(
        CompanionExchange.family_session_id == session.id,
        CompanionExchange.exchange_type.like(f"hint:{target.element_key}:%"),
    ).order_by(CompanionExchange.created_at, CompanionExchange.id).all()
    annotations = _annotations(session, target, db)
    hints = [hint for span in annotations for hint in (span.tiered_hints or [])]
    generic = [
        "Read this item closely and notice whether it asks you to rush or share something personal.",
        "Think about boundaries: does this leave room to say no and talk to a trusted adult?",
        "Consider what a safe next step could be if this made you uncomfortable.",
    ]
    ladder = list(dict.fromkeys(hints or generic))
    # The hint ladder is finite and durable for this revealed element.
    if len(prior_records) >= len(ladder):
        return HintOut(element_key=target.element_key, hint_level=len(ladder), hint=prior_records[-1].companion_text)
    level = len(prior_records) + 1
    hint = ladder[level - 1]
    db.add(CompanionExchange(family_session_id=session.id, exchange_type=f"hint:{target.element_key}:{level}",
        child_text="", companion_text=hint, disclosure_triggered=False))
    db.commit()
    telemetry_record("companion.hint", channel="private_child")
    return HintOut(element_key=target.element_key, hint_level=level, hint=hint)


@router.post("/sessions/{family_session_id}/checkpoint", response_model=CompanionCheckpointOut, status_code=status.HTTP_201_CREATED)
async def companion_checkpoint(family_session_id: str, body: CompanionCheckpointRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), llm: LLMService | None = Depends(get_llm_service)):
    session = _load_child_session(family_session_id, current_user, db)
    checkpoint = _checkpoint(session, body.checkpoint_message_id, db)
    _validate_flags(session, body.flagged_message_ids, db)
    context = db.query(CuratedMessage).filter(CuratedMessage.transcript_id == session.transcript_id,
        CuratedMessage.sequence <= checkpoint.sequence).order_by(CuratedMessage.sequence).all()
    response_text, disclosure, resources = await _respond(session, checkpoint.transcript.category, body.child_response_text,
        context, llm, checkpoint.checkpoint_prompt)
    child = CheckpointResponse(family_session_id=session.id, checkpoint_message_id=checkpoint.id,
        responder_role=ParticipantRole.CHILD.value, response_text=redact_personal_info(body.child_response_text),
        flagged_message_ids=body.flagged_message_ids, tactic_tag_guess=body.tactic_tag_guess,
        visibility="private", client_command_id=body.client_command_id)
    companion = CheckpointResponse(family_session_id=session.id, checkpoint_message_id=checkpoint.id,
        responder_role=ParticipantRole.AI_COMPANION.value, response_text=response_text, flagged_message_ids=[], tactic_tag_guess=None,
        visibility="private")
    db.add_all([child, companion])
    db.flush()
    _emit_event(db, session, FamilySessionEventType.CHECKPOINT_RESPONSE, {
        "checkpoint_message_id": checkpoint.id, "responder_role": "child", "shared": False,
    }, actor_participant=session_participant(session, current_user.id, db))
    db.commit(); db.refresh(child); db.refresh(companion)
    return CompanionCheckpointOut(response_text=response_text, child_response=_out(child), checkpoint_response=_out(companion),
        disclosure_triggered=disclosure, support_resources=resources)


@router.post("/sessions/{family_session_id}/explain", response_model=CompanionExplainOut)
async def explain_reasoning(family_session_id: str, body: CompanionExplainRequest, db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user), llm: LLMService | None = Depends(get_llm_service)):
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


@router.post("/sessions/{family_session_id}/shared-feedback", response_model=SharedCompanionFeedbackOut)
async def request_shared_feedback(
    family_session_id: str,
    body: SharedCompanionFeedbackRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    llm: LLMService | None = Depends(get_llm_service),
):
    """Create a server-authored explanation the learner explicitly chose to share."""
    session = _load_child_session(family_session_id, current_user, db)
    exchange_type = f"shared:{body.client_command_id[-20:]}"
    existing = db.query(CompanionExchange).filter(
        CompanionExchange.family_session_id == session.id,
        CompanionExchange.exchange_type == exchange_type,
    ).first()
    if existing:
        return SharedCompanionFeedbackOut(
            response_text=existing.companion_text,
            element_key=body.element_key,
            shared=existing.visibility == "shared",
            support_resources=[],
        )
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(404, "Scenario not found")
    target = _target(session, body.element_key, db) if body.element_key else None
    context = db.query(CuratedMessage).filter(
        CuratedMessage.transcript_id == session.transcript_id,
        CuratedMessage.sequence <= session.revealed_up_to,
    ).order_by(CuratedMessage.sequence).all()
    response_text, disclosure, resources = await _respond(
        session, transcript.category, body.message, context, llm,
        "Give a short child-safe explanation that can be shared with a caregiver. Do not mention private disclosures.",
    )
    exchange = CompanionExchange(
        family_session_id=session.id,
        exchange_type=exchange_type,
        child_text=redact_personal_info(body.message),
        companion_text=response_text,
        disclosure_triggered=disclosure,
        visibility="private" if disclosure else "shared",
        shared_at=None if disclosure else datetime.now(timezone.utc),
    )
    db.add(exchange)
    db.flush()
    if not disclosure:
        _emit_event(db, session, FamilySessionEventType.COMPANION_SHARED_FEEDBACK, {
            "element_key": target.element_key if target else None,
            "response_text": response_text,
        }, actor_participant=session_participant(session, current_user.id, db))
    db.commit()
    return SharedCompanionFeedbackOut(
        response_text=response_text,
        element_key=target.element_key if target else None,
        shared=not disclosure,
        support_resources=resources,
    )
