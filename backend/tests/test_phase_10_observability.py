from datetime import datetime, timedelta, timezone
from types import SimpleNamespace

from app.api.admin_simulations import derive_diagnostics, event_out, message_out
from app.models.schemas import SimulationDetailOut


def make_run(status="running"):
    return SimpleNamespace(
        id=9, scenario_id="scenario-9", mode="ai_vs_ai", status=status,
        created_at=datetime.now(timezone.utc), stop_reason="provider timeout" if status == "failed" else None,
        config_snapshot={
            "scenario": {"stage_sequence": [{"mandatory_objectives": ["notice"], "optional_objectives": ["report"]}]},
            "prompts": {"initiator": {"name": "initiator-dialogue", "version": "3", "hash": "abc", "content": "secret prompt"}},
            "system_prompts": {},
        },
        state={"current_stage": "opening", "current_objective": "report", "completed_objectives": ["notice"],
               "flags": ["boundary_pressure"], "resource_warnings": [90]},
        progress={"active_branch": "revision-4"},
        resource_usage={"messages": 90, "message_limit": 100, "running_seconds": 1800, "minute_limit": 60},
        worker_lease={"token": "must-not-leak", "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=1)).isoformat()},
    )


def test_diagnostics_are_human_readable_and_prompt_safe_by_default():
    message = SimpleNamespace(branch_id="revision-4", metadata_json={"tactic_tags": ["urgency", "secrecy"]})
    revision = SimpleNamespace(id=4)
    derived = derive_diagnostics(make_run(), [message], [revision])

    assert derived["diagnostics"]["progression"]["current_stage"] == "opening"
    assert derived["diagnostics"]["objectives"] == {"current": "report", "completed": ["notice"], "pending": ["report"]}
    assert derived["diagnostics"]["tactic_tags"] == ["secrecy", "urgency"]
    assert derived["diagnostics"]["safety_findings"][0]["source"] == "llm_evaluation"
    assert derived["resource_usage"]["message_percent"] == 90
    assert derived["worker_lease"]["state"] == "healthy"
    assert derived["worker_lease"]["worker_id"] is None
    assert derived["branch_summary"] == {"active_branch": "revision-4", "branch_count": 1, "revision_count": 1, "latest_revision_id": 4}
    assert "content" not in derived["diagnostics"]["prompt_provenance"][0]


def test_redaction_and_normalized_events_require_explicit_advanced_request():
    item = SimpleNamespace(id=1, sequence=1, branch_id="main", sender="initiator", content="hello",
                           metadata_json={"prompt": {"rendered_layers": ["secret"]}, "state_before": {"hidden": True}},
                           created_at=datetime.now(timezone.utc))
    event = SimpleNamespace(id=2, sequence=2, event_type="run_status", payload={"status": "failed", "detail": "secret"},
                            created_at=datetime.now(timezone.utc))
    assert "prompt" not in message_out(item, False)["metadata"]
    assert message_out(item, True)["metadata"]["prompt"]["rendered_layers"] == ["secret"]
    assert event_out(event, False) == {"id": 2, "sequence": 2, "event_type": "run_status", "category": "lifecycle",
                                       "severity": "error", "label": "Run failed", "created_at": event.created_at.isoformat(), "payload": {"status": "failed", "detail": "secret"}}
    assert event_out(event, True)["raw_payload"] == event.payload


def test_typed_detail_schema_serializes_derived_contract():
    run = make_run("failed")
    derived = derive_diagnostics(run, [], [])
    value = SimulationDetailOut.model_validate({
        "overview": {"id": run.id, "scenario_id": run.scenario_id, "mode": run.mode, "status": run.status,
                     "created_at": run.created_at.isoformat(), "stop_reason": run.stop_reason},
        **derived, "revisions": [], "events": [],
    }).model_dump(mode="json")
    assert "RUN_FAILED" in {warning["code"] for warning in value["diagnostics"]["warnings"]}
    assert value["worker_lease"]["worker_id"] is None
