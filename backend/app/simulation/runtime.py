"""Durable, database-authoritative runtime for administrator simulations only."""
from __future__ import annotations
import asyncio
import hashlib
import json
import secrets
from datetime import datetime, timedelta, timezone
from time import perf_counter
from typing import Any, Callable
from fastapi import HTTPException
from sqlalchemy.orm import Session
from app.generation.scorer import generation_quality_issues, image_request_content_is_safe, propose_tags, selected_modifier
from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY
from app.models.orm import SimulationEvent, SimulationMessage, SimulationMessageRevision, SimulationRun
from app.models.schemas import GenerationMode, ScenarioCategory, ScenarioDefinition
from app.repositories import content_repo

RUNNING = "running"
FAILED_RETRYABLE = "failed_retryable"
FAILED_TERMINAL = "failed_terminal"
EDITABLE = {"paused", "awaiting_admin", "ready_for_review", FAILED_RETRYABLE}
DEFAULT_MESSAGES, DEFAULT_MINUTES, GLOBAL_MESSAGES, GLOBAL_MINUTES = 200, 60, 1000, 240
MAX_GENERATION_ATTEMPTS = 3
RETRY_BACKOFF_SECONDS = (0.25, 0.75)
LEASE_SECONDS = 300
SYSTEM_PROMPT_BY_ROLE = {
    "initiator": "simulation_initiator_system",
    "respondent": "simulation_respondent_system",
    "authoring": "single_pass_authoring_system",
}

def now() -> datetime: return datetime.now(timezone.utc)

