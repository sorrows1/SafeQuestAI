from app.models.orm import FamilySession, FamilySessionCommand
from app.models.schemas import FamilySessionCommandRequest, FamilySessionCommandType


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
