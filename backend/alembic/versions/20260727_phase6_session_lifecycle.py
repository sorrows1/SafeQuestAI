"""Enforce one non-terminal learner attempt per published scenario.

Revision ID: 20260727_phase6_session_lifecycle
Revises: 20260726_p8_multiplayer
Create Date: 2026-07-27
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260727_phase6_session_lifecycle"
down_revision: Union[str, Sequence[str], None] = "20260726_p8_multiplayer"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


TERMINAL_STATES = ("completed", "abandoned", "expired")
INDEX_NAME = "uq_family_sessions_active_learner_transcript"
PREDICATE = "state NOT IN ('completed', 'abandoned', 'expired')"


def _widen_alembic_version_column() -> None:
    """Revision IDs outgrew the legacy 32-character Alembic version column.

    PostgreSQL enforces the historical width; SQLite does not, so this is a
    no-op there and keeps the migration rehearsal portable.
    """
    bind = op.get_bind()
    if bind.dialect.name == "postgresql":
        op.alter_column("alembic_version", "version_num", existing_type=sa.String(length=32), type_=sa.String(length=255))


def upgrade() -> None:
    # Alembic writes this revision ID after upgrade() returns, so widen first.
    _widen_alembic_version_column()
    # Existing duplicate live attempts are retained as history, but only the
    # newest remains resumable before the partial unique index is installed.
    bind = op.get_bind()
    metadata = sa.MetaData()
    sessions = sa.Table("family_sessions", metadata, autoload_with=bind)
    rows = bind.execute(
        sa.select(sessions.c.id, sessions.c.child_user_id, sessions.c.transcript_id)
        .where(sessions.c.state.not_in(TERMINAL_STATES))
        .order_by(sessions.c.child_user_id, sessions.c.transcript_id, sessions.c.updated_at.desc(), sessions.c.id.desc())
    ).mappings()
    seen: set[tuple[int, int]] = set()
    archived_at = datetime.now(timezone.utc)
    for row in rows:
        key = (row["child_user_id"], row["transcript_id"])
        if key in seen:
            bind.execute(
                sessions.update().where(sessions.c.id == row["id"]).values(
                    state="abandoned", archived_at=archived_at,
                )
            )
        else:
            seen.add(key)
    op.create_index(
        INDEX_NAME,
        "family_sessions",
        ["child_user_id", "transcript_id"],
        unique=True,
        sqlite_where=sa.text(PREDICATE),
        postgresql_where=sa.text(PREDICATE),
    )


def downgrade() -> None:
    op.drop_index(INDEX_NAME, table_name="family_sessions")
    # Keep the widened Alembic metadata column. Alembic records the prior
    # revision only after downgrade() returns, so narrowing here would reject
    # the current longer revision ID before it can be replaced.
