"""Authenticated family scenario routes; this player path makes no LLM calls."""
from __future__ import annotations

from datetime import datetime, timezone
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.family.guide_builder import build_conversation_guide
from app.models.orm import (
    CheckpointResponse,
    CompanionExchange,
    ConversationGuide,
    CuratedMessage,
    CuratedSceneElement,
    CuratedTranscript,
    FamilySession,
    FamilySessionCommand,
    FamilySessionParticipant,
    SessionProgress,
    RedFlagSpan,
    User,
    ValidatedFinding,
    get_db,
)
from app.api.family_links import active_relationship_for_ref, member_ref, session_participant
from app.models.schemas import (
    CheckpointResponseOut,
    CheckpointResponseRequest,
    ConversationGuideOut,
    CreateFamilySessionRequest,
    FamilyMessageOut,
    FamilyRole,
    FamilySceneOut,
    FamilySessionDetailOut,
    FamilySessionCapabilitiesOut,
    FamilySessionCommandRequest,
    FamilySessionCommandType,
    FamilySessionOut,
    FamilySessionParticipantOut,
    SceneActor,
    SceneElementOut,
    SessionProgressOut,
    ValidatedFindingOut,
    ParticipantRole,
    PublishedScenarioOut,
    PublishedScenarioPageOut,
    RenderSkin,
    ScenarioCategory,
)

router = APIRouter(prefix="/api/family", tags=["Family Sessions"])


def _timestamp(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _session_out(session: FamilySession) -> FamilySessionOut:
    return FamilySessionOut(
        id=session.id,
        public_id=session.public_id,
        owner_ref=member_ref(session.owner_user_id or session.child_user_id),
        transcript_id=session.transcript_id,
        parent_user_id=session.parent_user_id,
        companion_mode=session.companion_mode,
        # Kept only for old clients; detection is mandatory in all new sessions.
        detective_mode=True,
        started_at=_timestamp(session.started_at) or "",
        completed_at=_timestamp(session.completed_at),
        state=session.state,
        state_version=session.state_version,
        revealed_up_to=session.revealed_up_to,
        active_checkpoint_element_key=session.active_checkpoint_element_key,
        participation_turn_user_id=session.participation_turn_user_id,
        completion_acknowledged_at=_timestamp(session.completion_acknowledged_at),
        attempt_number=session.attempt_number,
        previous_session_id=session.previous_session_id,
        updated_at=_timestamp(session.updated_at),
    )


def _message_out(message: CuratedMessage) -> FamilyMessageOut:
    return FamilyMessageOut(
        id=message.id, sequence=message.sequence, speaker_label=message.speaker_label,
        content=message.content, pace=message.pace, is_checkpoint=message.is_checkpoint,
        checkpoint_prompt=message.checkpoint_prompt,
    )


def _scene_out(session: FamilySession, transcript: CuratedTranscript, db: Session) -> FamilySceneOut:
    elements = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == transcript.id, CuratedSceneElement.sequence <= session.revealed_up_to
    ).order_by(CuratedSceneElement.sequence, CuratedSceneElement.id).all()
    messages = db.query(CuratedMessage).filter(
        CuratedMessage.transcript_id == transcript.id, CuratedMessage.sequence <= session.revealed_up_to
    ).order_by(CuratedMessage.sequence).all()
    # Answer annotations are intentionally not read here.
    message_labels = {message.id: message.speaker_label for message in messages}
    actor_keys = {f"actor-{message_id}": label for message_id, label in message_labels.items()}
    actor_keys.update({element.actor_key: message_labels.get(element.source_message_id, element.actor_key) for element in elements if element.actor_key})
    return FamilySceneOut(
        render_skin=RenderSkin(transcript.render_skin),
        actors=[SceneActor(actor_key=key, display_name=label) for key, label in actor_keys.items()],
        supported_actions=["select", "request_hint"],
        elements=[SceneElementOut(
            element_key=item.element_key, element_type=item.element_type,
            parent_element_key=item.parent_element_key, source_message_id=item.source_message_id,
            sequence=item.sequence, content=item.content, actor_key=item.actor_key or (f"actor-{item.source_message_id}" if item.source_message_id else None),
            timestamp_semantics=item.timestamp_semantics, timestamp=item.timestamp, relationships=item.relationships or [],
            presentation=item.presentation or {},
            selectable=item.selectable, accessible_label=item.accessible_label, semantic_role=item.semantic_role,
        ) for item in elements],
        messages=[_message_out(message) for message in messages],
    )


