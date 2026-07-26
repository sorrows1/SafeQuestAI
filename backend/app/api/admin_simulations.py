"""Phase 2 admin-only durable simulation and publication API."""
from __future__ import annotations
import asyncio
import json
from datetime import datetime, timezone
from typing import Literal
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field, model_validator
from sqlalchemy.orm import Session
from app.auth.security import require_admin
from app.config.rollout import FeatureFlag, require_feature
from app.telemetry import record as telemetry_record
from app.generation.scorer import score_transcript
from app.models.orm import (ConversationMessage, ConversationSession, CuratedMessage, CuratedSceneElement, CuratedTranscript,
                            RedFlagSpan, SimulationEvent, SimulationMessage, SimulationMessageRevision, SimulationRun, User, get_db)
from app.models.schemas import (AdminSceneDraft, RenderSkin, SceneAnnotationDraft, SceneDefinition, SceneElement, ScenarioCategory,
                                ScenarioDefinition, validate_scene_draft_for_publication, validate_scene_for_skin)
from app.repositories import content_repo
from app.simulation.runtime import SimulationRuntime

router = APIRouter(prefix="/api/admin", tags=["Admin - Simulations"])


def llm():
    from app.main import llm_service
    if llm_service is None:
        raise HTTPException(503, "LLM service is unavailable")
    return llm_service


runtime = SimulationRuntime(llm)


class CreateRequest(BaseModel):
    scenario_id: str | None = None
    scenario: ScenarioDefinition | None = None
    mode: Literal["ai_vs_ai", "admin_as_respondent",
                  "single_pass"] = "ai_vs_ai"
    is_negative_example: bool = False

    @model_validator(mode="after")
    def scenario_present(self):
        if not self.scenario_id and not self.scenario:
            raise ValueError("scenario_id or scenario is required")
        return self


class ResumeRequest(BaseModel):
    extend_limits: bool = False


class RespondRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)


class EditRequest(BaseModel):
    content: str = Field(min_length=1, max_length=10_000)
    reason: str | None = Field(default=None, max_length=500)


class DecisionRequest(BaseModel):
    status: Literal["approved", "rejected"]
    reviewer_notes: str | None = None


def run_or_404(db: Session, run_id: int) -> SimulationRun:
    run = db.get(SimulationRun, run_id)
    if not run:
        raise HTTPException(404, "Simulation not found")
    return run


EVENT_PRESENTATION = {
    "run_status": ("lifecycle", "info", "Run status changed"),
    "message": ("transcript", "info", "Transcript message added"),
    "turn_complete": ("transcript", "info", "Turn completed"),
    "message_revised": ("revision", "warning", "Message revision created"),
    "resource_warning": ("resources", "warning", "Resource limit warning"),
}


def _timestamp(value: datetime | str | None) -> str | None:
    return value.isoformat() if isinstance(value, datetime) else value


def _redact_metadata(metadata: dict, advanced_raw: bool) -> dict:
    result = dict(metadata)
    if not advanced_raw:
        result.pop("prompt", None)
        result.pop("state_before", None)
        result.pop("rendered_layers", None)
    return result


def message_out(item: SimulationMessage, advanced_raw: bool) -> dict:
    return {
        "id": item.id, "sequence": item.sequence, "branch_id": item.branch_id,
        "sender": item.sender, "content": item.content,
        "metadata": _redact_metadata(item.metadata_json or {}, advanced_raw),
        "created_at": _timestamp(item.created_at),
    }


def event_out(item: SimulationEvent, advanced_raw: bool) -> dict:
    category, severity, label = EVENT_PRESENTATION.get(
        item.event_type, ("system", "info", item.event_type.replace("_", " ").capitalize())
    )
    if item.event_type == "run_status" and (item.payload or {}).get("status") == "failed":
        severity, label = "error", "Run failed"
    if item.event_type == "run_status" and (item.payload or {}).get("status") == "limit_reached":
        category, severity, label = "resources", "warning", "Resource limit reached"
    payload = dict(item.payload or {})
    for key in ("prompt", "state_before", "rendered_layers"):
        payload.pop(key, None)
    result = {
        "id": item.id, "sequence": item.sequence, "event_type": item.event_type,
        "category": category, "severity": severity, "label": label,
        "created_at": _timestamp(item.created_at), "payload": payload,
    }
    if advanced_raw:
        result["raw_payload"] = item.payload or {}
    return result


