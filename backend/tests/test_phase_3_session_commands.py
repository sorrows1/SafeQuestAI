from app.models.orm import FamilySession, FamilySessionCommand
from app.models.schemas import (
    FamilySessionCommandRequest,
    FamilySessionCommandType,
    FamilySessionOut,
    FamilySessionState,
    SessionProgressOut,
)


def test_phase_three_command_contract_is_versioned_and_idempotent() -> None:
    request = FamilySessionCommandRequest(
        command=FamilySessionCommandType.REVEAL_NEXT,
        expected_state_version=3,
        client_command_id="client-command-123",
    )
    assert request.command is FamilySessionCommandType.REVEAL_NEXT
    assert request.expected_state_version == 3
    assert "family_session_commands" in FamilySessionCommand.metadata.tables
    assert {"family_session_id", "client_command_id", "resulting_session_id"}.issubset(FamilySessionCommand.__table__.columns.keys())


def test_phase_three_session_preserves_completion_and_attempt_lineage() -> None:
    columns = FamilySession.__table__.columns.keys()
    assert {"completion_acknowledged_at", "attempt_number", "previous_session_id", "archived_at"}.issubset(columns)


def test_phase_three_progress_starts_empty_and_exposes_totals() -> None:
    session = FamilySessionOut(
        id=1, transcript_id=2, companion_mode=True,
        detective_mode=True, started_at="now", completed_at=None,
        state=FamilySessionState.IN_PROGRESS,
    )
    progress = SessionProgressOut(content_progress=0, content_total=4, checkpoint_progress=0, checkpoint_total=2)
    assert session.revealed_up_to == -1
    assert (progress.content_progress, progress.content_total) == (0, 4)
    assert (progress.checkpoint_progress, progress.checkpoint_total) == (0, 2)