class SimulationRuntime:
    """One committed turn at a time; DB events/states survive workers and SSE clients."""
    _tasks: dict[int, asyncio.Task[None]] = {}
    def __init__(self, llm_getter: Callable[[], Any]): self.llm_getter = llm_getter

    @staticmethod
    def snapshot(db: Session, scenario: ScenarioDefinition) -> dict[str, Any]:
        content_repo.validate_scenario_references(db, scenario)
        personas, prompts, system_prompts = {}, {}, {}
        for role, binding in (("initiator", scenario.initiator), ("respondent", scenario.respondent), ("authoring", scenario.authoring)):
            if not binding:
                continue
            persona = content_repo.get_persona(db, binding.persona_id)
            prompt = content_repo.get_prompt(db, binding.dialogue_prompt_id)
            system_prompt = content_repo.get_prompt(db, SYSTEM_PROMPT_BY_ROLE[role])
            if not persona or not prompt or not system_prompt:
                raise HTTPException(422, f"Missing {role} binding or system prompt content")
            personas[role] = persona.model_dump(mode="json")
            data = prompt.model_dump(mode="json")
            data["hash"] = hashlib.sha256(prompt.content.encode()).hexdigest()
            prompts[role] = data
            system_data = system_prompt.model_dump(mode="json")
            system_data["hash"] = hashlib.sha256(system_prompt.content.encode()).hexdigest()
            system_prompts[role] = system_data
        stage_ids = {scenario.starting_stage, *(x.stage for x in scenario.stage_sequence)}
        stages = {x: value.model_dump(mode="json") for x in stage_ids if (value := content_repo.get_stage(db, x))}
        objectives = {oid for step in scenario.stage_sequence for oid in step.mandatory_objectives + step.optional_objectives}
        constraints = {cid for step in scenario.stage_sequence for cid in step.constraints}
        for value in stages.values(): constraints.update(value.get("default_constraints", []))
        return {"scenario": scenario.model_dump(mode="json"), "personas": personas, "prompts": prompts,
                "system_prompts": system_prompts, "stages": stages,
                "objectives": {x: value.model_dump(mode="json") for x in objectives if (value := content_repo.get_objective(db, x))},
                "constraints": {x: value.model_dump(mode="json") for x in constraints if (value := content_repo.get_constraint(db, x))}}

    @staticmethod
    def public_snapshot(snapshot: dict[str, Any]) -> dict[str, Any]:
        source = snapshot["scenario"]
        return {
            key: source.get(key)
            for key in (
                "id", "display_name", "description", "difficulty", "category",
                "render_skin", "tags", "learning_objectives",
            )
        }

    def create_run(self, db: Session, scenario: ScenarioDefinition, creator_id: int, mode: str, is_negative_example: bool = False) -> SimulationRun:
        if mode not in {"ai_vs_ai", "admin_as_respondent", "single_pass"}: raise HTTPException(422, "Invalid simulation mode")
        if (scenario.generation_mode is GenerationMode.SINGLE_PASS) != (mode == "single_pass"): raise HTTPException(422, "Mode does not match scenario generation mode")
        snap = self.snapshot(db, scenario)
        state = {"current_stage": scenario.starting_stage, "completed_objectives": [], "current_objective": self.objective_for(snap, scenario.starting_stage, []),
                 "flags": [], "is_negative_example": is_negative_example, "running_started_at": now().isoformat()}
        run = SimulationRun(mode=mode, status=RUNNING, creator_id=creator_id, scenario_id=scenario.id, config_snapshot=snap, state=state,
            progress={"active_branch": "main", "next_sequence": 0}, resource_usage={"messages": 0, "running_seconds": 0, "message_limit": DEFAULT_MESSAGES, "minute_limit": DEFAULT_MINUTES}, worker_lease={})
        db.add(run); db.flush(); self.event(db, run, "run_status", {"status": RUNNING}); db.commit(); db.refresh(run); return run

    def start(self, run_id: int) -> asyncio.Task[None]:
        """Schedule a worker from an already-running ASGI event loop."""
        task = self._tasks.get(run_id)
        if task is None or task.done():
            task = asyncio.get_running_loop().create_task(self.worker(run_id))
            self._tasks[run_id] = task
        return task

    def schedule_failed(self, db: Session, run: SimulationRun) -> None:
        """Compensate a committed running transition if task scheduling fails."""
        self.freeze_usage(run)
        run.status, run.stop_reason = FAILED_RETRYABLE, "worker_scheduling_failed"
        self.event(db, run, "run_status", {"status": run.status, "code": "WORKER_SCHEDULING_FAILED"})
        db.commit()

    def recover(self) -> int:
        """Schedule durable running runs after process startup; leases prevent duplicates."""
        from app.models.orm import SessionLocal
        db = SessionLocal()
        try:
            ids = [row.id for row in db.query(SimulationRun.id).filter(SimulationRun.status == RUNNING).all()]
        finally:
            db.close()
        for run_id in ids:
            self.start(run_id)
        return len(ids)

    def shutdown(self) -> None:
        for task in self._tasks.values():
            if not task.done():
                task.cancel()
        self._tasks.clear()

    async def worker(self, run_id: int) -> None:
        from app.models.orm import SessionLocal
        token = secrets.token_urlsafe(18)
        while True:
            db = SessionLocal()
            try:
                run = db.query(SimulationRun).filter(SimulationRun.id == run_id).with_for_update().one_or_none()
                if not run or run.status != RUNNING or not self.acquire_lease(run, token): db.commit(); return
                # Persist the lease before an LLM call so another process observes it.
                db.commit()
                db.refresh(run)
                if self.limited(db, run):
                    run.status, run.stop_reason = "limit_reached", "resource_limit"; self.event(db, run, "run_status", {"status": run.status}); db.commit(); return
                self.hydrate(db, run)
                if run.mode == "single_pass": await self.single_pass(db, run); db.commit(); return
                await self.generated_turn(db, run, "initiator"); db.commit(); db.refresh(run)
                if run.status != RUNNING: return
                if run.mode == "admin_as_respondent":
                    self.freeze_usage(run); run.status = "awaiting_admin"; self.event(db, run, "run_status", {"status": run.status}); db.commit(); return
                self.hydrate(db, run); await self.generated_turn(db, run, "respondent"); db.commit(); await asyncio.sleep(0)
            except GenerationRetryExhausted as exc:
                db.rollback(); run = db.get(SimulationRun, run_id)
                if run:
                    self.freeze_usage(run)
                    run.status, run.stop_reason = FAILED_RETRYABLE, exc.code
                    self.event(db, run, "run_status", {"status": run.status, "code": exc.code, "detail": exc.detail, "attempts": exc.attempts})
                    db.commit()
                return
            except Exception as exc:
                db.rollback(); run = db.get(SimulationRun, run_id)
                if run:
                    self.freeze_usage(run)
                    run.status, run.stop_reason = FAILED_TERMINAL, self.failure_code(exc)
                    detail = str(getattr(exc, "detail", exc))
                    self.event(db, run, "run_status", {"status": run.status, "code": run.stop_reason, "detail": detail})
                    db.commit()
                return
            finally: db.close()

    def acquire_lease(self, run: SimulationRun, token: str) -> bool:
        lease = dict(run.worker_lease or {}); expiration = lease.get("expires_at")
        if lease.get("token") not in {None, token} and expiration and datetime.fromisoformat(expiration) > now(): return False
        run.worker_lease = {"token": token, "expires_at": (now() + timedelta(seconds=LEASE_SECONDS)).isoformat()}; return True

    def running_seconds(self, run: SimulationRun) -> int:
        usage, started = run.resource_usage or {}, (run.state or {}).get("running_started_at")
        return int(usage.get("running_seconds", 0)) + (max(0, int((now() - datetime.fromisoformat(started)).total_seconds())) if started else 0)

    def limited(self, db: Session, run: SimulationRun) -> bool:
        usage = dict(run.resource_usage or {}); elapsed = self.running_seconds(run); usage["running_seconds"] = elapsed; run.resource_usage = usage
        fraction = max(int(usage.get("messages", 0)) / max(1, int(usage.get("message_limit", 1))), elapsed / max(1, int(usage.get("minute_limit", 1)) * 60))
        state, warnings = dict(run.state or {}), set((run.state or {}).get("resource_warnings", []))
        for threshold in (80, 90):
            if fraction >= threshold / 100 and threshold not in warnings: warnings.add(threshold); self.event(db, run, "resource_warning", {"percent": threshold})
        state["resource_warnings"] = sorted(warnings); run.state = state
        return int(usage.get("messages", 0)) >= int(usage.get("message_limit", DEFAULT_MESSAGES)) or elapsed >= int(usage.get("minute_limit", DEFAULT_MINUTES)) * 60

    async def generated_turn(self, db: Session, run: SimulationRun, role: str) -> None:
        before, layers = dict(run.state or {}), self.layers(run, role)
        raw, texts, latency = await self.generated_payload(db, run, layers)
        db.refresh(run)
        if run.status != RUNNING: return  # Pause/stop wins between LLM calls; result is discarded.
        tags = propose_tags(self.category(run), raw.get("tactic_tags", raw.get("flags", [])))
        # Validate every output before persisting any portion of this turn.
        for index, text in enumerate(texts):
            # A turn can contain brief rapport plus one concern. Keep the
            # primary teaching tactic attached to one stable target instead of
            # duplicating it across every generated bubble.
            message_tags = tags if index == len(texts) - 1 else []
            self.append(db, run, role, text, {"active": True, "tactic_tags": message_tags, "tactic_plan": raw.get("tactic_plan", []), "difficulty_fit": raw.get("difficulty_fit"), "is_checkpoint": bool(raw.get("is_checkpoint", False)) and index == len(texts) - 1, "checkpoint_prompt": raw.get("checkpoint_prompt"), "latency_ms": latency, "token_usage": raw.get("usage", {}), "state_before": before, "evaluation": self.evaluation(raw), "prompt": self.prompt_meta(run, role, layers)})
            self.apply_evaluation(run, raw, role, text)
        self.event(db, run, "turn_complete", {"sender": role})

    async def single_pass(self, db: Session, run: SimulationRun) -> None:
        layers = self.layers(run, "authoring")
        raw, texts, _ = await self.generated_payload(db, run, layers, single_pass=True)
        db.refresh(run)
        if run.status != RUNNING: return
        moment = texts[0]
        tags = propose_tags(self.category(run), raw.get("tactic_tags", raw.get("flags", [])))
        self.append(db, run, "authored_moment", moment, {"active": True, "tactic_tags": tags, "is_checkpoint": True, "branch_options": [str(x) for x in raw.get("branch_options", raw.get("options", []))[:3]], "checkpoint_prompt": str(raw.get("checkpoint_prompt") or "What would you change before sharing this, and who could you ask for help?"), "prompt": self.prompt_meta(run, "authoring", layers)})
        self.freeze_usage(run); run.status = "ready_for_review"; self.event(db, run, "run_status", {"status": run.status})

    def layers(self, run: SimulationRun, role: str) -> dict[str, list[str]]:
        snap, scenario, state = run.config_snapshot, run.config_snapshot["scenario"], run.state or {}
        public = {k: scenario.get(k) for k in ("id", "display_name", "description", "category", "difficulty")}
        context: dict[str, Any] = {
            "role": role,
            "public_scenario": public,
            "visible_history": [{"sender": x.sender, "content": x.content} for x in getattr(run, "_runtime_messages", [])],
            "constraints": self.constraints(run),
            "current_stage": state.get("current_stage"),
            "persona": snap["personas"][role],
            "difficulty_modifiers": scenario.get("difficulty_modifiers", {}).get(str(scenario.get("difficulty")), {}),
            "allowed_tactic_tags": TACTIC_TAGS_BY_CATEGORY[self.category(run)],
        }
        if role == "initiator":
            objective = snap["objectives"].get(state.get("current_objective"), {})
            context["hidden_objective"] = objective.get("hidden_intent", objective.get("description", ""))
        instruction = (
            "First return tactic_plan as a short list of canonical tactic_tag values and difficulty_fit with the supplied red_flag_visibility and escalation_speed, then return moment, branch_options, checkpoint_prompt, and tactic_tags. "
            "Use at most the target budget, keep safe context genuinely safe, and do not repeat manipulation wording."
            if role == "authoring" else
            "First return tactic_plan as a short list of canonical tactic_tag values and difficulty_fit with the supplied red_flag_visibility and escalation_speed, then return messages, tactic_tags, objective_completed, next_stage, flags, trust_delta, and suspicion_delta. "
            "Use the difficulty target budget, keep safe context genuinely safe, and do not repeat manipulation wording."
        )
        system_prompt = snap.get("system_prompts", {}).get(role)
        system_layers = ([system_prompt["content"]] if system_prompt else []) + [snap["prompts"][role]["content"]]
        return {"system": system_layers, "user": [json.dumps(context, sort_keys=True), instruction]}

    def constraints(self, run: SimulationRun) -> list[dict[str, Any]]:
        snap, state = run.config_snapshot, run.state or {}; stage = snap["stages"].get(state.get("current_stage"), {}); ids = list(stage.get("default_constraints", []))
        for step in snap["scenario"].get("stage_sequence", []):
            if step.get("stage") == state.get("current_stage"): ids.extend(step.get("constraints", []))
        result = [snap["constraints"][x] for x in dict.fromkeys(ids) if x in snap["constraints"]]
        if self.category(run) is ScenarioCategory.IMAGE_REQUEST:
            result.append({
                "id": "image_request_no_visual_descriptions",
                "description": "Use only non-visual online boundary pressure in a fictional chat.",
                "allowed_examples": ["a vague request to move a chat", "a request to pause", "asking a trusted adult for help"],
                "forbidden_topics": ["image or photo descriptions", "physical descriptions", "appearance", "body details"],
                "forbidden_semantic_behaviours": ["requesting or describing visual material", "describing a person body or appearance"],
            })
        return result

    async def generated_payload(self, db: Session, run: SimulationRun, layers: dict[str, list[str]], single_pass: bool = False) -> tuple[dict[str, Any], list[str], float]:
        """Call, parse, and safety-check a complete turn with bounded retries."""
        for attempt in range(1, MAX_GENERATION_ATTEMPTS + 1):
            started = perf_counter()
            try:
                raw = await self.call_llm(layers)
                if not isinstance(raw, dict):
                    raise ValueError("LLM returned a non-object JSON response")
                if single_pass:
                    texts = [str(raw.get("moment") or raw.get("reply") or "").strip()]
                else:
                    values = raw.get("messages") if isinstance(raw.get("messages"), list) else [raw.get("reply", "")]
                    texts = [
                        (str(value.get("content", "")) if isinstance(value, dict) else str(value)).strip()
                        for value in values[:2]
                    ]
                    texts = [t for t in texts if t]
                if not texts or not all(texts):
                    raise ValueError("LLM response omitted required message content")
                for text in texts:
                    self.assert_safe(run, text)
                issues = generation_quality_issues(
                    category=self.category(run), modifier=selected_modifier(run.config_snapshot["scenario"]),
                    raw=raw, texts=texts, existing_messages=getattr(run, "_runtime_messages", []),
                )
                if issues:
                    raise GenerationSafetyError("; ".join(issue.code for issue in issues))
                return raw, texts, round((perf_counter() - started) * 1000, 2)
            except Exception as exc:
                code = self.retry_code(exc)
                if not code:
                    raise
                detail = str(getattr(exc, "detail", exc))
                self.record_retry(db, run, attempt, code, detail=detail, exhausted=attempt == MAX_GENERATION_ATTEMPTS)
                if attempt == MAX_GENERATION_ATTEMPTS:
                    raise GenerationRetryExhausted(code, attempt, detail=detail) from exc
                await asyncio.sleep(RETRY_BACKOFF_SECONDS[attempt - 1])
        raise AssertionError("unreachable")

    def record_retry(self, db: Session, run: SimulationRun, attempt: int, code: str, *, detail: str = "", exhausted: bool) -> None:
        state = dict(run.state or {})
        diagnostics = list(state.get("generation_diagnostics", []))[-9:]
        diagnostics.append({"attempt": attempt, "category": code, "detail": detail, "exhausted": exhausted, "at": now().isoformat()})
        state["generation_diagnostics"] = diagnostics
        run.state = state
        self.event(db, run, "generation_retry", {"attempt": attempt, "category": code, "detail": detail, "exhausted": exhausted})
        db.commit()

    @staticmethod
    def retry_code(exc: Exception) -> str | None:
        if isinstance(exc, GenerationSafetyError): return "safety_rejection"
        if isinstance(exc, (ValueError, json.JSONDecodeError, asyncio.TimeoutError)): return "malformed_or_timeout"
        if isinstance(exc, HTTPException) and exc.status_code in {502, 503, 504}: return "provider_transient"
        return None

    @staticmethod
    def failure_code(exc: Exception) -> str:
        return "provider_configuration" if isinstance(exc, RuntimeError) else "runtime_error"

    async def call_llm(self, layers: dict[str, list[str]]) -> dict[str, Any]:
        try:
            llm = self.llm_getter()
            return await (llm.generate_layers(layers["system"], layers["user"]) if hasattr(llm, "generate_layers") else llm.generate(system_prompt="\n\n".join(layers["system"]), user_message="\n\n".join(layers["user"])))
        except HTTPException: raise
        except Exception as exc: raise HTTPException(502, f"LLM generation failed: {exc}") from exc

    def append(self, db: Session, run: SimulationRun, sender: str, content: str, metadata: dict[str, Any]) -> SimulationMessage:
        progress = dict(run.progress or {}); item = SimulationMessage(run_id=run.id, sequence=int(progress.get("next_sequence", 0)), branch_id=progress.get("active_branch", "main"), sender=sender, content=content, metadata_json=metadata)
        db.add(item); db.flush(); db.add(SimulationMessageRevision(message_id=item.id, revision_number=1, content=content, metadata_json={**metadata, "kind": "generated"}))
        progress["next_sequence"] = item.sequence + 1; run.progress = progress; usage = dict(run.resource_usage or {}); usage["messages"] = int(usage.get("messages", 0)) + 1; run.resource_usage = usage
        self.event(db, run, "message", {"id": item.id, "sequence": item.sequence, "sender": sender, "content": content}); return item

    @staticmethod
    def evaluation(raw: dict[str, Any]) -> dict[str, Any]: return {k: raw.get(k) for k in ("objective_completed", "next_stage", "flags", "trust_delta", "suspicion_delta")}
    @staticmethod
    def objective_for(snapshot: dict[str, Any], stage: str, completed: list[str]) -> str:
        for step in snapshot["scenario"].get("stage_sequence", []):
            if step.get("stage") == stage: return next((x for x in step.get("mandatory_objectives", []) + step.get("optional_objectives", []) if x not in completed), "")
        return ""
    @staticmethod
    def category(run: SimulationRun) -> ScenarioCategory: return ScenarioCategory(run.config_snapshot["scenario"]["category"])
    def assert_safe(self, run: SimulationRun, content: str) -> None:
        if self.category(run) is ScenarioCategory.IMAGE_REQUEST:
            if not image_request_content_is_safe(content):
                raise GenerationSafetyError("image-request output contains visual or physical-description content")
    @staticmethod
    def prompt_meta(run: SimulationRun, role: str, layers: dict[str, list[str]]) -> dict[str, Any]:
        prompt = run.config_snapshot["prompts"][role]
        system_prompt = run.config_snapshot.get("system_prompts", {}).get(role)
        metadata = {"id": prompt["name"], "version": prompt.get("version"), "hash": prompt.get("hash"), "rendered_layers": layers}
        if system_prompt:
            metadata["system_prompt"] = {"id": system_prompt["name"], "version": system_prompt.get("version"), "hash": system_prompt.get("hash")}
        return metadata
    def apply_evaluation(self, run: SimulationRun, raw: dict[str, Any], sender: str, content: str) -> None:
        state = dict(run.state or {}); flags = set(state.get("flags", [])); flags.update(str(x) for x in raw.get("flags", []) if x); state["flags"] = sorted(flags)
        if raw.get("objective_completed") and state.get("current_objective"): state["completed_objectives"] = list(dict.fromkeys([*state.get("completed_objectives", []), state["current_objective"]]))
        if raw.get("next_stage") in run.config_snapshot["stages"]: state["current_stage"] = raw["next_stage"]
        state["current_objective"] = self.objective_for(run.config_snapshot, state["current_stage"], state.get("completed_objectives", [])); state["last_sender"], state["last_content"] = sender, content; run.state = state
    def active_messages(self, db: Session, run: SimulationRun) -> list[SimulationMessage]:
        branch = (run.progress or {}).get("active_branch", "main")
        return [x for x in db.query(SimulationMessage).filter(SimulationMessage.run_id == run.id, SimulationMessage.branch_id == branch).order_by(SimulationMessage.sequence).all() if (x.metadata_json or {}).get("active", True)]
    def hydrate(self, db: Session, run: SimulationRun) -> None: run._runtime_messages = self.active_messages(db, run)  # type: ignore[attr-defined]
    def freeze_usage(self, run: SimulationRun) -> None:
        usage = dict(run.resource_usage or {}); usage["running_seconds"] = self.running_seconds(run); run.resource_usage = usage; state = dict(run.state or {}); state.pop("running_started_at", None); run.state = state; run.worker_lease = {}
    def pause(self, db: Session, run: SimulationRun) -> None:
        if run.status != RUNNING: raise HTTPException(409, "Only a running simulation can be paused")
        self.freeze_usage(run); run.status = "paused"; self.event(db, run, "run_status", {"status": run.status}); db.commit()
    def resume(self, db: Session, run: SimulationRun, extend: bool) -> None:
        if run.status == "limit_reached":
            if not extend: raise HTTPException(409, "Resuming a limited run requires extend_limits=true")
            usage = dict(run.resource_usage or {}); usage["message_limit"] = min(GLOBAL_MESSAGES, int(usage.get("message_limit", DEFAULT_MESSAGES)) + 100); usage["minute_limit"] = min(GLOBAL_MINUTES, int(usage.get("minute_limit", DEFAULT_MINUTES)) + 30); run.resource_usage = usage
        elif run.status not in {"paused", "awaiting_admin", FAILED_RETRYABLE}: raise HTTPException(409, "Simulation cannot be resumed from its current status")
        state = dict(run.state or {}); state["running_started_at"] = now().isoformat(); run.state = state; run.status, run.stop_reason = RUNNING, None; run.worker_lease = {}; self.event(db, run, "run_status", {"status": run.status}); db.commit()
    def stop(self, db: Session, run: SimulationRun) -> None:
        if run.status not in {RUNNING, "paused", "awaiting_admin", "limit_reached", FAILED_RETRYABLE}: raise HTTPException(409, "Simulation cannot be stopped")
        self.freeze_usage(run); run.status, run.stop_reason = "ready_for_review", "stopped"; self.event(db, run, "run_status", {"status": run.status}); db.commit()
    def admin_response(self, db: Session, run: SimulationRun, content: str, admin_id: int) -> None:
        if run.status != "awaiting_admin" or run.mode != "admin_as_respondent": raise HTTPException(409, "Simulation is not awaiting an admin response")
        self.assert_safe(run, content); self.append(db, run, "respondent", content, {"active": True, "admin_id": admin_id, "evaluation": {"source": "admin"}}); self.apply_evaluation(run, {}, "respondent", content)
        state = dict(run.state or {}); state["running_started_at"] = now().isoformat(); run.state = state; run.status = RUNNING; run.worker_lease = {}; self.event(db, run, "run_status", {"status": run.status}); db.commit()
    def edit(self, db: Session, run: SimulationRun, message_id: int, content: str, editor_id: int, reason: str | None) -> None:
        if run.status not in EDITABLE: raise HTTPException(409, "Messages may only be edited while paused, awaiting admin, or review-ready")
        self.assert_safe(run, content); active = self.active_messages(db, run); item = next((x for x in active if x.id == message_id), None)
        if not item: raise HTTPException(404, "Active simulation message not found")
        previous = db.query(SimulationMessageRevision).filter_by(message_id=item.id).order_by(SimulationMessageRevision.revision_number.desc()).first()
        revision = SimulationMessageRevision(message_id=item.id, revision_number=(previous.revision_number if previous else 0) + 1, content=content, metadata_json={"editor_id": editor_id, "reason": reason or "edited", "kind": "edit"}, supersedes_revision_id=previous.id if previous else None, editor_id=editor_id, reason=reason)
        db.add(revision); db.flush()
        for later in active:
            if later.sequence > item.sequence: later.metadata_json = {**(later.metadata_json or {}), "active": False, "superseded_by_revision": revision.id}
        branch = f"revision-{revision.id}"; item.branch_id, item.content = branch, content; item.metadata_json = {**(item.metadata_json or {}), "active": True, "revision_id": revision.id}
        progress = dict(run.progress or {}); progress.update(active_branch=branch, next_sequence=item.sequence + 1); run.progress = progress; run.status = "paused"; self.event(db, run, "message_revised", {"message_id": item.id, "revision_id": revision.id, "branch_id": branch}); db.commit()
    def regenerate_last(self, db: Session, run: SimulationRun, editor_id: int) -> None:
        active = self.active_messages(db, run)
        if run.status not in EDITABLE or not active: raise HTTPException(409, "An active completed or paused turn is required")
        last = active[-1]; self.edit(db, run, last.id, last.content, editor_id, "regenerate last turn"); last.metadata_json = {**(last.metadata_json or {}), "active": False}
        state = dict(run.state or {}); state["running_started_at"] = now().isoformat(); run.state = state; run.status = RUNNING; run.worker_lease = {}; self.event(db, run, "run_status", {"status": run.status}); db.commit()
    @staticmethod
    def event(db: Session, run: SimulationRun, event_type: str, payload: dict[str, Any]) -> None:
        db.add(SimulationEvent(run_id=run.id, sequence=db.query(SimulationEvent).filter(SimulationEvent.run_id == run.id).count() + 1, event_type=event_type, payload=payload))
class GenerationSafetyError(RuntimeError):
    """A generated turn exceeded a hard generation-time safety boundary."""


class GenerationRetryExhausted(RuntimeError):
    def __init__(self, code: str, attempts: int, detail: str = "") -> None:
        self.code, self.attempts, self.detail = code, attempts, detail
        super().__init__(f"{code}: {detail}" if detail else code)