def derive_diagnostics(run: SimulationRun, messages: list[SimulationMessage],
                       revisions: list[SimulationMessageRevision], advanced_raw: bool = False) -> dict:
    """Return stable, compact diagnostics without leaking rendered prompt text by default."""
    snapshot, state, usage, progress = run.config_snapshot or {}, run.state or {}, run.resource_usage or {}, run.progress or {}
    completed = list(dict.fromkeys(str(value) for value in state.get("completed_objectives", []) if value))
    objective_ids = [
        str(objective) for step in snapshot.get("scenario", {}).get("stage_sequence", [])
        for objective in [*step.get("mandatory_objectives", []), *step.get("optional_objectives", [])]
    ]
    pending = [objective for objective in dict.fromkeys(objective_ids) if objective not in completed]
    flags = [str(flag) for flag in state.get("flags", []) if flag]
    tactic_tags = sorted({str(tag) for message in messages for tag in (message.metadata_json or {}).get("tactic_tags", []) if tag})
    resource_warnings = [int(value) for value in state.get("resource_warnings", []) if str(value).isdigit()]
    warnings = [
        {"code": f"RESOURCE_{percent}_PERCENT", "message": f"Resource usage reached {percent}%.", "severity": "warning", "source": "resource_limits"}
        for percent in resource_warnings
    ]
    if run.status == "failed":
        warnings.append({"code": "RUN_FAILED", "message": run.stop_reason or "The simulation worker failed.", "severity": "error", "source": "runtime"})
    if run.status == "limit_reached":
        warnings.append({"code": "RESOURCE_LIMIT_REACHED", "message": "The simulation reached its configured resource limit.", "severity": "warning", "source": "resource_limits"})
    safety = [
        {"code": flag.upper().replace(" ", "_"), "message": flag.replace("_", " ").capitalize(),
         "severity": "error" if "unsafe" in flag.lower() or "violation" in flag.lower() else "warning", "source": "llm_evaluation"}
        for flag in flags
    ]
    provenance = []
    for role, prompt in (snapshot.get("prompts") or {}).items():
        provenance.append({"id": str(prompt.get("name", role)), "name": str(prompt.get("name", role)), "role": role,
                           "version": prompt.get("version"), "hash": prompt.get("hash"), "role_scope": prompt.get("role_scope")})
    for role, prompt in (snapshot.get("system_prompts") or {}).items():
        provenance.append({"id": str(prompt.get("name", role)), "name": str(prompt.get("name", role)), "role": f"{role}:system",
                           "version": prompt.get("version"), "hash": prompt.get("hash"), "role_scope": prompt.get("role_scope")})
    messages_used, message_limit = int(usage.get("messages", 0)), int(usage.get("message_limit", 0))
    seconds, minute_limit = int(usage.get("running_seconds", 0)), int(usage.get("minute_limit", 0))
    if run.status == "running" and state.get("running_started_at"):
        try:
            seconds += max(0, int((datetime.now(timezone.utc) - datetime.fromisoformat(state["running_started_at"])).total_seconds()))
        except (TypeError, ValueError):
            pass
    message_percent = min(100, round(messages_used * 100 / message_limit)) if message_limit else 0
    time_percent = min(100, round(seconds * 100 / (minute_limit * 60))) if minute_limit else 0
    lease = run.worker_lease or {}
    lease_until = lease.get("expires_at")
    try:
        lease_healthy = bool(lease_until and datetime.fromisoformat(lease_until) > datetime.now(timezone.utc))
    except (TypeError, ValueError):
        lease_healthy = False
    if run.status != "running":
        lease_state = "not_required"
    elif lease_healthy:
        lease_state = "healthy"
    elif lease_until:
        lease_state = "expired"
    else:
        lease_state = "unassigned"
    branch_ids = {message.branch_id for message in messages}
    active_branch = str(progress.get("active_branch", "main"))
    latest_revision = revisions[-1].id if revisions else None
    return {
        "diagnostics": {
            "progression": {"current_stage": state.get("current_stage"), "next_stage": state.get("next_stage"),
                            "current_objective": state.get("current_objective"), "completed_objectives": completed},
            "objectives": {"current": state.get("current_objective"), "completed": completed, "pending": pending},
            "warnings": warnings, "safety_findings": safety, "tactic_tags": tactic_tags,
            "prompt_provenance": provenance,
        },
        "resource_usage": {"messages": messages_used, "message_limit": message_limit, "message_percent": message_percent,
                           "running_seconds": seconds, "minute_limit": minute_limit, "time_percent": time_percent,
                           "llm_calls": int(usage.get("llm_calls", 0)), "prompt_tokens": int(usage.get("prompt_tokens", 0)),
                           "completion_tokens": int(usage.get("completion_tokens", 0))},
        "worker_lease": {"worker_id": None, "leased_until": lease_until, "state": lease_state, "healthy": lease_healthy},
        "branch_summary": {"active_branch": active_branch, "branch_count": max(1, len(branch_ids)),
                           "revision_count": len(revisions), "latest_revision_id": latest_revision},
    }


