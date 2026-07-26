"""Phase 4 grounded red-flag attempt idempotency."""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260726_phase4_companion_loop"
down_revision: Union[str, Sequence[str], None] = "20260726_phase3_session_commands"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add the fields before the backfill: batch operations defer DDL until exit.
    op.add_column("flag_attempts", sa.Column("claim", sa.String(length=20), nullable=False, server_default="red_flag"))
    op.add_column("flag_attempts", sa.Column("client_command_id", sa.String(length=128), nullable=False, server_default="legacy"))
    op.execute("UPDATE flag_attempts SET client_command_id = 'legacy-' || id")
    with op.batch_alter_table("flag_attempts") as batch:
        batch.create_unique_constraint("uq_flag_attempt_command_id", ["family_session_id", "client_command_id"])


def downgrade() -> None:
    with op.batch_alter_table("flag_attempts") as batch:
        batch.drop_constraint("uq_flag_attempt_command_id", type_="unique")
        batch.drop_column("client_command_id")
        batch.drop_column("claim")
