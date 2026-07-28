"""Add join_code columns to family_sessions.

Revision ID: 20260727_join_code
Revises: 20260727_phase9_authoring_quality
Create Date: 2026-07-27
"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260727_join_code"
down_revision: Union[str, Sequence[str], None] = "20260727_phase9_authoring_quality"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("family_sessions") as batch:
        batch.add_column(sa.Column("join_code_hash", sa.String(255), nullable=True))
        batch.add_column(sa.Column("join_code_short", sa.String(8), nullable=True, index=True))


def downgrade() -> None:
    with op.batch_alter_table("family_sessions") as batch:
        batch.drop_column("join_code_short")
        batch.drop_column("join_code_hash")