def _guide_out(guide: ConversationGuide) -> ConversationGuideOut:
    return ConversationGuideOut(
        id=guide.id,
        family_session_id=guide.family_session_id,
        scenario_summary=guide.scenario_summary,
        child_reasoning_excerpt=guide.child_reasoning_excerpt or {},
        discussion_prompts=guide.discussion_prompts or [],
        completed_together=guide.completed_together,
        generated_at=_timestamp(guide.generated_at) or "",
    )


def _load_session(session_id: int, current_user: User, db: Session) -> FamilySession:
    session = db.get(FamilySession, session_id)
    if not session or not session_participant(session, current_user.id, db):
        raise HTTPException(status_code=404, detail="Family session not found")
    return session


def _published_scenario_out(transcript: CuratedTranscript, db: Session) -> PublishedScenarioOut:
    """Return only frozen, reviewed metadata; never re-read authoring content."""
    snapshot = transcript.public_metadata_snapshot or {}
    category = str(snapshot.get("category") or transcript.category)
    render_skin = str(snapshot.get("render_skin") or transcript.render_skin)
    difficulty = str(snapshot.get("difficulty") or transcript.difficulty)
    title = str(snapshot.get("display_name") or "Reviewed online-safety scenario")
    summary = str(snapshot.get("description") or "A reviewed situation for a calm family conversation.")
    tags = [str(tag) for tag in snapshot.get("tags", []) if isinstance(tag, str)]
    learning_objectives = [str(item) for item in snapshot.get("learning_objectives", []) if isinstance(item, str)]
    message_count = db.query(CuratedMessage).filter(CuratedMessage.transcript_id == transcript.id).count()
    checkpoint_count = db.query(CuratedMessage).filter(
        CuratedMessage.transcript_id == transcript.id, CuratedMessage.is_checkpoint.is_(True)
    ).count()
    return PublishedScenarioOut(
        id=transcript.id, title=title, summary=summary, category=ScenarioCategory(category),
        render_skin=RenderSkin(render_skin), difficulty=difficulty, tags=tags,
        learning_objectives=learning_objectives, message_count=message_count,
        checkpoint_count=checkpoint_count,
        published_at=_timestamp(transcript.published_at) or _timestamp(transcript.reviewed_at) or "",
        supported_participation_modes=["with_parent", "with_companion"],
    )


