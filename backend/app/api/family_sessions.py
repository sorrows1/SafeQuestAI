"""Authenticated family scenario routes; this player path makes no LLM calls."""
from __future__ import annotations

import asyncio
import json
from hashlib import sha256
from datetime import datetime, timedelta, timezone
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Response, status
from fastapi.responses import StreamingResponse
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth.security import get_current_user
from app.config.rollout import FeatureFlag, is_enabled, require_feature
from app.telemetry import record as telemetry_record
from app.family.guide_builder import build_conversation_guide
from app.models.orm import (
    CheckpointResponse,
    CompanionExchange,
    ConversationGuide,
    CuratedMessage,
    CuratedSceneElement,
    CuratedTranscript,
    FamilyRelationship,
    FamilySession,
    FamilySessionCommand,
    FamilySessionEvent,
    FamilySessionParticipant,
    FamilyCaregiverComment,
    FamilyCaregiverCommentAudit,
    FlagAttempt,
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
    RestartFamilySessionRequest,
    FamilyMessageOut,
    FamilyRole,
    FamilySceneOut,
    FamilySessionDetailOut,
    FamilySessionCapabilitiesOut,
    FamilySessionCommandRequest,
    FamilySessionCommandType,
    FamilySessionOut,
    FamilySessionParticipantOut,
    FamilySessionEventOut,
    FamilySessionEventType,
    FamilyPresenceHeartbeatRequest,
    FamilySelectionFocusRequest,
    FamilyCaregiverCommentCreateRequest,
    FamilyCaregiverCommentUpdateRequest,
    FamilyCaregiverCommentOut,
    GenerateJoinCodeResponse,
    JoinSessionRequest,
    JoinSessionResponse,
    ParticipantPresenceStatus,
    SceneActor,
    SceneElementOut,
    SessionProgressOut,
    ValidatedFindingOut,
    ParticipantRole,
    PublishedScenarioOut,
    PublishedScenarioPageOut,
    RenderSkin,
    ScenarioCategory,
    ScenarioLifecycle,
    TERMINAL_FAMILY_SESSION_STATES,
    catalog_lifecycle_for_states,
    is_non_terminal_family_session_state,
    is_terminal_family_session_state,
)

router = APIRouter(prefix="/api/family", tags=["Family Sessions"])


PRESENCE_TTL = timedelta(seconds=90)
EPHEMERAL_EVENT_TTL = timedelta(minutes=2)
# A reconnect receives at most this many durable events. The client always
# refetches session detail, which is authoritative, so an old cursor never
# causes an unbounded replay or timeline mount.
MAX_SSE_REPLAY_EVENTS = 250

# A caregiver may observe, add anchored discussion notes, and contribute a
# shared checkpoint reflection. The learner alone advances or finishes the
# activity, regardless of any client-provided role or capability claim.
LEARNER_OWNED_COMMANDS = {
    FamilySessionCommandType.START,
    FamilySessionCommandType.REVEAL_NEXT,
    FamilySessionCommandType.CONTINUE_CHECKPOINT,
    FamilySessionCommandType.ENTER_COMPLETION_REVIEW,
    FamilySessionCommandType.ACKNOWLEDGE_COMPLETION,
    FamilySessionCommandType.OPEN_HELP,
    FamilySessionCommandType.COMPLETE,
    FamilySessionCommandType.RESET,
}


def _shared_state_payload(session: FamilySession) -> dict[str, object]:
    """Payload safe for every current participant, including caregivers."""
    return {
        "state": session.state,
        "state_version": session.state_version,
        "revealed_up_to": session.revealed_up_to,
        "active_checkpoint_element_key": session.active_checkpoint_element_key,
        "turn_owner_ref": member_ref(session.participation_turn_user_id) if session.participation_turn_user_id else None,
    }


def _emit_event(
    db: Session,
    session: FamilySession,
    event_type: FamilySessionEventType | str,
    payload: dict[str, object] | None = None,
    *,
    actor_participant: FamilySessionParticipant | None = None,
    is_ephemeral: bool = False,
) -> FamilySessionEvent:
    """Append a safe event. Callers must never pass companion/disclosure content."""
    # Serialize sequence allocation per session; the unique constraint is a final guard.
    if session.id is None:
        db.flush()
    locked = db.query(FamilySession).filter(FamilySession.id == session.id).with_for_update().one()
    session = locked
    session.event_sequence = (session.event_sequence or 0) + 1
    event = FamilySessionEvent(
        family_session_id=session.id,
        sequence=session.event_sequence,
        event_type=event_type.value if isinstance(event_type, FamilySessionEventType) else event_type,
        actor_participant_id=actor_participant.id if actor_participant else None,
        payload=payload or {},
        is_ephemeral=is_ephemeral,
        expires_at=datetime.now(timezone.utc) + EPHEMERAL_EVENT_TTL if is_ephemeral else None,
    )
    db.add(event)
    return event


def _event_out(event: FamilySessionEvent, db: Session) -> FamilySessionEventOut:
    actor = db.get(FamilySessionParticipant, event.actor_participant_id) if event.actor_participant_id else None
    return FamilySessionEventOut(
        id=event.id,
        sequence=event.sequence,
        event_type=FamilySessionEventType(event.event_type),
        actor_ref=member_ref(actor.user_id) if actor else None,
        payload=event.payload or {},
        is_ephemeral=event.is_ephemeral,
        created_at=_timestamp(event.created_at) or "",
    )


