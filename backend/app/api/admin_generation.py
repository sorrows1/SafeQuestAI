"""Admin-only orchestration, review, and promotion for generated content."""
from __future__ import annotations

import asyncio
import json
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.generation.dual_agent_runner import DualAgentRunner, paced_message_delay
from app.generation.scorer import score_transcript
from app.models.orm import (ConversationMessage, ConversationSession, CuratedMessage,
    CuratedTranscript, RedFlagSpan, SessionLocal, User, get_db)
from app.models.schemas import ScenarioDefinition
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/generation", tags=["Admin - Generation"])

class GenerationRunConfig(BaseModel):
    scenario_id: str | None = None
    scenario: ScenarioDefinition | None = None
    difficulty: str | None = None
    is_positive_example: bool = True
    max_rounds: int | None = Field(default=None, ge=1, le=12)

    @model_validator(mode="after")
    def has_scenario(self):
        if not self.scenario_id and not self.scenario:
            raise ValueError("scenario_id or scenario is required")
        return self

class RedFlagSpanInput(BaseModel):
    message_sequence: int | None = Field(default=None, ge=0)
    start_offset: int | None = Field(default=None, ge=0)
    end_offset: int | None = Field(default=None, ge=0)
    tactic_tag: str

class ReviewDecision(BaseModel):
    status: str
    reviewer_notes: str | None = None
    edited_spans: list[RedFlagSpanInput] | None = None

class _RunChannel:
    def __init__(self):
        self.events: asyncio.Queue[tuple[str, dict[str, Any]]] = asyncio.Queue()
        self.resume_event = asyncio.Event(); self.resume_event.set()
        self.subscribers = 0
        self.task: asyncio.Task[None] | None = None

_channels: dict[int, _RunChannel] = {}
def _channel(run_id: int) -> _RunChannel: return _channels.setdefault(run_id, _RunChannel())
def _state(session: ConversationSession, **updates: Any) -> None: session.state = {**(session.state or {}), **updates}

def _run_config(session: ConversationSession) -> tuple[ScenarioDefinition, dict[str, Any]]:
    data = (session.state or {}).get("generation_config")
    if not isinstance(data, dict) or not isinstance(data.get("scenario"), dict):
        raise HTTPException(422, "Generation configuration is unavailable")
    return ScenarioDefinition.model_validate(data["scenario"]), data

def _scenario(config: GenerationRunConfig, db: Session) -> ScenarioDefinition:
    if config.scenario: return config.scenario
    item = content_repo.get_scenario(db, config.scenario_id or "")
    if not item: raise HTTPException(404, "Scenario not found")
    return item

def _get_llm():
    from app.main import llm_service
    if llm_service is None: raise HTTPException(503, "LLM service is unavailable")
    return llm_service

def pacing_delay(pace: str, content: str) -> float:
    """Server-owned, bounded pacing. Message text never supplies a timer."""
    base = {"quick": .40, "normal": .75, "soon": .75,
            "after_a_pause": 1.55, "much_later": 2.75}.get(pace, .75)
    jitter = ((sum(map(ord, content)) % 17) - 8) / 100
    return max(.40, min(4.0, base + min(len(content) * .012, 1.1) + jitter))

async def _publish(run_id: int) -> None:
    """The stream subscriber determines whether persisted bubbles are paced."""
    channel, db = _channel(run_id), SessionLocal()
    try:
        messages = (db.query(ConversationMessage).filter(ConversationMessage.session_id == run_id)
                    .order_by(ConversationMessage.id).all())
        for message in messages:
            await channel.resume_event.wait()
            metadata = message.metadata_json or {}
            await channel.events.put(("typing_start", {"sender": message.sender}))
            if channel.subscribers:
                await asyncio.sleep(paced_message_delay(str(metadata.get("pace", "normal")), message.content))
            await channel.events.put(("message", {"id": message.id, "sender": message.sender,
                "content": message.content, "metadata": metadata}))
            await channel.events.put(("turn_complete", {"sender": message.sender}))
        await channel.events.put(("run_status", {"run_id": run_id, "status": "pending"}))
    finally: db.close()

async def _generate(run_id: int) -> None:
    db = SessionLocal()
    try:
        session = db.get(ConversationSession, run_id)
        if not session: return
        scenario, config = _run_config(session)
        await DualAgentRunner(_get_llm()).generate(scenario, db, difficulty=config.get("difficulty"),
            is_negative_example=not bool(config.get("is_positive_example", True)),
            max_rounds=config.get("max_rounds"), session=session)
        await _channel(run_id).resume_event.wait()
        db.refresh(session)
        _state(session, status="pending"); db.commit()
        await _publish(run_id)
    except Exception as exc:
        db.rollback(); session = db.get(ConversationSession, run_id)
        if session: _state(session, status="failed", error=str(getattr(exc, "detail", exc))); db.commit()
        await _channel(run_id).events.put(("run_status", {"run_id": run_id, "status": "failed"}))
    finally: db.close()

