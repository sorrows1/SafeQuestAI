"""Persist Phase 9 reviewed tactic-repeat justification.

Revision ID: 20260727_phase9_authoring_quality
Revises: 20260727_phase6_session_lifecycle
Create Date: 2026-07-27
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260727_phase9_authoring_quality"
down_revision: Union[str, Sequence[str], None] = "20260727_phase6_session_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("red_flag_spans") as batch:
        batch.add_column(sa.Column("repeat_justification", sa.Text(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("red_flag_spans") as batch:
        batch.drop_column("repeat_justification")