def _expire_presence(session: FamilySession, db: Session, now: datetime | None = None) -> bool:
    """Presence is advisory: expiry never changes the gameplay state machine."""
    now = now or datetime.now(timezone.utc)
    changed = False
    members = db.query(FamilySessionParticipant).filter(
        FamilySessionParticipant.family_session_id == session.id,
        FamilySessionParticipant.left_at.is_(None),
        FamilySessionParticipant.presence_status == "online",
        FamilySessionParticipant.presence_expires_at.is_not(None),
        FamilySessionParticipant.presence_expires_at <= now,
    ).all()
    for member in members:
        member.presence_status = "offline"
        member.presence_expires_at = None
        _emit_event(db, session, FamilySessionEventType.PARTICIPANT_PRESENCE, {
            "member_ref": member_ref(member.user_id), "status": "offline",
        })
        changed = True
    return changed


def _comment_out(comment: FamilyCaregiverComment, db: Session) -> FamilyCaregiverCommentOut:
    author = db.get(FamilySessionParticipant, comment.author_participant_id)
    user = db.get(User, author.user_id) if author else None
    element = db.get(CuratedSceneElement, comment.scene_element_id) if comment.scene_element_id else None
    finding = db.get(ValidatedFinding, comment.validated_finding_id) if comment.validated_finding_id else None
    span = db.get(RedFlagSpan, finding.red_flag_span_id) if finding else None
    return FamilyCaregiverCommentOut(
        comment_ref=comment.public_id,
        author_ref=member_ref(author.user_id) if author else "",
        author_display_name=user.display_name if user else "Caregiver",
        element_key=element.element_key if element else None,
        annotation_id=span.id if span else None,
        text=comment.text,
        child_visible_label=comment.child_visible_label,
        created_at=_timestamp(comment.created_at) or "",
        updated_at=_timestamp(comment.updated_at) or "",
    )


def _comments_out(session: FamilySession, db: Session) -> list[FamilyCaregiverCommentOut]:
    rows = db.query(FamilyCaregiverComment).filter(
        FamilyCaregiverComment.family_session_id == session.id,
        FamilyCaregiverComment.deleted_at.is_(None),
    ).order_by(FamilyCaregiverComment.created_at, FamilyCaregiverComment.id).all()
    return [_comment_out(row, db) for row in rows]

def _timestamp(value: datetime | None) -> str | None:
    return value.isoformat() if value else None


def _session_out(session: FamilySession) -> FamilySessionOut:
    return FamilySessionOut(
        id=session.id,
        public_id=session.public_id,
        session_ref=session.public_id,
        owner_ref=member_ref(session.owner_user_id or session.child_user_id),
        transcript_id=session.transcript_id,
        caregiver_ref=member_ref(session.parent_user_id) if session.parent_user_id else None,
        turn_owner_ref=member_ref(session.participation_turn_user_id) if session.participation_turn_user_id else None,
        companion_mode=session.companion_mode,
        # Kept only for old clients; detection is mandatory in all new sessions.
        detective_mode=True,
        started_at=_timestamp(session.started_at) or "",
        completed_at=_timestamp(session.completed_at),
        state=session.state,
        state_version=session.state_version,
        revealed_up_to=session.revealed_up_to,
        active_checkpoint_element_key=session.active_checkpoint_element_key,
        completion_acknowledged_at=_timestamp(session.completion_acknowledged_at),
        attempt_number=session.attempt_number,
        updated_at=_timestamp(session.updated_at),
        join_code_short=session.join_code_short,
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


def _load_session(session_id: int | str, current_user: User, db: Session) -> FamilySession:
    session = None
    if isinstance(session_id, int) or (isinstance(session_id, str) and session_id.isdigit()):
        session = db.get(FamilySession, int(session_id))
    if not session:
        session = db.query(FamilySession).filter(
            (FamilySession.public_id == str(session_id))
        ).first()
    if not session or not session_participant(session, current_user.id, db):
        raise HTTPException(status_code=404, detail="Family session not found")
    return session


def _active_learner_session(transcript_id: int, learner_id: int, db: Session) -> FamilySession | None:
    """The one non-terminal attempt allowed for this learner and scenario."""
    return db.query(FamilySession).filter(
        FamilySession.child_user_id == learner_id,
        FamilySession.transcript_id == transcript_id,
        FamilySession.state.notin_(TERMINAL_FAMILY_SESSION_STATES),
    ).order_by(FamilySession.updated_at.desc(), FamilySession.id.desc()).first()


def _latest_terminal_learner_session(transcript_id: int, learner_id: int, db: Session) -> FamilySession | None:
    return db.query(FamilySession).filter(
        FamilySession.child_user_id == learner_id,
        FamilySession.transcript_id == transcript_id,
        FamilySession.state.in_(TERMINAL_FAMILY_SESSION_STATES),
    ).order_by(FamilySession.updated_at.desc(), FamilySession.id.desc()).first()


def _catalog_lifecycle_by_transcript(
    transcript_ids: list[int], current_user: User | None, db: Session,
) -> dict[int, tuple[ScenarioLifecycle, str | None]]:
    """Derive catalog actions from learner-owned durable attempts only."""
    if not transcript_ids or not current_user or current_user.id is None:
        return {transcript_id: (ScenarioLifecycle.NOT_STARTED, None) for transcript_id in transcript_ids}
    rows = db.query(FamilySession).filter(
        FamilySession.child_user_id == current_user.id,
        FamilySession.transcript_id.in_(transcript_ids),
    ).order_by(FamilySession.updated_at.desc(), FamilySession.id.desc()).all()
    by_transcript: dict[int, list[FamilySession]] = {transcript_id: [] for transcript_id in transcript_ids}
    for row in rows:
        by_transcript.setdefault(row.transcript_id, []).append(row)
    result: dict[int, tuple[ScenarioLifecycle, str | None]] = {}
    for transcript_id, attempts in by_transcript.items():
        active = next((attempt for attempt in attempts if is_non_terminal_family_session_state(attempt.state)), None)
        lifecycle = ScenarioLifecycle(catalog_lifecycle_for_states(attempt.state for attempt in attempts))
        chosen = active or (attempts[0] if attempts else None)
        result[transcript_id] = (lifecycle, chosen.public_id if chosen else None)
    return result


def _published_scenario_out(
    transcript: CuratedTranscript,
    db: Session,
    lifecycle: ScenarioLifecycle = ScenarioLifecycle.NOT_STARTED,
    session_ref: str | None = None,
) -> PublishedScenarioOut:
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
        lifecycle=lifecycle, session_ref=session_ref,
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
    transcripts = db.query(CuratedTranscript).filter(CuratedTranscript.is_published.is_(True)).all()
    lifecycle_by_transcript = _catalog_lifecycle_by_transcript([item.id for item in transcripts], _, db)
    items = [
        _published_scenario_out(item, db, *lifecycle_by_transcript[item.id])
        for item in transcripts
    ]
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
    lifecycle, session_ref = _catalog_lifecycle_by_transcript([transcript.id], _, db)[transcript.id]
    return _published_scenario_out(transcript, db, lifecycle, session_ref)


def _generate_join_code(session: FamilySession) -> str:
    """Generate a 6-character alphanumeric join code, store its salted hash."""
    import string as str_mod
    code = ''.join(secrets.choice(str_mod.ascii_uppercase + str_mod.digits) for _ in range(6))
    # Salt the hash with the session's opaque public_id to prevent rainbow-table attacks.
    salted = code + (session.public_id or "")
    session.join_code_hash = sha256(salted.encode()).hexdigest()
    session.join_code_short = code
    return code


def _new_attempt(
    transcript: CuratedTranscript,
    learner_id: int,
    caregiver_id: int | None,
    db: Session,
    *,
    previous_session: FamilySession | None = None,
) -> FamilySession:
    session = FamilySession(
        public_id=f"fs_{secrets.token_urlsafe(18)}", owner_user_id=learner_id,
        transcript_id=transcript.id, child_user_id=learner_id, parent_user_id=caregiver_id,
        companion_mode=caregiver_id is None, state="waiting_for_participants" if caregiver_id else "in_progress",
        revealed_up_to=-1, participation_turn_user_id=learner_id,
        attempt_number=(previous_session.attempt_number + 1) if previous_session else 1,
        previous_session_id=previous_session.id if previous_session else None,
    )
    db.add(session)
    db.flush()
    # Generate a join code for shared sessions so the caregiver can join.
    if caregiver_id is not None:
        _generate_join_code(session)
        db.flush()
    now = datetime.now(timezone.utc)
    learner = FamilySessionParticipant(
        family_session_id=session.id, user_id=learner_id, role="learner",
        last_seen_at=now, last_heartbeat_at=now, presence_expires_at=now + PRESENCE_TTL, presence_status="online",
    )
    db.add(learner)
    db.flush()
    _emit_event(db, session, FamilySessionEventType.PARTICIPANT_JOINED, {"member_ref": member_ref(learner_id), "role": "learner"}, actor_participant=learner)
    _emit_event(db, session, FamilySessionEventType.PARTICIPANT_PRESENCE, {"member_ref": member_ref(learner_id), "status": "online"}, actor_participant=learner)
    if caregiver_id is not None:
        db.add(FamilySessionParticipant(family_session_id=session.id, user_id=caregiver_id, role="caregiver", presence_status="offline"))
    eligible = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == transcript.id).count()
    db.add(SessionProgress(family_session_id=session.id, eligible_target_count=eligible, required_finding_count=eligible))
    return session