def detail(db: Session, run: SimulationRun, advanced_raw: bool = False) -> dict:
    snapshot = run.config_snapshot or {}
    messages = runtime.active_messages(db, run)
    revisions = db.query(SimulationMessageRevision).join(SimulationMessage).filter(
        SimulationMessage.run_id == run.id).order_by(SimulationMessageRevision.id).all()
    events = db.query(SimulationEvent).filter(SimulationEvent.run_id == run.id).order_by(
        SimulationEvent.id.desc()).limit(100).all()[::-1]
    derived = derive_diagnostics(run, messages, revisions, advanced_raw)
    result = {
        "id": run.id, "scenario_id": run.scenario_id, "mode": run.mode, "status": run.status,
        "created_at": _timestamp(run.created_at), "stop_reason": run.stop_reason,
        "overview": {"id": run.id, "scenario_id": run.scenario_id, "mode": run.mode, "status": run.status,
                     "created_at": _timestamp(run.created_at), "stop_reason": run.stop_reason},
        **derived,
        "messages": [message_out(item, advanced_raw) for item in messages],
        "revisions": [{"id": item.id, "message_id": item.message_id, "number": item.revision_number,
                       "content": item.content, "metadata": _redact_metadata(item.metadata_json or {}, advanced_raw),
                       "supersedes_revision_id": item.supersedes_revision_id, "created_at": _timestamp(item.created_at)} for item in revisions],
        "events": [event_out(item, advanced_raw) for item in events],
        # Legacy compact fields remain for existing workbench controllers during the UI migration.
        "usage": run.resource_usage or {}, "progress": run.progress or {}, "worker_status": run.worker_lease or {},
        "personas": snapshot.get("personas", {}),
        "prompts": {item["role"]: {key: item[key] for key in ("id", "name", "version", "hash", "role_scope")} for item in derived["diagnostics"]["prompt_provenance"]},
    }
    if advanced_raw:
        result["raw_diagnostics"] = {"state": run.state or {}, "progress": run.progress or {}, "usage": run.resource_usage or {},
                                      "worker_lease": run.worker_lease or {}, "config_snapshot": snapshot}
    return result


