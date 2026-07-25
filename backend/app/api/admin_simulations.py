"""Phase 2 admin-only durable simulation and publication API."""
from __future__ import annotations
import asyncio
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session
from app.auth.security import require_admin
from app.generation.scorer import score_transcript
from app.models.orm import (ConversationMessage, ConversationSession, CuratedMessage, CuratedTranscript, RedFlagSpan, SimulationEvent, SimulationMessage, SimulationMessageRevision, SimulationRun, User, get_db)
from app.models.schemas import ScenarioDefinition
from app.repositories import content_repo
from app.simulation.runtime import SimulationRuntime

router = APIRouter(prefix="/api/admin", tags=["Admin - Simulations"])
def llm():
    from app.main import llm_service
    if llm_service is None: raise HTTPException(503, "LLM service is unavailable")
    return llm_service
runtime = SimulationRuntime(llm)

class CreateRequest(BaseModel):
    scenario_id: str | None = None
    scenario: ScenarioDefinition | None = None
    mode: Literal["ai_vs_ai", "admin_as_respondent", "single_pass"] = "ai_vs_ai"
    is_negative_example: bool = False
    @model_validator(mode="after")
    def scenario_present(self):
        if not self.scenario_id and not self.scenario: raise ValueError("scenario_id or scenario is required")
        return self
class ResumeRequest(BaseModel): extend_limits: bool = False
class RespondRequest(BaseModel): content: str = Field(min_length=1, max_length=10_000)
class EditRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    reason: str | None = Field(default=None, max_length=500)
class DecisionRequest(BaseModel):
    status: Literal["approved", "rejected"]
    reviewer_notes: str | None = None

def run_or_404(db: Session, run_id: int) -> SimulationRun:
    run = db.get(SimulationRun, run_id)
    if not run: raise HTTPException(404, "Simulation not found")
    return run

def message_out(item: SimulationMessage, debug: bool) -> dict:
    meta = dict(item.metadata_json or {})
    if not debug: meta.pop("prompt", None); meta.pop("state_before", None)
    return {"id": item.id, "sequence": item.sequence, "branch_id": item.branch_id, "sender": item.sender, "content": item.content, "metadata": meta, "created_at": item.created_at}

def detail(db: Session, run: SimulationRun, debug: bool) -> dict:
    snap, state = run.config_snapshot or {}, run.state or {}
    revisions = db.query(SimulationMessageRevision).join(SimulationMessage).filter(SimulationMessage.run_id == run.id).order_by(SimulationMessageRevision.id).all()
    return {"id": run.id, "scenario_id": run.scenario_id, "mode": run.mode, "status": run.status, "created_at": run.created_at, "stop_reason": run.stop_reason, "usage": run.resource_usage or {}, "progress": run.progress or {}, "worker_status": run.worker_lease or {}, "diagnostics": {"objectives": state.get("completed_objectives", []), "progression": state, "flags": state.get("flags", [])}, "personas": snap.get("personas", {}), "prompts": snap.get("prompts", {}), "messages": [message_out(x, debug) for x in runtime.active_messages(db, run)], "revisions": [{"id": x.id, "message_id": x.message_id, "number": x.revision_number, "content": x.content, "metadata": x.metadata_json or {}, "supersedes_revision_id": x.supersedes_revision_id, "created_at": x.created_at} for x in revisions]}

