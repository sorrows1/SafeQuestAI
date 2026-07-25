"""Add Phase 7 companion safety persistence.
Revision ID: 20260725_phase7
Revises: 20260725_phase1
"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa
revision: str = "20260725_phase7"
down_revision: Union[str, Sequence[str], None] = "20260725_phase1"
branch_labels = None
depends_on = None
def upgrade() -> None:
    op.add_column("family_sessions", sa.Column("disclosure_flagged", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.create_table("companion_exchanges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("exchange_type", sa.String(length=30), nullable=False),
        sa.Column("child_text", sa.Text(), nullable=False),
        sa.Column("companion_text", sa.Text(), nullable=False),
        sa.Column("disclosure_triggered", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_companion_exchanges_family_session_id", "companion_exchanges", ["family_session_id"])
def downgrade() -> None:
    op.drop_index("ix_companion_exchanges_family_session_id", table_name="companion_exchanges")
    op.drop_table("companion_exchanges")
    op.drop_column("family_sessions", "disclosure_flagged")