@router.get("/scenarios", response_model=PublishedScenarioPageOut)
def list_scenarios(
    search: str | None = Query(default=None, max_length=200),
    category: list[ScenarioCategory] = Query(default=[]),
    difficulty: list[str] = Query(default=[]),
    render_skin: list[RenderSkin] = Query(default=[]),
    sort: Literal["newest", "title", "difficulty", "shortest"] = "newest",
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=12, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    # The library is intentionally assembled from curated transcript snapshots.
    # Filtering in Python keeps JSON handling portable across SQLite/PostgreSQL.
    items = [_published_scenario_out(item, db) for item in db.query(CuratedTranscript).filter(
        CuratedTranscript.is_published.is_(True)
    ).all()]
    normalized_search = (search or "").strip().casefold()
    if normalized_search:
        items = [item for item in items if normalized_search in f"{item.title} {item.summary}".casefold()]
    if category:
        allowed_categories = set(category)
        items = [item for item in items if item.category in allowed_categories]
    if difficulty:
        allowed_difficulties = {value.casefold() for value in difficulty}
        items = [item for item in items if item.difficulty.casefold() in allowed_difficulties]
    if render_skin:
        allowed_skins = set(render_skin)
        items = [item for item in items if item.render_skin in allowed_skins]
    difficulty_order = {"easy": 0, "medium": 1, "hard": 2}
    if sort == "title":
        items.sort(key=lambda item: item.title.casefold())
    elif sort == "difficulty":
        items.sort(key=lambda item: (difficulty_order.get(item.difficulty.casefold(), 99), item.title.casefold()))
    elif sort == "shortest":
        items.sort(key=lambda item: (item.message_count, item.title.casefold()))
    else:
        items.sort(key=lambda item: item.published_at, reverse=True)
    total = len(items)
    start = (page - 1) * limit
    return PublishedScenarioPageOut(items=items[start:start + limit], total=total, page=page, limit=limit)


@router.get("/scenarios/{transcript_id}", response_model=PublishedScenarioOut)
def get_scenario_detail(
    transcript_id: int,
    db: Session = Depends(get_db),
    _: User = Depends(get_current_user),
):
    transcript = db.query(CuratedTranscript).filter(
        CuratedTranscript.id == transcript_id, CuratedTranscript.is_published.is_(True)
    ).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Published scenario not found")
    return _published_scenario_out(transcript, db)


@router.post("/scenarios/{transcript_id}/sessions", response_model=FamilySessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    transcript_id: int,
    body: CreateFamilySessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = db.query(CuratedTranscript).filter(
        CuratedTranscript.id == transcript_id, CuratedTranscript.is_published.is_(True)
    ).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Published scenario not found")
    relationship = active_relationship_for_ref(db, body.relationship_ref, current_user.id) if body.relationship_ref else None
    caregiver_id = relationship.caregiver_user_id if relationship else None
    if relationship and relationship.learner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the learner may start a shared family session")
    session = FamilySession(
        public_id=f"fs_{secrets.token_urlsafe(18)}", owner_user_id=current_user.id,
        transcript_id=transcript.id, child_user_id=current_user.id, parent_user_id=caregiver_id,
        companion_mode=caregiver_id is None, state="waiting_for_participants" if caregiver_id else "in_progress",
    )
    db.add(session)
    db.flush()
    db.add(FamilySessionParticipant(family_session_id=session.id, user_id=current_user.id, role="learner"))
    if caregiver_id is not None:
        db.add(FamilySessionParticipant(family_session_id=session.id, user_id=caregiver_id, role="caregiver"))
    eligible = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == transcript.id).count()
    content_count = db.query(CuratedSceneElement).filter(CuratedSceneElement.transcript_id == transcript.id).count()
    db.add(SessionProgress(family_session_id=session.id, eligible_target_count=eligible, required_finding_count=eligible, content_progress=content_count))
    db.commit()
    db.refresh(session)
    return _session_out(session)



def _completion_ready(session: FamilySession, db: Session) -> bool:
    last_sequence = db.query(CuratedSceneElement.sequence).filter(CuratedSceneElement.transcript_id == session.transcript_id).order_by(CuratedSceneElement.sequence.desc()).first()
    if last_sequence is None or session.revealed_up_to < last_sequence[0] or session.active_checkpoint_element_key:
        return False
    checkpoint_ids = {row[0] for row in db.query(CuratedMessage.id).filter(CuratedMessage.transcript_id == session.transcript_id, CuratedMessage.is_checkpoint.is_(True)).all()}
    answered_ids = {row[0] for row in db.query(CheckpointResponse.checkpoint_message_id).filter(CheckpointResponse.family_session_id == session.id).all()}
    return checkpoint_ids.issubset(answered_ids)


def _progress_out(session: FamilySession, db: Session) -> SessionProgressOut:
    progress = db.get(SessionProgress, session.id)
    ready = _completion_ready(session, db)
    return SessionProgressOut(
        reviewed_element_count=progress.reviewed_element_count if progress else 0,
        validated_finding_count=progress.validated_finding_count if progress else 0,
        eligible_target_count=progress.eligible_target_count if progress else 0,
        required_finding_count=progress.required_finding_count if progress else 0,
        checkpoint_progress=progress.checkpoint_progress if progress else 0,
        content_progress=progress.content_progress if progress else 0,
        completion_ready=ready,
    )


def _refresh_completion_ready(session: FamilySession, db: Session) -> SessionProgress | None:
    progress = db.get(SessionProgress, session.id)
    if progress:
        progress.completion_ready = _completion_ready(session, db)
    return progress


def _participant_role(session: FamilySession, current_user: User, db: Session) -> FamilyRole:
    participant = session_participant(session, current_user.id, db)
    if not participant:
        raise HTTPException(status_code=404, detail="Family session not found")
    return FamilyRole(participant.role)


def _participant_out(member: FamilySessionParticipant, db: Session) -> FamilySessionParticipantOut:
    user = db.get(User, member.user_id)
    return FamilySessionParticipantOut(
        member_ref=member_ref(member.user_id), display_name=user.display_name if user else "Family member",
        avatar_url=user.avatar_url if user else None, role=FamilyRole(member.role),
        joined_at=_timestamp(member.joined_at) or "", last_seen_at=_timestamp(member.last_seen_at), left_at=_timestamp(member.left_at),
    )


def _findings_out(session: FamilySession, db: Session) -> list[ValidatedFindingOut]:
    rows = db.query(ValidatedFinding, CuratedSceneElement, RedFlagSpan).join(
        CuratedSceneElement, CuratedSceneElement.id == ValidatedFinding.element_id
    ).join(RedFlagSpan, RedFlagSpan.id == ValidatedFinding.red_flag_span_id).filter(
        ValidatedFinding.family_session_id == session.id
    ).order_by(ValidatedFinding.discovered_at, ValidatedFinding.id).all()
    return [ValidatedFindingOut(
        element_key=element.element_key, annotation_id=span.id, tactic_tag=span.tactic_tag,
        explanation=span.child_safe_explanation, discovered_at=_timestamp(finding.discovered_at) or "",
        visibility=finding.visibility,
    ) for finding, element, span in rows]


def _session_detail_out(session: FamilySession, current_user: User, db: Session) -> FamilySessionDetailOut:
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Scenario not found")
    next_element_exists = db.query(CuratedSceneElement.id).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.sequence > session.revealed_up_to,
    ).first() is not None
    progress = _progress_out(session, db)
    review_acknowledged = session.completion_acknowledged_at is not None
    capabilities = FamilySessionCapabilitiesOut(
        can_reveal_next=session.state == "in_progress" and session.active_checkpoint_element_key is None and next_element_exists,
        can_continue_checkpoint=session.state == "checkpoint" and session.active_checkpoint_element_key is not None,
        can_enter_completion_review=session.state == "in_progress" and progress.completion_ready,
        can_acknowledge_completion=session.state == "completion_review" and not review_acknowledged,
        can_open_help=session.state == "completion_review" and review_acknowledged,
        can_complete=session.state in {"completion_review", "help_and_resources"} and review_acknowledged,
        can_reset=session.state not in {"paused_for_support", "expired"},
        can_submit_flag_attempt=session.state in {"in_progress", "checkpoint"},
        can_request_hint=session.state in {"in_progress", "checkpoint"},
        can_use_private_companion=_participant_role(session, current_user, db) is FamilyRole.LEARNER and session.state not in {"completed", "expired", "abandoned"},
        can_join_or_observe=_participant_role(session, current_user, db) is FamilyRole.CAREGIVER,
        can_contribute_shared_prompts=not session.companion_mode and session.state not in {"completed", "expired", "abandoned"},
        can_review_shared_results=not session.companion_mode and session.state in {"completion_review", "help_and_resources", "completed"},
        can_invite_before_start=current_user.id == (session.owner_user_id or session.child_user_id) and session.state == "waiting_for_participants",
        can_remove_before_start=current_user.id == (session.owner_user_id or session.child_user_id) and session.state == "waiting_for_participants",
        can_leave=True,
    )
    members = db.query(FamilySessionParticipant).filter(FamilySessionParticipant.family_session_id == session.id).order_by(FamilySessionParticipant.id).all()
    return FamilySessionDetailOut(
        session=_session_out(session), scene=_scene_out(session, transcript, db), progress=progress,
        participants=[_participant_out(member, db) for member in members],
        participant_role=_participant_role(session, current_user, db), capabilities=capabilities,
        findings=_findings_out(session, db),
    )