def _resume_active_attempt(response: Response, active: FamilySession) -> FamilySessionOut:
    response.status_code = status.HTTP_200_OK
    return _session_out(active)


def _require_new_session_rollout(*, shared: bool) -> None:
    """Gate creation only; reads and active-attempt resumes remain compatible."""
    for flag in (FeatureFlag.SCENE_CONTRACT, FeatureFlag.GAMEPLAY_SHELL):
        require_feature(flag)
    if shared:
        require_feature(FeatureFlag.RELATIONSHIPS)
        require_feature(FeatureFlag.MULTIPLAYER_EVENTS)
    else:
        require_feature(FeatureFlag.NEW_SOLO_SESSIONS)


@router.post("/scenarios/{transcript_id}/sessions", response_model=FamilySessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    transcript_id: int,
    body: CreateFamilySessionRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = db.query(CuratedTranscript).filter(
        CuratedTranscript.id == transcript_id, CuratedTranscript.is_published.is_(True)
    ).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Published scenario not found")
    active = _active_learner_session(transcript.id, current_user.id, db)
    if active:
        return _resume_active_attempt(response, active)
    prior = _latest_terminal_learner_session(transcript.id, current_user.id, db)
    if prior:
        raise HTTPException(status_code=409, detail={"code": "restart_required", "session_ref": prior.public_id})
    _require_new_session_rollout(shared=bool(body.relationship_ref))
    relationship = active_relationship_for_ref(db, body.relationship_ref, current_user.id) if body.relationship_ref else None
    caregiver_id = relationship.caregiver_user_id if relationship else None
    if relationship and relationship.learner_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the learner may start a shared family session")
    session = _new_attempt(transcript, current_user.id, caregiver_id, db)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        active = _active_learner_session(transcript.id, current_user.id, db)
        if active:
            return _resume_active_attempt(response, active)
        raise
    db.refresh(session)
    telemetry_record("family.session.transition", status="created", channel="family" if caregiver_id else "solo")
    return _session_out(session)


@router.post("/scenarios/{transcript_id}/sessions/restart", response_model=FamilySessionOut, status_code=status.HTTP_201_CREATED)
def restart_session(
    transcript_id: int,
    body: RestartFamilySessionRequest,
    response: Response,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    transcript = db.query(CuratedTranscript).filter(
        CuratedTranscript.id == transcript_id, CuratedTranscript.is_published.is_(True)
    ).first()
    if not transcript:
        raise HTTPException(status_code=404, detail="Published scenario not found")
    active = _active_learner_session(transcript.id, current_user.id, db)
    if active:
        return _resume_active_attempt(response, active)
    prior = db.query(FamilySession).filter(
        FamilySession.public_id == body.prior_session_ref,
        FamilySession.transcript_id == transcript.id,
        FamilySession.child_user_id == current_user.id,
        FamilySession.state.in_(TERMINAL_FAMILY_SESSION_STATES),
    ).first()
    if not prior:
        raise HTTPException(status_code=404, detail="Completed family session not found")
    caregiver_member = db.query(FamilySessionParticipant).filter(
        FamilySessionParticipant.family_session_id == prior.id,
        FamilySessionParticipant.role == "caregiver",
        FamilySessionParticipant.left_at.is_(None),
    ).first()
    caregiver_id = caregiver_member.user_id if caregiver_member else None
    _require_new_session_rollout(shared=caregiver_id is not None)
    session = _new_attempt(transcript, current_user.id, caregiver_id, db, previous_session=prior)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        active = _active_learner_session(transcript.id, current_user.id, db)
        if active:
            return _resume_active_attempt(response, active)
        raise
    db.refresh(session)
    telemetry_record("family.session.transition", command="restart", status="created")
    return _session_out(session)


def _completion_ready(session: FamilySession, db: Session) -> bool:
    last_sequence = db.query(CuratedSceneElement.sequence).filter(CuratedSceneElement.transcript_id == session.transcript_id).order_by(CuratedSceneElement.sequence.desc()).first()
    if last_sequence is None or session.revealed_up_to < last_sequence[0] or session.active_checkpoint_element_key:
        return False
    checkpoint_ids = {row[0] for row in db.query(CuratedMessage.id).filter(CuratedMessage.transcript_id == session.transcript_id, CuratedMessage.is_checkpoint.is_(True)).all()}
    answered_ids = {row[0] for row in db.query(CheckpointResponse.checkpoint_message_id).filter(
        CheckpointResponse.family_session_id == session.id,
        CheckpointResponse.responder_role == ParticipantRole.CHILD.value,
    ).all()}
    if not checkpoint_ids.issubset(answered_ids):
        return False
    # Scenario must not complete until ALL required red flags/objectives are validated.
    progress = db.get(SessionProgress, session.id)
    if progress and is_enabled(FeatureFlag.FLAG_ATTEMPTS) and progress.validated_finding_count < progress.required_finding_count:
        return False
    return True


def _progress_out(session: FamilySession, db: Session) -> SessionProgressOut:
    """Derive learner-visible progress from durable scene and response state.

    ``SessionProgress`` remains a denormalized record for reporting, but it is
    never the authority for how much content a learner has actually seen.
    """
    progress = db.get(SessionProgress, session.id)
    content_total = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.selectable.is_(True),
    ).count()
    content_revealed = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.selectable.is_(True),
        CuratedSceneElement.sequence <= session.revealed_up_to,
    ).count()
    checkpoint_total = db.query(CuratedMessage).filter(
        CuratedMessage.transcript_id == session.transcript_id,
        CuratedMessage.is_checkpoint.is_(True),
    ).count()
    checkpoint_complete = db.query(CheckpointResponse.checkpoint_message_id).filter(
        CheckpointResponse.family_session_id == session.id,
        CheckpointResponse.responder_role == ParticipantRole.CHILD.value,
    ).distinct().count()
    if progress:
        progress.reviewed_element_count = content_revealed
        progress.content_progress = content_revealed
        progress.checkpoint_progress = checkpoint_complete
        progress.completion_ready = _completion_ready(session, db)
    return SessionProgressOut(
        reviewed_element_count=content_revealed,
        validated_finding_count=progress.validated_finding_count if progress else 0,
        eligible_target_count=progress.eligible_target_count if progress else 0,
        required_finding_count=progress.required_finding_count if progress else 0,
        checkpoint_progress=checkpoint_complete,
        checkpoint_total=checkpoint_total,
        content_progress=content_revealed,
        content_total=content_total,
        completion_ready=_completion_ready(session, db),
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
        presence_status=ParticipantPresenceStatus(member.presence_status), presence_expires_at=_timestamp(member.presence_expires_at),
    )


