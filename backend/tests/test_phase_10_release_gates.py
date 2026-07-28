from pathlib import Path

from alembic.config import Config
from alembic.script import ScriptDirectory

from app.telemetry import sanitize_attributes


def test_release_schema_head_matches_startup_guard_without_create_all() -> None:
    script = ScriptDirectory.from_config(Config("alembic.ini"))
    assert script.get_heads() == ["20260727_join_code"]
    startup = Path("app/main.py").read_text(encoding="utf-8")
    assert "EXPECTED_SCHEMA_REVISION = \"20260727_join_code\"" in startup
    assert ".create_all(" not in startup
    lifecycle_migration = Path("alembic/versions/20260727_phase6_session_lifecycle.py").read_text(encoding="utf-8")
    assert "_widen_alembic_version_column()" in lifecycle_migration
    assert "type_=sa.String(length=255)" in lifecycle_migration
    assert "_restore_legacy_alembic_version_column" not in lifecycle_migration


def test_telemetry_values_are_finite_and_cannot_be_used_for_private_prose() -> None:
    assert sanitize_attributes({"status": "completed", "source": "event_stream"}) == {
        "status": "completed", "source": "event_stream",
    }
    assert sanitize_attributes({
        "status": "a learner said something private", "reasoning": "private thought",
        "invite_token": "secret", "source": "unknown caller",
    }) == {}


def test_rollout_creation_gates_keep_existing_session_reads_compatible() -> None:
    source = Path("app/api/family_sessions.py").read_text(encoding="utf-8")
    assert "def _require_new_session_rollout" in source
    assert "FeatureFlag.SCENE_CONTRACT" in source
    assert "FeatureFlag.GAMEPLAY_SHELL" in source
    assert "FeatureFlag.NEW_SOLO_SESSIONS" in source
    assert "FeatureFlag.RELATIONSHIPS" in source
    assert "FeatureFlag.MULTIPLAYER_EVENTS" in source
    # Active sessions resume before a flag is consulted; only new attempts are gated.
    assert source.index("if active:\n        return _resume_active_attempt(response, active)") < source.index(
        "_require_new_session_rollout(shared=bool(body.relationship_ref))"
    )


def test_sse_replay_is_bounded_for_family_and_admin_streams() -> None:
    family = Path("app/api/family_sessions.py").read_text(encoding="utf-8")
    admin = Path("app/api/admin_simulations.py").read_text(encoding="utf-8")
    for source in (family, admin):
        assert "MAX_SSE_REPLAY_EVENTS = 250" in source
        assert ".id.desc()).limit(MAX_SSE_REPLAY_EVENTS).all()" in source
        assert "rows.reverse()" in source
