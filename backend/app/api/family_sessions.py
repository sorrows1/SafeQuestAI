"""Authenticated family scenario routes; this player path makes no LLM calls."""
from __future__ import annotations

from datetime import datetime, timezone
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
    CuratedTranscript,
    FamilySession,
    RedFlagSpan,
    User,
    get_db,
)
from app.models.schemas import (
    CheckpointResponseOut,
    CheckpointResponseRequest,
    ConversationGuideOut,
    CreateFamilySessionRequest,
    FamilyMessageOut,
    FamilySessionOut,
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
        transcript_id=session.transcript_id,
        parent_user_id=session.parent_user_id,
        companion_mode=session.companion_mode,
        detective_mode=session.detective_mode,
        started_at=_timestamp(session.started_at) or "",
        completed_at=_timestamp(session.completed_at),
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
    if not session or current_user.id not in {session.child_user_id, session.parent_user_id}:
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
    if body.parent_user_id is not None:
        parent = db.get(User, body.parent_user_id)
        if not parent or not parent.is_active:
            raise HTTPException(status_code=422, detail="Parent user not found")
        if parent.id == current_user.id:
            raise HTTPException(status_code=422, detail="Parent and child must be different users")
    session = FamilySession(
        transcript_id=transcript.id,
        child_user_id=current_user.id,
        parent_user_id=body.parent_user_id,
        companion_mode=body.parent_user_id is None,
        detective_mode=body.detective_mode,
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return _session_out(session)


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
    transcript = db.get(CuratedTranscript, session.transcript_id)
    if not transcript:
        raise HTTPException(status_code=404, detail="Scenario not found")
    spans = db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == transcript.id).all()
    responses = (
        db.query(CheckpointResponse)
        .filter(CheckpointResponse.family_session_id == session.id)
        .order_by(CheckpointResponse.created_at, CheckpointResponse.id)
        .all()
    )
    companion_exchanges = (
        db.query(CompanionExchange)
        .filter(CompanionExchange.family_session_id == session.id)
        .order_by(CompanionExchange.created_at, CompanionExchange.id)
        .all()
    )
    guide = ConversationGuide(
        family_session_id=session.id,
        **build_conversation_guide(session, transcript.category, spans, responses, companion_exchanges),
    )
    session.completed_at = datetime.now(timezone.utc)
    db.add(guide)
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