@router.post("/simulations", status_code=202)
async def create(body: CreateRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    scenario = body.scenario or content_repo.get_scenario(db, body.scenario_id or "")
    if not scenario: raise HTTPException(404, "Scenario not found")
    run = runtime.create_run(db, scenario, admin.id, body.mode, body.is_negative_example); runtime.start(run.id)
    return {"id": run.id, "status": run.status, "mode": run.mode}

@router.get("/simulations")
def list_runs(status: str | None = None, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    query = db.query(SimulationRun).order_by(SimulationRun.created_at.desc())
    if status: query = query.filter(SimulationRun.status == status)
    return [{"id": x.id, "scenario_id": x.scenario_id, "mode": x.mode, "status": x.status, "created_at": x.created_at, "usage": x.resource_usage} for x in query.all()]

@router.get("/simulations/{run_id}")
def get_run(run_id: int, debug_detail: bool = False, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return detail(db, run_or_404(db, run_id), debug_detail)

@router.get("/simulations/{run_id}/events")
async def events(run_id: int, last_event_id: str | None = Header(default=None, alias="Last-Event-ID"), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run_or_404(db, run_id); cursor = int(last_event_id or 0)
    async def stream():
        nonlocal cursor
        from app.models.orm import SessionLocal
        while True:
            local = SessionLocal()
            try:
                rows = local.query(SimulationEvent).filter(SimulationEvent.run_id == run_id, SimulationEvent.id > cursor).order_by(SimulationEvent.id).all()
                for row in rows:
                    cursor = row.id
                    yield f"id: {row.id}\nevent: {row.event_type}\ndata: {json.dumps(row.payload, default=str)}\n\n"
                run = local.get(SimulationRun, run_id)
                if run and run.status in {"ready_for_review", "approved", "rejected", "failed", "limit_reached"}: return
            finally: local.close()
            await asyncio.sleep(.35)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})

@router.post("/simulations/{run_id}/pause")
def pause(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = run_or_404(db, run_id); runtime.pause(db, run); return {"id": run.id, "status": run.status}
@router.post("/simulations/{run_id}/resume")
def resume(run_id: int, body: ResumeRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = run_or_404(db, run_id); runtime.resume(db, run, body.extend_limits); return {"id": run.id, "status": run.status}
@router.post("/simulations/{run_id}/stop")
def stop(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = run_or_404(db, run_id); runtime.stop(db, run); return {"id": run.id, "status": run.status}
@router.post("/simulations/{run_id}/respond", status_code=202)
def respond(run_id: int, body: RespondRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id); runtime.admin_response(db, run, body.content, admin.id); return {"id": run.id, "status": run.status}
@router.post("/simulations/{run_id}/regenerate-last-turn", status_code=202)
def regenerate(run_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id); runtime.regenerate_last(db, run, admin.id); return {"id": run.id, "status": run.status}
@router.patch("/simulations/{run_id}/messages/{message_id}")
def edit(run_id: int, message_id: int, body: EditRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id); runtime.edit(db, run, message_id, body.content, admin.id, body.reason); return detail(db, run, False)

def promote(db: Session, run: SimulationRun, reviewer: User, notes: str | None) -> CuratedTranscript:
    active, scenario = runtime.active_messages(db, run), run.config_snapshot["scenario"]
    source = ConversationSession(scenario_id=run.scenario_id or "simulation", difficulty=scenario.get("difficulty", "Medium"), state={"simulation_run_id": run.id, "reviewer_notes": notes}); db.add(source); db.flush()
    for item in active: db.add(ConversationMessage(session_id=source.id, sequence=item.sequence, branch_id=item.branch_id, sender=item.sender, content=item.content, metadata_json=item.metadata_json))
    score = score_transcript(scenario["category"], active, is_negative_example=bool((run.state or {}).get("is_negative_example", False)))
    transcript = CuratedTranscript(source_session_id=source.id, source_scenario_id=run.scenario_id, public_metadata_snapshot=runtime.public_snapshot(run.config_snapshot), is_concerning_example=not bool((run.state or {}).get("is_negative_example", False)), difficulty=scenario.get("difficulty", "Medium"), tactic_tags=score.tactic_tags, reviewed_by=reviewer.id, reviewed_at=datetime.now(timezone.utc), is_published=False, category=scenario["category"], render_skin=scenario.get("render_skin", "chat")); db.add(transcript); db.flush()
    labels = {role: info.get("display_name", role) for role, info in run.config_snapshot.get("personas", {}).items()}; labels["authored_moment"] = scenario.get("display_name", "Scenario")
    for item in active:
        meta = item.metadata_json or {}; db.add(CuratedMessage(transcript_id=transcript.id, sequence=item.sequence, speaker_label=labels.get(item.sender, item.sender), content=item.content, pace=meta.get("pace", "normal"), is_checkpoint=bool(meta.get("is_checkpoint", False)), checkpoint_prompt=meta.get("checkpoint_prompt")))
        for tag in meta.get("tactic_tags", []): db.add(RedFlagSpan(transcript_id=transcript.id, message_sequence=item.sequence, tactic_tag=str(tag), source="auto"))
    return transcript

@router.post("/simulations/{run_id}/decision")
def decision(run_id: int, body: DecisionRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    if run.status != "ready_for_review": raise HTTPException(409, "Only review-ready simulations can be decided")
    transcript = promote(db, run, admin, body.reviewer_notes) if body.status == "approved" else None; run.status = body.status; runtime.event(db, run, "run_status", {"status": run.status, "curated_transcript_id": transcript.id if transcript else None}); db.commit()
    return {"id": run.id, "status": run.status, "curated_transcript_id": transcript.id if transcript else None}
@router.get("/review-queue")
def review_queue(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [{"id": x.id, "scenario_id": x.scenario_id, "mode": x.mode, "status": x.status, "created_at": x.created_at} for x in db.query(SimulationRun).filter(SimulationRun.status == "ready_for_review").order_by(SimulationRun.created_at.desc()).all()]
@router.post("/curated-transcripts/{transcript_id}/publish")
def publish(transcript_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.get(CuratedTranscript, transcript_id)
    if not item: raise HTTPException(404, "Curated transcript not found")
    item.is_published, item.published_at = True, datetime.now(timezone.utc); db.commit(); return {"id": item.id, "is_published": True}
@router.post("/curated-transcripts/{transcript_id}/unpublish")
def unpublish(transcript_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.get(CuratedTranscript, transcript_id)
    if not item: raise HTTPException(404, "Curated transcript not found")
    item.is_published, item.published_at = False, None; db.commit(); return {"id": item.id, "is_published": False}