def _findings_out(session: FamilySession, db: Session) -> list[ValidatedFindingOut]:
    rows = db.query(ValidatedFinding, CuratedSceneElement, RedFlagSpan).join(
        CuratedSceneElement, CuratedSceneElement.id == ValidatedFinding.element_id
    ).join(RedFlagSpan, RedFlagSpan.id == ValidatedFinding.red_flag_span_id).filter(
        ValidatedFinding.family_session_id == session.id
    ).order_by(ValidatedFinding.discovered_at, ValidatedFinding.id).all()
    grouped: dict[str, dict] = {}
    for finding, element, span in rows:
        explanation = " ".join((span.child_safe_explanation or "").split())
        normalized = span.tactic_tag.strip().casefold() + "\n" + explanation.casefold()
        insight_key = sha256(normalized.encode("utf-8")).hexdigest()[:24]
        group = grouped.setdefault(insight_key, {
            "element_key": element.element_key, "annotation_id": span.id,
            "tactic_tag": span.tactic_tag, "explanation": span.child_safe_explanation,
            "element_keys": [], "annotation_ids": [],
            "discovered_at": _timestamp(finding.discovered_at) or "", "visibility": finding.visibility,
        })
        if element.element_key not in group["element_keys"]:
            group["element_keys"].append(element.element_key)
        if span.id not in group["annotation_ids"]:
            group["annotation_ids"].append(span.id)
    return [ValidatedFindingOut(insight_key=key, **item) for key, item in grouped.items()]


