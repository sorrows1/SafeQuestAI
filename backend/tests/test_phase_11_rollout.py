from pathlib import Path

import pytest
from alembic.config import Config
from alembic.script import ScriptDirectory
from fastapi import HTTPException

from app.config.rollout import FeatureFlag, is_enabled, require_feature, rollout_status
from app.telemetry import record, sanitize_attributes


def test_migration_graph_has_one_release_head_and_phase_five_is_reversible() -> None:
    config = Config("alembic.ini")
    script = ScriptDirectory.from_config(config)
    assert script.get_heads() == ["20260726_p8_multiplayer"]
    phase_five = Path("alembic/versions/20260726_phase5_scene_render_contract.py").read_text(encoding="utf-8")
    assert "def upgrade()" in phase_five and "def downgrade()" in phase_five
    assert "_backfill_scene_semantics" in phase_five


def test_rollout_flags_are_independent_and_can_disable_new_paths(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("SAFE_QUEST_FEATURE_NEW_SOLO_SESSIONS", "false")
    monkeypatch.setenv("SAFE_QUEST_FEATURE_MULTIPLAYER_EVENTS", "0")
    assert not is_enabled(FeatureFlag.NEW_SOLO_SESSIONS)
    assert not is_enabled(FeatureFlag.MULTIPLAYER_EVENTS)
    assert rollout_status()[FeatureFlag.FLAG_ATTEMPTS.value] is True
    with pytest.raises(HTTPException) as error:
        require_feature(FeatureFlag.NEW_SOLO_SESSIONS)
    assert error.value.status_code == 503


def test_telemetry_drops_private_content_and_only_accepts_allowlisted_events(caplog: pytest.LogCaptureFixture) -> None:
    clean = sanitize_attributes({"reasoning": "private thought", "secret": "invite-token", "status": "completed", "unknown": "drop"})
    assert clean == {"status": "completed"}
    with caplog.at_level("INFO"):
        record("session.completed", status="completed", reasoning="private thought")
    assert "private thought" not in caplog.text
    assert "session.completed" in caplog.text
    with pytest.raises(ValueError):
        record("unapproved.event")


def test_family_path_keeps_simulation_runtime_and_grading_out_of_player_code() -> None:
    family_source = Path("app/api/family_sessions.py").read_text(encoding="utf-8")
    guide_source = Path("app/family/guide_builder.py").read_text(encoding="utf-8")
    assert "simulation.runtime" not in family_source
    assert "_DISALLOWED_LANGUAGE" in guide_source
    assert all(term in guide_source for term in ("score", "grade", "accuracy", "mistakes"))