def _stale_state(session: FamilySession, current_user: User, db: Session, message: str) -> None:
    raise HTTPException(status_code=409, detail={"message": message, "current": _session_detail_out(session, current_user, db).model_dump(mode="json")})


def _complete_session(session: FamilySession, db: Session) -> ConversationGuide:
    existing = db.query(ConversationGuide).filter(ConversationGuide.family_session_id == session.id).first()
    if existing:
        return existing
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Scenario not found")
    spans = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == transcript.id).all()
    responses = db.query(CheckpointResponse).filter(CheckpointResponse.family_session_id == session.id).order_by(CheckpointResponse.created_at, CheckpointResponse.id).all()
    companion_exchanges = db.query(CompanionExchange).filter(CompanionExchange.family_session_id == session.id).order_by(CompanionExchange.created_at, CompanionExchange.id).all()
    guide = ConversationGuide(family_session_id=session.id, **build_conversation_guide(session, transcript.category, spans, responses, companion_exchanges))
    session.state = "completed"
    session.completed_at = session.completed_at or datetime.now(timezone.utc)
    session.state_version += 1
    db.add(guide)
    return guide


@router.get("/sessions/{session_id}", response_model=FamilySessionDetailOut)
def get_session_detail(session_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = _load_session(session_id, current_user, db)
    return _session_detail_out(session, current_user, db)



@router.post("/sessions/{session_id}/commands", response_model=FamilySessionDetailOut)
def command_session(
    session_id: int,
    body: FamilySessionCommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    existing = db.query(FamilySessionCommand).filter(
        FamilySessionCommand.family_session_id == session.id,
        FamilySessionCommand.client_command_id == body.client_command_id,
    ).first()
    if existing:
        if existing.command != body.command.value:
            _stale_state(session, current_user, db, "A command ID cannot be reused for another command")
        result = db.get(FamilySession, existing.resulting_session_id)
        if not result:
            _stale_state(session, current_user, db, "The original command result is unavailable")
        return _session_detail_out(result, current_user, db)
    if body.expected_state_version != session.state_version:
        _stale_state(session, current_user, db, "This session changed elsewhere; refresh and try again")

    command = body.command
    target = session
    now = datetime.now(timezone.utc)
    if command is FamilySessionCommandType.START:
        if session.state == "waiting_for_participants":
            session.state = "in_progress"
            session.state_version += 1
        elif session.state != "in_progress":
            _stale_state(session, current_user, db, "This session cannot be started from its current state")
    elif command is FamilySessionCommandType.REVEAL_NEXT:
        if session.state != "in_progress" or session.active_checkpoint_element_key:
            _stale_state(session, current_user, db, "Resolve the current pause before revealing more of the scene")
        element = db.query(CuratedSceneElement).filter(
            CuratedSceneElement.transcript_id == session.transcript_id,
            CuratedSceneElement.sequence > session.revealed_up_to,
        ).order_by(CuratedSceneElement.sequence, CuratedSceneElement.id).first()
        if not element:
            _refresh_completion_ready(session, db)
            _stale_state(session, current_user, db, "The scene is already fully revealed")
        session.revealed_up_to = element.sequence
        message = db.get(CuratedMessage, element.source_message_id) if element.source_message_id else None
        if message and message.is_checkpoint:
            session.state = "checkpoint"
            session.active_checkpoint_element_key = element.element_key
        progress = db.get(SessionProgress, session.id)
        if progress:
            progress.reviewed_element_count = db.query(CuratedSceneElement).filter(
                CuratedSceneElement.transcript_id == session.transcript_id,
                CuratedSceneElement.sequence <= session.revealed_up_to,
            ).count()
        session.state_version += 1
        _refresh_completion_ready(session, db)
    elif command is FamilySessionCommandType.CONTINUE_CHECKPOINT:
        if session.state != "checkpoint" or not session.active_checkpoint_element_key:
            _stale_state(session, current_user, db, "There is no active discussion pause to continue")
        element = db.query(CuratedSceneElement).filter(
            CuratedSceneElement.transcript_id == session.transcript_id,
            CuratedSceneElement.element_key == session.active_checkpoint_element_key,
        ).first()
        if not element or not element.source_message_id:
            _stale_state(session, current_user, db, "The active discussion pause is unavailable")
        answered = db.query(CheckpointResponse.id).filter(
            CheckpointResponse.family_session_id == session.id,
            CheckpointResponse.checkpoint_message_id == element.source_message_id,
        ).first()
        if not answered:
            _stale_state(session, current_user, db, "Please save a reflection before continuing")
        session.state = "in_progress"
        session.active_checkpoint_element_key = None
        progress = db.get(SessionProgress, session.id)
        if progress:
            progress.checkpoint_progress = db.query(CheckpointResponse.checkpoint_message_id).filter(
                CheckpointResponse.family_session_id == session.id,
            ).distinct().count()
        session.state_version += 1
        _refresh_completion_ready(session, db)
    elif command is FamilySessionCommandType.ENTER_COMPLETION_REVIEW:
        _refresh_completion_ready(session, db)
        if session.state != "in_progress" or not _completion_ready(session, db):
            _stale_state(session, current_user, db, "Finish viewing the scene and its reflection pauses before review")
        session.state = "completion_review"
        session.state_version += 1
    elif command is FamilySessionCommandType.ACKNOWLEDGE_COMPLETION:
        if session.state != "completion_review":
            _stale_state(session, current_user, db, "Completion review must be open before it can be acknowledged")
        if session.completion_acknowledged_at is None:
            session.completion_acknowledged_at = now
            session.completion_acknowledged_by_user_id = current_user.id
            session.state_version += 1
    elif command is FamilySessionCommandType.OPEN_HELP:
        if session.state != "completion_review" or session.completion_acknowledged_at is None:
            _stale_state(session, current_user, db, "Acknowledge completion review before opening help")
        session.state = "help_and_resources"
        session.state_version += 1
    elif command is FamilySessionCommandType.COMPLETE:
        if session.state not in {"completion_review", "help_and_resources"} or session.completion_acknowledged_at is None:
            _stale_state(session, current_user, db, "Acknowledge completion review before finishing")
        _complete_session(session, db)
    elif command is FamilySessionCommandType.RESET:
        if session.state in {"paused_for_support", "expired"}:
            _stale_state(session, current_user, db, "This session cannot be reset from its current state")
        session.state = "abandoned"
        session.archived_at = now
        session.state_version += 1
        target = FamilySession(
            transcript_id=session.transcript_id,
            child_user_id=session.child_user_id,
            parent_user_id=session.parent_user_id,
            companion_mode=session.companion_mode,
            detective_mode=session.detective_mode,
            state="in_progress",
            attempt_number=session.attempt_number + 1,
            previous_session_id=session.id,
        )
        db.add(target)
        db.flush()
        for member in db.query(FamilySessionParticipant).filter(FamilySessionParticipant.family_session_id == session.id).all():
            db.add(FamilySessionParticipant(family_session_id=target.id, user_id=member.user_id, role=member.role))
        eligible = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == target.transcript_id).count()
        content_count = db.query(CuratedSceneElement).filter(CuratedSceneElement.transcript_id == target.transcript_id).count()
        db.add(SessionProgress(family_session_id=target.id, eligible_target_count=eligible, required_finding_count=eligible, content_progress=content_count))

    db.add(FamilySessionCommand(
        family_session_id=session.id, client_command_id=body.client_command_id,
        command=command.value, expected_state_version=body.expected_state_version,
        resulting_session_id=target.id,
    ))
    db.commit()
    db.refresh(target)
    return _session_detail_out(target, current_user, db)


@router.get("/sessions/{session_id}/messages", response_model=list[FamilyMessageOut])
def get_messages(
    session_id: int,
    up_to: int = Query(..., ge=0),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    messages = (
        db.query(CuratedMessage)
        .filter(CuratedMessage.transcript_id == session.transcript_id, CuratedMessage.sequence <= up_to)
        .order_by(CuratedMessage.sequence)
        .all()
    )
    return [
        FamilyMessageOut(
            id=message.id,
            sequence=message.sequence,
            speaker_label=message.speaker_label,
            content=message.content,
            pace=message.pace,
            is_checkpoint=message.is_checkpoint,
            checkpoint_prompt=message.checkpoint_prompt,
        )
        for message in messages
    ]


@router.post("/sessions/{session_id}/checkpoint-responses", response_model=CheckpointResponseOut, status_code=status.HTTP_201_CREATED)
def record_checkpoint_response(
    session_id: int,
    body: CheckpointResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    if session.completed_at:
        raise HTTPException(status_code=409, detail="Family session is already complete")
    if session.state != "checkpoint":
        raise HTTPException(status_code=409, detail="There is no active discussion pause")
    expected_role = ParticipantRole.CHILD if current_user.id == session.child_user_id else ParticipantRole.PARENT
    if body.responder_role != expected_role:
        raise HTTPException(status_code=403, detail="Responder role does not match this participant")
    checkpoint = db.query(CuratedMessage).filter(
        CuratedMessage.id == body.checkpoint_message_id,
        CuratedMessage.transcript_id == session.transcript_id,
        CuratedMessage.is_checkpoint.is_(True),
    ).first()
    if not checkpoint:
        raise HTTPException(status_code=422, detail="Checkpoint message does not belong to this session")
    active_element = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.element_key == session.active_checkpoint_element_key,
    ).first()
    if not active_element or active_element.source_message_id != checkpoint.id:
        raise HTTPException(status_code=409, detail="This is not the active discussion pause")
    if body.flagged_message_ids:
        found = {
            message_id for (message_id,) in db.query(CuratedMessage.id).filter(
                CuratedMessage.transcript_id == session.transcript_id,
                CuratedMessage.id.in_(body.flagged_message_ids),
            ).all()
        }
        if found != set(body.flagged_message_ids):
            raise HTTPException(status_code=422, detail="A flagged message does not belong to this session")
    response = CheckpointResponse(
        family_session_id=session.id,
        checkpoint_message_id=checkpoint.id,
        responder_role=body.responder_role.value,
        response_text=body.response_text,
        flagged_message_ids=body.flagged_message_ids,
        tactic_tag_guess=body.tactic_tag_guess,
    )
    db.add(response)
    db.commit()
    db.refresh(response)
    return CheckpointResponseOut(
        id=response.id,
        checkpoint_message_id=response.checkpoint_message_id,
        responder_role=ParticipantRole(response.responder_role),
        response_text=response.response_text,
        flagged_message_ids=response.flagged_message_ids or [],
        tactic_tag_guess=response.tactic_tag_guess,
        created_at=_timestamp(response.created_at) or "",
    )


@router.post("/sessions/{session_id}/complete", response_model=ConversationGuideOut)
def complete_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    existing = db.query(ConversationGuide).filter(ConversationGuide.family_session_id == session.id).first()
    if existing:
        return _guide_out(existing)
    if session.state not in {"completion_review", "help_and_resources"} or session.completion_acknowledged_at is None:
        _stale_state(session, current_user, db, "Acknowledge completion review before finishing")
    guide = _complete_session(session, db)
    db.commit()
    db.refresh(guide)
    return _guide_out(guide)


@router.get("/sessions/{session_id}/conversation-guide", response_model=ConversationGuideOut)
def get_conversation_guide(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    guide = db.query(ConversationGuide).filter(ConversationGuide.family_session_id == session.id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Conversation guide is not ready")
    return _guide_out(guide)