def _session_detail_out(session: FamilySession, current_user: User, db: Session) -> FamilySessionDetailOut:
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Scenario not found")
    participant = session_participant(session, current_user.id, db)
    if not participant:
        raise HTTPException(status_code=404, detail="Family session not found")
    role = FamilyRole(participant.role)
    is_learner = role is FamilyRole.LEARNER
    turn_owner_id = session.participation_turn_user_id or session.child_user_id
    owns_turn = current_user.id == turn_owner_id
    active = session.state not in {"completed", "expired", "abandoned", "paused_for_support"}
    next_element_exists = db.query(CuratedSceneElement.id).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.sequence > session.revealed_up_to,
    ).first() is not None
    progress = _progress_out(session, db)
    review_acknowledged = session.completion_acknowledged_at is not None
    capabilities = FamilySessionCapabilitiesOut(
        can_start=active and is_learner and owns_turn and session.state == "waiting_for_participants",
        can_reveal_next=active and is_learner and owns_turn and session.state == "in_progress" and session.active_checkpoint_element_key is None and next_element_exists,
        can_continue_checkpoint=active and is_learner and owns_turn and session.state == "checkpoint" and session.active_checkpoint_element_key is not None,
        can_enter_completion_review=active and is_learner and owns_turn and session.state == "in_progress" and progress.completion_ready,
        can_acknowledge_completion=is_learner and owns_turn and session.state == "completion_review" and not review_acknowledged,
        can_open_help=is_learner and owns_turn and session.state == "completion_review" and review_acknowledged,
        can_complete=is_learner and owns_turn and session.state in {"completion_review", "help_and_resources"} and review_acknowledged,
        can_reset=active and is_learner and owns_turn,
        can_submit_flag_attempt=is_enabled(FeatureFlag.FLAG_ATTEMPTS) and active and session.state in {"in_progress", "checkpoint"},
        can_request_hint=is_enabled(FeatureFlag.FLAG_ATTEMPTS) and active and is_learner and session.state in {"in_progress", "checkpoint"},
        can_use_private_companion=active and is_learner,
        can_join_or_observe=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and role is FamilyRole.CAREGIVER,
        can_contribute_shared_prompts=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active and role is FamilyRole.CAREGIVER,
        can_review_shared_results=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and not session.companion_mode and session.state in {"completion_review", "help_and_resources", "completed"},
        can_invite_before_start=is_enabled(FeatureFlag.RELATIONSHIPS) and is_learner and session.state == "waiting_for_participants",
        can_remove_before_start=is_enabled(FeatureFlag.RELATIONSHIPS) and is_learner and session.state == "waiting_for_participants",
        can_leave=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and role is FamilyRole.CAREGIVER,
        can_heartbeat=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active,
        can_publish_selection_focus=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active,
        can_submit_shared_reflection=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active and role is FamilyRole.CAREGIVER and session.state == "checkpoint",
        can_add_caregiver_comment=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active and role is FamilyRole.CAREGIVER,
        can_edit_own_caregiver_comment=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active and role is FamilyRole.CAREGIVER,
        can_request_shared_companion_feedback=is_enabled(FeatureFlag.MULTIPLAYER_EVENTS) and active and is_learner,
    )
    members = db.query(FamilySessionParticipant).filter(FamilySessionParticipant.family_session_id == session.id).order_by(FamilySessionParticipant.id).all()
    return FamilySessionDetailOut(
        session=_session_out(session), scene=_scene_out(session, transcript, db), progress=progress,
        participants=[_participant_out(member, db) for member in members],
        participant_role=role, capabilities=capabilities,
        findings=_findings_out(session, db), caregiver_comments=_comments_out(session, db),
    )


def _stale_state(session: FamilySession, current_user: User, db: Session, message: str) -> None:
    telemetry_record("family.command.failed", reason="stale_state")
    raise HTTPException(status_code=409, detail={"message": message, "current": _session_detail_out(session, current_user, db).model_dump(mode="json")})


def _complete_session(
    session: FamilySession, db: Session, actor_participant: FamilySessionParticipant | None = None,
) -> ConversationGuide:
    existing = db.query(ConversationGuide).filter(ConversationGuide.family_session_id == session.id).first()
    if existing:
        return existing
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Scenario not found")
    spans = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == transcript.id).all()
    responses = db.query(CheckpointResponse).filter(CheckpointResponse.family_session_id == session.id).order_by(CheckpointResponse.created_at, CheckpointResponse.id).all()
    attempts = db.query(FlagAttempt).filter(FlagAttempt.family_session_id == session.id).order_by(FlagAttempt.created_at, FlagAttempt.id).all()
    findings = db.query(ValidatedFinding).filter(ValidatedFinding.family_session_id == session.id).order_by(ValidatedFinding.discovered_at, ValidatedFinding.id).all()
    comments = db.query(FamilyCaregiverComment).filter(
        FamilyCaregiverComment.family_session_id == session.id, FamilyCaregiverComment.deleted_at.is_(None),
    ).order_by(FamilyCaregiverComment.created_at, FamilyCaregiverComment.id).all()
    guide = ConversationGuide(
        family_session_id=session.id,
        **build_conversation_guide(
            session, transcript.category, spans, responses,
            shared_attempts=attempts, validated_findings=findings, caregiver_comments=comments,
        ),
    )
    session.state = "completed"
    session.completed_at = session.completed_at or datetime.now(timezone.utc)
    session.state_version += 1
    db.add(guide)
    db.flush()
    _emit_event(db, session, FamilySessionEventType.COMPLETED, _shared_state_payload(session), actor_participant=actor_participant)
    _emit_event(db, session, FamilySessionEventType.GUIDE_READY, {"state": session.state}, actor_participant=actor_participant)
    return guide