def _start(run_id: int) -> None:
    channel = _channel(run_id)
    if not channel.task or channel.task.done(): channel.task = asyncio.create_task(_generate(run_id))

def _load(run_id: int, db: Session) -> ConversationSession:
    item = db.get(ConversationSession, run_id)
    if not item: raise HTTPException(404, "Generation run not found")
    return item

@router.post("/runs", status_code=202)
async def start_run(config: GenerationRunConfig, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    scenario = _scenario(config, db)
    session = ConversationSession(scenario_id=scenario.id, difficulty=config.difficulty or scenario.difficulty.value,
        state={"status": "generating", "generation_config": {"scenario": scenario.model_dump(mode="json"),
               **config.model_dump(exclude={"scenario"})}, "is_positive_example": config.is_positive_example})
    db.add(session); db.commit(); db.refresh(session); _start(session.id)
    return {"run_id": session.id, "status": "generating"}

@router.get("/runs/{run_id}/stream")
async def stream_run(run_id: int, _: User = Depends(require_admin)):
    channel = _channel(run_id)
    async def events():
        channel.subscribers += 1
        try:
            yield f"event: run_status\ndata: {json.dumps({'run_id': run_id, 'status': 'connected'})}\n\n"
            while True:
                event, data = await channel.events.get()
                yield f"event: {event}\ndata: {json.dumps(data, default=str)}\n\n"
                if event == "run_status" and data.get("status") in {"pending", "failed", "approved", "rejected"}: break
        finally: channel.subscribers = max(0, channel.subscribers - 1)
    return StreamingResponse(events(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

@router.post("/runs/{run_id}/pause")
def pause_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    session = _load(run_id, db)
    if (session.state or {}).get("status") != "generating": raise HTTPException(409, "Only a generating run can be paused")
    _channel(run_id).resume_event.clear(); _state(session, status="paused"); db.commit()
    return {"run_id": run_id, "status": "paused"}

@router.post("/runs/{run_id}/resume")
def resume_run(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    session = _load(run_id, db)
    if (session.state or {}).get("status") != "paused": raise HTTPException(409, "Only a paused run can be resumed")
    _channel(run_id).resume_event.set(); _state(session, status="generating"); db.commit()
    return {"run_id": run_id, "status": "generating"}

@router.post("/runs/{run_id}/regenerate-last-turn", status_code=202)
async def regenerate_last_turn(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    session = _load(run_id, db)
    if (session.state or {}).get("status") != "pending": raise HTTPException(409, "Wait for the current run before regenerating")
    messages = db.query(ConversationMessage).filter(ConversationMessage.session_id == run_id).order_by(ConversationMessage.id).all()
    if not messages: raise HTTPException(409, "Run has no turn to regenerate")
    sender, keep = messages[-1].sender, list(messages)
    while keep and keep[-1].sender == sender: db.delete(keep.pop())
    _state(session, status="regenerating", regenerated_sender=sender); db.commit()
    channel = _channel(run_id)
    while not channel.events.empty(): channel.events.get_nowait()
    async def replace():
        local = SessionLocal()
        try:
            item = _load(run_id, local); scenario, config = _run_config(item)
            history = [{"sender": m.sender, "content": m.content} for m in keep]
            runner = DualAgentRunner(_get_llm())
            raw = await runner._generate_turn(scenario, sender, history, runner._constraints_for(scenario),
                not bool(config.get("is_positive_example", True)))
            texts, tags = runner._normalise_turn(raw, scenario.category)
            for content in texts:
                runner._assert_safe(scenario.category, content)
                local.add(ConversationMessage(session_id=run_id, sender=sender, content=content,
                    metadata_json={"tactic_tags": tags, "pace": "quick" if len(texts) > 1 else "normal"}))
            all_messages = local.query(ConversationMessage).filter(ConversationMessage.session_id == run_id).all()
            score = score_transcript(scenario.category, all_messages, is_negative_example=not bool(config.get("is_positive_example", True)))
            _state(item, tactic_tags=score.tactic_tags, coverage=score.coverage, status="pending"); local.commit()
            await channel.events.put(("run_status", {"run_id": run_id, "status": "reset"})); await _publish(run_id)
        except Exception as exc:
            local.rollback(); item = local.get(ConversationSession, run_id)
            if item: _state(item, status="failed", error=str(getattr(exc, "detail", exc))); local.commit()
            await channel.events.put(("run_status", {"run_id": run_id, "status": "failed"}))
        finally: local.close()
    channel.task = asyncio.create_task(replace())
    return {"run_id": run_id, "status": "regenerating"}

def _review_row(session: ConversationSession) -> dict[str, Any]:
    state = session.state or {}
    return {"id": session.id, "scenario_id": session.scenario_id, "difficulty": session.difficulty,
        "status": state.get("status", "pending"), "category": state.get("category"),
        "is_positive_example": state.get("is_positive_example", True), "created_at": session.created_at}

@router.get("/review-queue")
def review_queue(status: str = "pending", db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [_review_row(x) for x in db.query(ConversationSession).order_by(ConversationSession.created_at.desc()).all()
            if (x.state or {}).get("status") == status]

@router.get("/review-queue/{item_id}")
def review_item(item_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    session = _load(item_id, db); scenario, config = _run_config(session)
    messages = db.query(ConversationMessage).filter(ConversationMessage.session_id == item_id).order_by(ConversationMessage.id).all()
    score = score_transcript(scenario.category, messages, is_negative_example=not bool(config.get("is_positive_example", True)))
    return {**_review_row(session), "transcript": [{"id": m.id, "sender": m.sender, "content": m.content,
        "metadata": m.metadata_json or {}} for m in messages], "auto_scores": {"tactic_tags": score.tactic_tags,
        "coverage": score.coverage, "is_negative_example": score.is_negative_example}}

def _labels(session: ConversationSession, db: Session) -> dict[str, str]:
    scenario, _ = _run_config(session); persona = content_repo.get_persona(db, scenario.persona)
    return {"initiator": persona.display_name if persona else scenario.display_name, "respondent": "You",
            "authored_moment": scenario.display_name}

def _promote(session: ConversationSession, decision: ReviewDecision, reviewer: User, db: Session) -> CuratedTranscript:
    scenario, config = _run_config(session)
    source = db.query(ConversationMessage).filter(ConversationMessage.session_id == session.id).order_by(ConversationMessage.id).all()
    score = score_transcript(scenario.category, source, is_negative_example=not bool(config.get("is_positive_example", True)))
    transcript = CuratedTranscript(source_session_id=session.id, is_grooming=bool(config.get("is_positive_example", True)),
        difficulty=session.difficulty, tactic_tags=score.tactic_tags, reviewed_by=reviewer.id, reviewed_at=datetime.now(timezone.utc),
        is_published=False, category=scenario.category.value, render_skin=scenario.render_skin.value)
    db.add(transcript); db.flush(); labels = _labels(session, db)
    for sequence, message in enumerate(source):
        meta = message.metadata_json or {}
        db.add(CuratedMessage(transcript_id=transcript.id, sequence=sequence,
            speaker_label=labels.get(message.sender, scenario.display_name), content=message.content,
            pace=str(meta.get("pace", "normal")), is_checkpoint=bool(meta.get("is_checkpoint", False)),
            checkpoint_prompt=meta.get("checkpoint_prompt")))
    if decision.edited_spans is not None:
        for span in decision.edited_spans:
            db.add(RedFlagSpan(transcript_id=transcript.id, message_sequence=span.message_sequence,
                start_offset=span.start_offset, end_offset=span.end_offset, tactic_tag=span.tactic_tag, source="reviewer"))
    else:
        for sequence, message in enumerate(source):
            for tag in (message.metadata_json or {}).get("tactic_tags", []):
                db.add(RedFlagSpan(transcript_id=transcript.id, message_sequence=sequence, tactic_tag=str(tag), source="auto"))
    return transcript

@router.post("/runs/{run_id}/decision")
@router.post("/review-queue/{run_id}/decision")
def decide_run(run_id: int, decision: ReviewDecision, db: Session = Depends(get_db), reviewer: User = Depends(require_admin)):
    if decision.status not in {"approved", "rejected"}: raise HTTPException(422, "status must be approved or rejected")
    session = _load(run_id, db)
    if (session.state or {}).get("status") != "pending": raise HTTPException(409, "Only pending runs can be decided")
    transcript = None
    if decision.status == "approved":
        transcript = _promote(session, decision, reviewer, db)
    _state(session, status=decision.status, reviewer_notes=decision.reviewer_notes,
           curated_transcript_id=transcript.id if transcript else None)
    db.commit()
    return {"run_id": run_id, "status": decision.status, "curated_transcript_id": transcript.id if transcript else None}

@router.get("/runs")
def list_runs(stats: bool = False, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    rows = db.query(ConversationSession).all()
    if not stats: return [_review_row(x) for x in rows]
    categories: dict[str, dict[str, int | float | None]] = {}
    for row in rows:
        state = row.state or {}; category = str(state.get("category", "unknown"))
        bucket = categories.setdefault(category, {"positive": 0, "negative": 0, "pending_review": 0})
        bucket["positive" if state.get("is_positive_example", True) else "negative"] += 1
        if state.get("status") == "pending": bucket["pending_review"] += 1
    for bucket in categories.values():
        bucket["positive_negative_ratio"] = None if not bucket["negative"] else bucket["positive"] / bucket["negative"]
    return {"categories": categories}
