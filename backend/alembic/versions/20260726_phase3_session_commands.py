"""Phase 3 server-authoritative family session commands.

Revision ID: 20260726_phase3_session_commands
Revises: 20260725_phase1_contracts
Create Date: 2026-07-26
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260726_phase3_session_commands"
down_revision: Union[str, Sequence[str], None] = "20260725_phase1_contracts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("family_sessions") as batch:
        batch.add_column(sa.Column("completion_acknowledged_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("completion_acknowledged_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
        batch.add_column(sa.Column("attempt_number", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("previous_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=True))
        batch.add_column(sa.Column("archived_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "family_session_commands",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("client_command_id", sa.String(length=128), nullable=False),
        sa.Column("command", sa.String(length=50), nullable=False),
        sa.Column("expected_state_version", sa.Integer(), nullable=False),
        sa.Column("resulting_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("family_session_id", "client_command_id", name="uq_family_session_command_id"),
    )
    op.create_index("ix_family_session_commands_family_session_id", "family_session_commands", ["family_session_id"])


def downgrade() -> None:
    op.drop_index("ix_family_session_commands_family_session_id", table_name="family_session_commands")
    op.drop_table("family_session_commands")
    with op.batch_alter_table("family_sessions") as batch:
        batch.drop_column("archived_at")
        batch.drop_column("previous_session_id")
        batch.drop_column("attempt_number")
        batch.drop_column("completion_acknowledged_by_user_id")
        batch.drop_column("completion_acknowledged_at")