@router.post("/simulations", status_code=202)
async def create(body: CreateRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    scenario = body.scenario or content_repo.get_scenario(
        db, body.scenario_id or "")
    if not scenario:
        raise HTTPException(404, "Scenario not found")
    run = runtime.create_run(db, scenario, admin.id,
                             body.mode, body.is_negative_example)
    runtime.start(run.id)
    return {"id": run.id, "status": run.status, "mode": run.mode}


def run_summary(run: SimulationRun) -> dict:
    return {"id": run.id, "scenario_id": run.scenario_id, "mode": run.mode, "status": run.status,
            "created_at": _timestamp(run.created_at), "stop_reason": run.stop_reason,
            "resource_usage": derive_diagnostics(run, [], [])["resource_usage"]}


def filtered_runs(db: Session, status: str | None, scenario_id: str | None, mode: str | None):
    query = db.query(SimulationRun)
    if status:
        query = query.filter(SimulationRun.status.in_([value.strip() for value in status.split(",") if value.strip()]))
    if scenario_id:
        query = query.filter(SimulationRun.scenario_id == scenario_id)
    if mode:
        query = query.filter(SimulationRun.mode == mode)
    return query.order_by(SimulationRun.created_at.desc())


@router.get("/simulations")
def list_runs(status: str | None = None, scenario_id: str | None = None, mode: str | None = None,
              db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Compatibility list; use /history for a paginated admin history."""
    return [run_summary(run) for run in filtered_runs(db, status, scenario_id, mode).all()]


@router.get("/simulations/history")
def run_history(status: str | None = None, scenario_id: str | None = None, mode: str | None = None,
                page: int = Query(default=1, ge=1), page_size: int = Query(default=50, ge=1, le=200),
                db: Session = Depends(get_db), _: User = Depends(require_admin)):
    require_feature(FeatureFlag.ADMIN_DIAGNOSTICS)
    telemetry_record("admin.diagnostics", source="run_history")
    query = filtered_runs(db, status, scenario_id, mode)
    total = query.count()
    runs = query.offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [run_summary(run) for run in runs], "page": page, "page_size": page_size, "total": total}


@router.get("/simulations/{run_id}")
def get_run(run_id: int, advanced_raw: bool = False, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    require_feature(FeatureFlag.ADMIN_DIAGNOSTICS)
    telemetry_record("admin.diagnostics", source="run_detail")
    return detail(db, run_or_404(db, run_id), advanced_raw)


@router.get("/simulations/{run_id}/history")
def event_history(run_id: int, event_type: str | None = None, severity: str | None = None,
                  page: int = Query(default=1, ge=1), page_size: int = Query(default=100, ge=1, le=200),
                  advanced_raw: bool = False, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    require_feature(FeatureFlag.ADMIN_DIAGNOSTICS)
    telemetry_record("admin.diagnostics", source="event_history")
    run_or_404(db, run_id)
    query = db.query(SimulationEvent).filter(SimulationEvent.run_id == run_id)
    if event_type:
        query = query.filter(SimulationEvent.event_type.in_([value.strip() for value in event_type.split(",") if value.strip()]))
    rows = query.order_by(SimulationEvent.id.desc()).all()
    normalized = [event_out(row, advanced_raw) for row in rows]
    if severity:
        normalized = [row for row in normalized if row["severity"] == severity]
    total = len(normalized)
    start = (page - 1) * page_size
    return {"items": normalized[start:start + page_size], "page": page, "page_size": page_size, "total": total}


@router.get("/simulations/{run_id}/events")
async def events(run_id: int, advanced_raw: bool = False, last_event_id: str | None = Header(default=None, alias="Last-Event-ID"), db: Session = Depends(get_db), _: User = Depends(require_admin)):
    require_feature(FeatureFlag.ADMIN_DIAGNOSTICS)
    telemetry_record("admin.diagnostics", source="event_stream")
    run_or_404(db, run_id)
    cursor = int(last_event_id or 0)

    async def stream():
        nonlocal cursor
        from app.models.orm import SessionLocal
        while True:
            local = SessionLocal()
            try:
                rows = local.query(SimulationEvent).filter(
                    SimulationEvent.run_id == run_id, SimulationEvent.id > cursor).order_by(SimulationEvent.id).limit(250).all()
                for row in rows:
                    cursor = row.id
                    yield f"id: {row.id}\nevent: {row.event_type}\ndata: {json.dumps(event_out(row, advanced_raw), default=str)}\n\n"
                run = local.get(SimulationRun, run_id)
                if run and run.status in {"ready_for_review", "approved", "rejected", "failed", "limit_reached"}:
                    return
            finally:
                local.close()
            await asyncio.sleep(.35)
    return StreamingResponse(stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@router.post("/simulations/{run_id}/pause")
def pause(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    runtime.pause(db, run)
    return {"id": run.id, "status": run.status}


@router.post("/simulations/{run_id}/resume")
def resume(run_id: int, body: ResumeRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    runtime.resume(db, run, body.extend_limits)
    return {"id": run.id, "status": run.status}


@router.post("/simulations/{run_id}/stop")
def stop(run_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    runtime.stop(db, run)
    return {"id": run.id, "status": run.status}


@router.post("/simulations/{run_id}/respond", status_code=202)
def respond(run_id: int, body: RespondRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    runtime.admin_response(db, run, body.content, admin.id)
    return {"id": run.id, "status": run.status}


@router.post("/simulations/{run_id}/regenerate-last-turn", status_code=202)
def regenerate(run_id: int, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    runtime.regenerate_last(db, run, admin.id)
    return {"id": run.id, "status": run.status}


@router.patch("/simulations/{run_id}/messages/{message_id}")
def edit(run_id: int, message_id: int, body: EditRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    runtime.edit(db, run, message_id, body.content, admin.id, body.reason)
    return detail(db, run, False)


def promote(db: Session, run: SimulationRun, reviewer: User, notes: str | None) -> CuratedTranscript:
    active, scenario = runtime.active_messages(
        db, run), run.config_snapshot["scenario"]
    source = ConversationSession(scenario_id=run.scenario_id or "simulation", difficulty=scenario.get(
        "difficulty", "Medium"), state={"simulation_run_id": run.id, "reviewer_notes": notes})
    db.add(source)
    db.flush()
    for item in active:
        db.add(ConversationMessage(session_id=source.id, sequence=item.sequence, branch_id=item.branch_id,
               sender=item.sender, content=item.content, metadata_json=item.metadata_json))
    score = score_transcript(scenario["category"], active, is_negative_example=bool(
        (run.state or {}).get("is_negative_example", False)))
    transcript = CuratedTranscript(source_session_id=source.id, source_scenario_id=run.scenario_id, public_metadata_snapshot=runtime.public_snapshot(run.config_snapshot), is_concerning_example=not bool((run.state or {}).get("is_negative_example", False)), difficulty=scenario.get(
        "difficulty", "Medium"), tactic_tags=score.tactic_tags, reviewed_by=reviewer.id, reviewed_at=datetime.now(timezone.utc), is_published=False, category=scenario["category"], render_skin=scenario.get("render_skin", "chat"))
    db.add(transcript)
    db.flush()
    labels = {role: info.get("display_name", role) for role,
              info in run.config_snapshot.get("personas", {}).items()}
    labels["authored_moment"] = scenario.get("display_name", "Scenario")
    for item in active:
        meta = item.metadata_json or {}
        message = CuratedMessage(transcript_id=transcript.id, sequence=item.sequence, speaker_label=labels.get(item.sender, item.sender), content=item.content,
               pace=meta.get("pace", "normal"), is_checkpoint=bool(meta.get("is_checkpoint", False)), checkpoint_prompt=meta.get("checkpoint_prompt"))
        db.add(message)
        db.flush()
        element = CuratedSceneElement(transcript_id=transcript.id, element_key=f"message-{message.id}", element_type="message",
            source_message_id=message.id, sequence=item.sequence, content=item.content, actor_key=item.sender,
            timestamp_semantics="exact", timestamp=item.created_at.isoformat(), relationships=[], presentation={}, selectable=True,
            accessible_label=f"Message from {message.speaker_label}", semantic_role="article")
        db.add(element)
        db.flush()
        for tag in meta.get("tactic_tags", []):
            db.add(RedFlagSpan(transcript_id=transcript.id, message_sequence=item.sequence, scene_element_id=element.id, tactic_tag=str(tag), source="auto", tiered_hints=[]))
    persisted_elements = db.query(CuratedSceneElement).filter(CuratedSceneElement.transcript_id == transcript.id).all()
    validate_scene_for_skin(SceneDefinition(
        render_skin=RenderSkin(transcript.render_skin),
        elements=[SceneElement(
            element_key=element.element_key, element_type=element.element_type,
            parent_element_key=element.parent_element_key, source_message_id=element.source_message_id,
            sequence=element.sequence, content=element.content, actor_key=element.actor_key,
            timestamp_semantics=element.timestamp_semantics, timestamp=element.timestamp,
            relationships=element.relationships or [], presentation=element.presentation or {},
            selectable=element.selectable, accessible_label=element.accessible_label, semantic_role=element.semantic_role,
        ) for element in persisted_elements],
    ), require_selectable=True)
    return transcript


@router.post("/simulations/{run_id}/decision")
def decision(run_id: int, body: DecisionRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    run = run_or_404(db, run_id)
    if run.status != "ready_for_review":
        raise HTTPException(
            409, "Only review-ready simulations can be decided")
    transcript = promote(
        db, run, admin, body.reviewer_notes) if body.status == "approved" else None
    run.status = body.status
    runtime.event(db, run, "run_status", {
                  "status": run.status, "curated_transcript_id": transcript.id if transcript else None})
    db.commit()
    return {"id": run.id, "status": run.status, "curated_transcript_id": transcript.id if transcript else None}


@router.get("/review-queue")
def review_queue(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Two explicit gates: simulation approval first, then scene/annotation review before publication."""
    simulations = [{
        "kind": "simulation", "id": run.id, "scenario_id": run.scenario_id, "mode": run.mode,
        "status": run.status, "created_at": run.created_at,
    } for run in db.query(SimulationRun).filter(SimulationRun.status == "ready_for_review").order_by(SimulationRun.created_at.desc()).all()]
    content_reviews = [{
        "kind": "content_review", "id": transcript.id, "scenario_id": transcript.source_scenario_id,
        "mode": None, "status": "awaiting_content_review", "created_at": transcript.reviewed_at,
    } for transcript in db.query(CuratedTranscript).filter(CuratedTranscript.is_published.is_(False)).order_by(CuratedTranscript.reviewed_at.desc()).all()]
    return simulations + content_reviews


def _review_draft(db: Session, item: CuratedTranscript) -> AdminSceneDraft:
    elements = db.query(CuratedSceneElement).filter(
        CuratedSceneElement.transcript_id == item.id
    ).order_by(CuratedSceneElement.sequence, CuratedSceneElement.id).all()
    annotations = db.query(RedFlagSpan).filter(
        RedFlagSpan.transcript_id == item.id
    ).order_by(RedFlagSpan.id).all()
    return AdminSceneDraft(
        category=ScenarioCategory(item.category),
        scene=SceneDefinition(
            render_skin=RenderSkin(item.render_skin),
            elements=[SceneElement(
                element_key=element.element_key, element_type=element.element_type,
                parent_element_key=element.parent_element_key, source_message_id=element.source_message_id,
                sequence=element.sequence, content=element.content, actor_key=element.actor_key,
                timestamp_semantics=element.timestamp_semantics, timestamp=element.timestamp,
                relationships=element.relationships or [], presentation=element.presentation or {},
                selectable=element.selectable, accessible_label=element.accessible_label, semantic_role=element.semantic_role,
            ) for element in elements],
        ),
        annotations=[SceneAnnotationDraft(
            element_key=next(
                (element.element_key for element in elements if element.id == annotation.scene_element_id),
                next((element.element_key for element in elements if element.sequence == annotation.message_sequence), ""),
            ),
            tactic_tag=annotation.tactic_tag, start_offset=annotation.start_offset, end_offset=annotation.end_offset,
            explanation=annotation.child_safe_explanation, tiered_hints=annotation.tiered_hints or [],
        ) for annotation in annotations],
    )


def _save_review_draft(db: Session, item: CuratedTranscript, draft: AdminSceneDraft) -> None:
    if draft.category.value != item.category:
        raise HTTPException(422, "Review category must match the curated transcript category")
    message_ids = {message.id: message for message in db.query(CuratedMessage).filter(CuratedMessage.transcript_id == item.id).all()}
    for element in draft.scene.elements:
        if element.source_message_id and element.source_message_id not in message_ids:
            raise HTTPException(422, "Scene elements may only reference messages in this curated transcript")
    db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == item.id).delete(synchronize_session=False)
    db.query(CuratedSceneElement).filter(CuratedSceneElement.transcript_id == item.id).delete(synchronize_session=False)
    db.flush()
    persisted: dict[str, CuratedSceneElement] = {}
    for element in draft.scene.elements:
        row = CuratedSceneElement(
            transcript_id=item.id, element_key=element.element_key, element_type=element.element_type.value,
            parent_element_key=element.parent_element_key, source_message_id=element.source_message_id,
            sequence=element.sequence, content=element.content, actor_key=element.actor_key,
            timestamp_semantics=element.timestamp_semantics.value, timestamp=element.timestamp,
            relationships=[relationship.model_dump(mode="json") for relationship in element.relationships],
            presentation=element.presentation.model_dump(mode="json"), selectable=element.selectable,
            accessible_label=element.accessible_label, semantic_role=element.semantic_role,
        )
        db.add(row)
        db.flush()
        persisted[element.element_key] = row
    for annotation in draft.annotations:
        target = persisted[annotation.element_key]
        source = message_ids.get(target.source_message_id) if target.source_message_id else None
        db.add(RedFlagSpan(
            transcript_id=item.id, message_sequence=source.sequence if source else None, scene_element_id=target.id,
            start_offset=annotation.start_offset, end_offset=annotation.end_offset, tactic_tag=annotation.tactic_tag,
            source="reviewer", child_safe_explanation=annotation.explanation, tiered_hints=annotation.tiered_hints,
        ))


@router.get("/curated-transcripts/{transcript_id}/review", response_model=AdminSceneDraft)
def get_curated_review(transcript_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.get(CuratedTranscript, transcript_id)
    if not item:
        raise HTTPException(404, "Curated transcript not found")
    return _review_draft(db, item)


@router.put("/curated-transcripts/{transcript_id}/review", response_model=AdminSceneDraft)
def update_curated_review(transcript_id: int, body: AdminSceneDraft, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.get(CuratedTranscript, transcript_id)
    if not item:
        raise HTTPException(404, "Curated transcript not found")
    if item.is_published:
        raise HTTPException(409, "Unpublish this transcript before changing its reviewed scene")
    _save_review_draft(db, item, body)
    db.commit()
    return _review_draft(db, item)


@router.post("/curated-transcripts/{transcript_id}/publish")
def publish(transcript_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.get(CuratedTranscript, transcript_id)
    if not item:
        raise HTTPException(404, "Curated transcript not found")
    try:
        validate_scene_draft_for_publication(_review_draft(db, item))
    except ValueError as exc:
        raise HTTPException(422, f"Publication blocked: {exc}") from exc
    item.is_published, item.published_at = True, datetime.now(timezone.utc)
    db.commit()
    return {"id": item.id, "is_published": True}


@router.post("/curated-transcripts/{transcript_id}/unpublish")
def unpublish(transcript_id: int, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    item = db.get(CuratedTranscript, transcript_id)
    if not item:
        raise HTTPException(404, "Curated transcript not found")
    item.is_published, item.published_at = False, None
    db.commit()
    return {"id": item.id, "is_published": False}