@router.get("/sessions/{session_id}", response_model=FamilySessionDetailOut)
def get_session_detail(session_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    session = _load_session(session_id, current_user, db)
    if _expire_presence(session, db):
        db.commit()
    return _session_detail_out(session, current_user, db)


@router.get("/sessions/{session_id}/events")
async def stream_session_events(
    session_id: str,
    last_event_id: str | None = Header(default=None, alias="Last-Event-ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(FeatureFlag.MULTIPLAYER_EVENTS)
    # URLs use the opaque public ID, while the event stream stores the numeric
    # primary key. Resolve it once before the response is handed off to the
    # long-lived stream (which uses its own database sessions).
    family_session_id = _load_session(session_id, current_user, db).id
    telemetry_record("family.stream.reconnect", transport="sse")
    try:
        cursor = int(last_event_id or "0")
        if cursor < 0:
            raise ValueError
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="Last-Event-ID must be a non-negative integer") from exc

    async def stream():
        nonlocal cursor
        from app.models.orm import SessionLocal
        while True:
            local = SessionLocal()
            try:
                session = local.get(FamilySession, family_session_id)
                participant = session_participant(session, current_user.id, local) if session else None
                if not session or not participant:
                    return
                if _expire_presence(session, local):
                    local.commit()
                now = datetime.now(timezone.utc)
                rows = local.query(FamilySessionEvent).filter(
                    FamilySessionEvent.family_session_id == family_session_id,
                    FamilySessionEvent.id > cursor,
                ).order_by(FamilySessionEvent.id.desc()).limit(MAX_SSE_REPLAY_EVENTS).all()
                rows.reverse()
                for row in rows:
                    cursor = row.id
                    if row.is_ephemeral and row.expires_at and row.expires_at <= now:
                        continue
                    payload = _event_out(row, local).model_dump(mode="json")
                    yield f"id: {row.id}\nevent: {row.event_type}\ndata: {json.dumps(payload)}\n\n"
                if session.state in {"completed", "expired", "abandoned"} and rows:
                    return
            finally:
                local.close()
            yield ": keep-alive\n\n"
            await asyncio.sleep(0.5)

    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/sessions/{session_id}/presence", response_model=FamilySessionParticipantOut)
def heartbeat_presence(
    session_id: str,
    body: FamilyPresenceHeartbeatRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(FeatureFlag.MULTIPLAYER_EVENTS)
    session = _load_session(session_id, current_user, db)
    _expire_presence(session, db)
    participant = session_participant(session, current_user.id, db)
    if not participant:
        raise HTTPException(status_code=404, detail="Family session not found")
    now = datetime.now(timezone.utc)
    if participant.last_heartbeat_at is None:
        _emit_event(db, session, FamilySessionEventType.PARTICIPANT_JOINED, {
            "member_ref": member_ref(participant.user_id), "role": participant.role,
        }, actor_participant=participant)
    previous = participant.presence_status
    participant.last_seen_at = now
    participant.last_heartbeat_at = now
    participant.presence_status = body.status
    participant.presence_expires_at = now + PRESENCE_TTL if body.status == "online" else None
    if previous != body.status:
        _emit_event(db, session, FamilySessionEventType.PARTICIPANT_PRESENCE, {
            "member_ref": member_ref(participant.user_id), "status": body.status,
        }, actor_participant=participant)
    db.commit()
    db.refresh(participant)
    return _participant_out(participant, db)


@router.post("/sessions/{session_id}/selection-focus", status_code=status.HTTP_204_NO_CONTENT)
def publish_selection_focus(
    session_id: str,
    body: FamilySelectionFocusRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_feature(FeatureFlag.MULTIPLAYER_EVENTS)
    session = _load_session(session_id, current_user, db)
    participant = session_participant(session, current_user.id, db)
    element = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == session.transcript_id,
        CuratedSceneElement.element_key == body.element_key,
        CuratedSceneElement.sequence <= session.revealed_up_to,
    ).first()
    if not participant or not element:
        raise HTTPException(status_code=422, detail="The selected item is unavailable in this session")
    _emit_event(db, session, FamilySessionEventType.SELECTION_FOCUS, {
        "element_key": element.element_key,
    }, actor_participant=participant, is_ephemeral=True)
    db.commit()


@router.post("/sessions/{session_id}/leave", status_code=status.HTTP_204_NO_CONTENT)
def leave_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    participant = session_participant(session, current_user.id, db)
    if not participant or participant.role != FamilyRole.CAREGIVER.value:
        raise HTTPException(status_code=403, detail="Only a caregiver may leave a shared session; the learner keeps ownership")
    now = datetime.now(timezone.utc)
    participant.left_at = now
    participant.presence_status = "left"
    participant.presence_expires_at = None
    _emit_event(db, session, FamilySessionEventType.PARTICIPANT_LEFT, {
        "member_ref": member_ref(participant.user_id),
    }, actor_participant=participant)
    db.commit()


@router.post("/sessions/{session_id}/comments", response_model=FamilyCaregiverCommentOut, status_code=status.HTTP_201_CREATED)
def create_caregiver_comment(
    session_id: str,
    body: FamilyCaregiverCommentCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    participant = session_participant(session, current_user.id, db)
    if not participant or participant.role != FamilyRole.CAREGIVER.value:
        raise HTTPException(status_code=403, detail="Only a caregiver may add a shared note")
    existing = db.query(FamilyCaregiverComment).filter(
        FamilyCaregiverComment.family_session_id == session.id,
        FamilyCaregiverComment.client_command_id == body.client_command_id,
    ).first()
    if existing:
        return _comment_out(existing, db)
    element = None
    finding = None
    if body.element_key:
        element = db.query(CuratedSceneElement).filter(
            CuratedSceneElement.transcript_id == session.transcript_id,
            CuratedSceneElement.element_key == body.element_key,
            CuratedSceneElement.sequence <= session.revealed_up_to,
        ).first()
        if not element:
            raise HTTPException(status_code=422, detail="The scene item is unavailable for a comment")
    else:
        finding = db.query(ValidatedFinding).filter(
            ValidatedFinding.family_session_id == session.id,
            ValidatedFinding.red_flag_span_id == body.annotation_id,
        ).first()
        if not finding:
            raise HTTPException(status_code=422, detail="The finding is unavailable for a comment")
    comment = FamilyCaregiverComment(
        public_id=f"fc_{secrets.token_urlsafe(18)}", family_session_id=session.id,
        author_participant_id=participant.id, scene_element_id=element.id if element else None,
        validated_finding_id=finding.id if finding else None, text=body.text.strip(),
        client_command_id=body.client_command_id,
    )
    db.add(comment)
    db.flush()
    db.add(FamilyCaregiverCommentAudit(comment_id=comment.id, actor_participant_id=participant.id, action="created", text_snapshot=comment.text))
    out = _comment_out(comment, db)
    _emit_event(db, session, FamilySessionEventType.CAREGIVER_COMMENT, {
        "action": "created", "comment": out.model_dump(mode="json"),
    }, actor_participant=participant)
    db.commit()
    return out


@router.patch("/sessions/{session_id}/comments/{comment_ref}", response_model=FamilyCaregiverCommentOut)
def update_caregiver_comment(
    session_id: str,
    comment_ref: str,
    body: FamilyCaregiverCommentUpdateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    participant = session_participant(session, current_user.id, db)
    comment = db.query(FamilyCaregiverComment).filter(
        FamilyCaregiverComment.family_session_id == session.id,
        FamilyCaregiverComment.public_id == comment_ref,
        FamilyCaregiverComment.deleted_at.is_(None),
    ).first()
    if not participant or not comment or comment.author_participant_id != participant.id:
        raise HTTPException(status_code=404, detail="Caregiver comment not found")
    comment.text = body.text.strip()
    db.add(FamilyCaregiverCommentAudit(comment_id=comment.id, actor_participant_id=participant.id, action="edited", text_snapshot=comment.text))
    db.flush()
    out = _comment_out(comment, db)
    _emit_event(db, session, FamilySessionEventType.CAREGIVER_COMMENT, {
        "action": "edited", "comment": out.model_dump(mode="json"),
    }, actor_participant=participant)
    db.commit()
    return out


@router.post("/sessions/{session_id}/commands", response_model=FamilySessionDetailOut)
def command_session(
    session_id: str,
    body: FamilySessionCommandRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    # The version check only protects concurrent commands when paired with a
    # row lock. The command ledger still makes retries return the first result.
    session = db.query(FamilySession).filter(FamilySession.id == session.id).with_for_update().one()
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
    actor_participant = session_participant(session, current_user.id, db)
    if command in LEARNER_OWNED_COMMANDS and (
        current_user.id != session.child_user_id
        or current_user.id != (session.participation_turn_user_id or session.child_user_id)
    ):
        _stale_state(session, current_user, db, "It is the learner’s turn to move the scenario forward")
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
            CheckpointResponse.responder_role == ParticipantRole.CHILD.value,
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
        _complete_session(session, db, actor_participant)
    elif command is FamilySessionCommandType.RESET:
        if is_terminal_family_session_state(session.state):
            _stale_state(session, current_user, db, "Completed attempts must be restarted from the scenario catalog")
        session.state = "abandoned"
        session.archived_at = now
        session.state_version += 1
        target = FamilySession(
            public_id=f"fs_{secrets.token_urlsafe(18)}", owner_user_id=session.owner_user_id or session.child_user_id,
            transcript_id=session.transcript_id,
            child_user_id=session.child_user_id,
            parent_user_id=session.parent_user_id,
            participation_turn_user_id=session.child_user_id,
            companion_mode=session.companion_mode,
            detective_mode=session.detective_mode,
            state="in_progress",
            revealed_up_to=-1,
            attempt_number=session.attempt_number + 1,
            previous_session_id=session.id,
        )
        db.add(target)
        db.flush()
        for member in db.query(FamilySessionParticipant).filter(FamilySessionParticipant.family_session_id == session.id).all():
            db.add(FamilySessionParticipant(family_session_id=target.id, user_id=member.user_id, role=member.role))
        eligible = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == target.transcript_id).count()
        db.add(SessionProgress(family_session_id=target.id, eligible_target_count=eligible, required_finding_count=eligible))

    if target is session:
        if command is FamilySessionCommandType.REVEAL_NEXT:
            _emit_event(db, session, FamilySessionEventType.REVEAL, _shared_state_payload(session), actor_participant=actor_participant)
        _emit_event(db, session, FamilySessionEventType.STATE_CHANGED, _shared_state_payload(session), actor_participant=actor_participant)
    else:
        _emit_event(db, session, FamilySessionEventType.STATE_CHANGED, _shared_state_payload(session), actor_participant=actor_participant)
        db.flush()
        _emit_event(db, target, FamilySessionEventType.PARTICIPANT_JOINED, {"member_ref": member_ref(current_user.id), "role": "learner"}, actor_participant=None)
        _emit_event(db, target, FamilySessionEventType.STATE_CHANGED, _shared_state_payload(target), actor_participant=None)

    db.add(FamilySessionCommand(
        family_session_id=session.id, client_command_id=body.client_command_id,
        command=command.value, expected_state_version=body.expected_state_version,
        resulting_session_id=target.id,
    ))
    db.commit()
    db.refresh(target)
    telemetry_record("family.session.transition", command=command.value, status=target.state)
    if target.state == "completed":
        telemetry_record("session.completed", channel="family")
    return _session_detail_out(target, current_user, db)


@router.get("/sessions/{session_id}/messages", response_model=list[FamilyMessageOut])
def get_messages(
    session_id: str,
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


@router.post("/sessions/join", response_model=FamilySessionDetailOut, status_code=status.HTTP_200_OK)
def join_session(
    body: JoinSessionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Caregiver joins a family session by entering the join code."""
    # Require caregiver to have an account.
    if not current_user.id:
        raise HTTPException(status_code=401, detail="Authentication required")

    # Find session by short code.
    session = db.query(FamilySession).filter(
        FamilySession.join_code_short == body.session_code.strip().upper(),
    ).first()
    if not session:
        raise HTTPException(status_code=404, detail="Invalid session code")

    # Validate session is still active.
    if is_terminal_family_session_state(session.state):
        raise HTTPException(status_code=400, detail="Session has ended")

    # Caregiver must not already be a participant.
    existing = db.query(FamilySessionParticipant).filter(
        FamilySessionParticipant.family_session_id == session.id,
        FamilySessionParticipant.user_id == current_user.id,
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You are already a member of this session")

    # Caregiver must have an active relationship with the learner.
    relationship = db.query(FamilyRelationship).filter(
        FamilyRelationship.learner_user_id == session.child_user_id,
        FamilyRelationship.caregiver_user_id == current_user.id,
        FamilyRelationship.status == "active",
    ).first()
    if not relationship:
        raise HTTPException(status_code=403, detail="You must be linked with the learner to join")

    # Verify the join code hash.
    salted = body.session_code.strip().upper() + (session.public_id or "")
    if session.join_code_hash != sha256(salted.encode()).hexdigest():
        raise HTTPException(status_code=404, detail="Invalid session code")

    # Add caregiver as participant.
    now = datetime.now(timezone.utc)
    participant = FamilySessionParticipant(
        family_session_id=session.id, user_id=current_user.id, role="caregiver",
        last_seen_at=now, last_heartbeat_at=now, presence_expires_at=now + timedelta(seconds=90),
        presence_status="online",
    )
    db.add(participant)
    db.flush()
    _emit_event(db, session, FamilySessionEventType.PARTICIPANT_JOINED,
        {"member_ref": member_ref(current_user.id), "role": "caregiver"}, actor_participant=participant)
    db.commit()
    db.refresh(session)
    return _session_detail_out(session, current_user, db)


@router.post("/sessions/{session_id}/generate-join-code", response_model=GenerateJoinCodeResponse, status_code=status.HTTP_200_OK)
def generate_join_code(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Generate a join code for an existing session. Only the learner can do this."""
    session = _load_session(session_id, current_user, db)
    if session.child_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the learner can generate a join code")

    # If code already exists, return it idempotently.
    if session.join_code_short:
        return GenerateJoinCodeResponse(join_code_short=session.join_code_short)

    if is_terminal_family_session_state(session.state):
        raise HTTPException(status_code=400, detail="Cannot generate join code for a completed/ended session")

    code = _generate_join_code(session)
    db.commit()
    db.refresh(session)
    return GenerateJoinCodeResponse(join_code_short=code)


@router.post("/sessions/{session_id}/checkpoint-responses", response_model=CheckpointResponseOut, status_code=status.HTTP_201_CREATED)
def record_checkpoint_response(
    session_id: str,
    body: CheckpointResponseRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    if session.completed_at:
        raise HTTPException(status_code=409, detail="Family session is already complete")
    if body.expected_state_version is not None and body.expected_state_version != session.state_version:
        _stale_state(session, current_user, db, "This session changed elsewhere; refresh and try again")
    if body.client_command_id:
        existing = db.query(CheckpointResponse).filter(
            CheckpointResponse.family_session_id == session.id,
            CheckpointResponse.client_command_id == body.client_command_id,
        ).first()
        if existing:
            return CheckpointResponseOut(
                id=existing.id, checkpoint_message_id=existing.checkpoint_message_id,
                responder_role=ParticipantRole(existing.responder_role), response_text=existing.response_text,
                flagged_message_ids=existing.flagged_message_ids or [], tactic_tag_guess=existing.tactic_tag_guess,
                created_at=_timestamp(existing.created_at) or "", visibility=existing.visibility,
            )
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
        visibility="shared" if expected_role is ParticipantRole.PARENT or body.share_with_caregiver else "private",
        client_command_id=body.client_command_id,
    )
    db.add(response)
    db.flush()
    _emit_event(db, session, FamilySessionEventType.CHECKPOINT_RESPONSE, {
        "checkpoint_message_id": checkpoint.id, "responder_role": response.responder_role,
        "shared": response.visibility == "shared",
    }, actor_participant=session_participant(session, current_user.id, db))
    db.commit()
    db.refresh(response)
    return CheckpointResponseOut(
        id=response.id,
        checkpoint_message_id=response.checkpoint_message_id,
        responder_role=ParticipantRole(response.responder_role),
        response_text=response.response_text,
        flagged_message_ids=response.flagged_message_ids or [],
        tactic_tag_guess=response.tactic_tag_guess,
        created_at=_timestamp(response.created_at) or "", visibility=response.visibility,
    )


@router.post("/sessions/{session_id}/complete", response_model=ConversationGuideOut)
def complete_session(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    existing = db.query(ConversationGuide).filter(ConversationGuide.family_session_id == session.id).first()
    if existing:
        return _guide_out(existing)
    if session.state not in {"completion_review", "help_and_resources"} or session.completion_acknowledged_at is None:
        _stale_state(session, current_user, db, "Acknowledge completion review before finishing")
    guide = _complete_session(session, db, session_participant(session, current_user.id, db))
    db.commit()
    db.refresh(guide)
    return _guide_out(guide)


@router.get("/sessions/{session_id}/conversation-guide", response_model=ConversationGuideOut)
def get_conversation_guide(
    session_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    session = _load_session(session_id, current_user, db)
    guide = db.query(ConversationGuide).filter(ConversationGuide.family_session_id == session.id).first()
    if not guide:
        raise HTTPException(status_code=404, detail="Conversation guide is not ready")
    return _guide_out(guide)
