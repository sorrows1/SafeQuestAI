"""Phase 5 skin-neutral scene semantics.

Revision ID: 20260726_p5_scene_contract
Revises: 20260726_phase4_companion_loop
Create Date: 2026-07-26

The upgrade is additive. Existing message-backed elements receive stable actor
keys and inert presentation defaults, so a legacy curated transcript remains
renderable while it is reviewed for publication.
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260726_p5_scene_contract"
down_revision: Union[str, Sequence[str], None] = "20260726_phase4_companion_loop"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _backfill_scene_semantics() -> None:
    """Give legacy message elements safe, deterministic semantic defaults."""
    bind = op.get_bind()
    metadata = sa.MetaData()
    elements = sa.Table("curated_scene_elements", metadata, autoload_with=bind)
    rows = bind.execute(sa.select(elements.c.id, elements.c.source_message_id)).mappings()
    for row in rows:
        values: dict[str, object] = {"timestamp_semantics": "none", "relationships": []}
        if row["source_message_id"] is not None:
            values["actor_key"] = f"actor-{row['source_message_id']}"
        bind.execute(elements.update().where(elements.c.id == row["id"]).values(**values))


def upgrade() -> None:
    with op.batch_alter_table("curated_scene_elements") as batch:
        batch.add_column(sa.Column("actor_key", sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("timestamp_semantics", sa.String(length=20), nullable=False, server_default="none"))
        batch.add_column(sa.Column("timestamp", sa.String(length=100), nullable=True))
        batch.add_column(sa.Column("relationships", sa.JSON(), nullable=False, server_default=sa.text("'[]'")))
    _backfill_scene_semantics()


def downgrade() -> None:
    with op.batch_alter_table("curated_scene_elements") as batch:
        batch.drop_column("relationships")
        batch.drop_column("timestamp")
        batch.drop_column("timestamp_semantics")
        batch.drop_column("actor_key")
