"""Phase 7 verified family-linking contracts.

Revision ID: 20260726_phase7_family_linking
Revises: 20260725_phase1_contracts
Create Date: 2026-07-26
"""

from __future__ import annotations

import secrets
from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260726_phase7_family_linking"
down_revision: Union[str, Sequence[str], None] = "20260726_p5_scene_contract"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _opaque(prefix: str) -> str:
    return f"{prefix}_{secrets.token_urlsafe(18)}"


def upgrade() -> None:
    with op.batch_alter_table("users") as batch:
        batch.add_column(sa.Column("age_band", sa.String(length=20), nullable=True))
        batch.add_column(sa.Column("age_adaptation_consent_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("caregiver_consent_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("family_sessions") as batch:
        batch.add_column(sa.Column("public_id", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("owner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_family_sessions_public_id", "family_sessions", ["public_id"], unique=True)
    op.create_index("ix_family_sessions_owner_user_id", "family_sessions", ["owner_user_id"])

    with op.batch_alter_table("family_relationship_invitations") as batch:
        batch.add_column(sa.Column("public_id", sa.String(length=64), nullable=True))
        batch.alter_column("learner_email", existing_type=sa.String(length=255), nullable=True)
        batch.add_column(sa.Column("short_code_hash", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("status", sa.String(length=20), nullable=False, server_default="pending"))
        batch.add_column(sa.Column("delivery_label", sa.String(length=120), nullable=True))
        batch.add_column(sa.Column("failed_lookup_count", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("accept_attempt_count", sa.Integer(), nullable=False, server_default="0"))
        batch.add_column(sa.Column("last_attempt_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_family_relationship_invitations_public_id", "family_relationship_invitations", ["public_id"], unique=True)
    op.create_index("ix_family_relationship_invitations_short_code_hash", "family_relationship_invitations", ["short_code_hash"], unique=True)

    with op.batch_alter_table("family_relationships") as batch:
        batch.add_column(sa.Column("public_id", sa.String(length=64), nullable=True))
        batch.add_column(sa.Column("user_low_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("user_high_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("status", sa.String(length=20), nullable=False, server_default="active"))
        batch.add_column(sa.Column("blocked_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True))
    op.create_index("ix_family_relationships_public_id", "family_relationships", ["public_id"], unique=True)

    op.create_table(
        "family_relationship_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("relationship_id", sa.Integer(), sa.ForeignKey("family_relationships.id"), nullable=True),
        sa.Column("invitation_id", sa.Integer(), sa.ForeignKey("family_relationship_invitations.id"), nullable=True),
        sa.Column("actor_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("action", sa.String(length=50), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for column in ("relationship_id", "invitation_id", "actor_user_id"):
        op.create_index(f"ix_family_relationship_audit_events_{column}", "family_relationship_audit_events", [column])

    _backfill_family_references()
    with op.batch_alter_table("family_relationships") as batch:
        batch.create_check_constraint("ck_family_relationship_distinct_users", "user_low_id IS NULL OR user_low_id < user_high_id")
    op.create_index("uq_family_relationship_unordered_pair", "family_relationships", ["user_low_id", "user_high_id"], unique=True)


def _backfill_family_references() -> None:
    bind = op.get_bind()
    metadata = sa.MetaData()
    sessions = sa.Table("family_sessions", metadata, autoload_with=bind)
    relationships = sa.Table("family_relationships", metadata, autoload_with=bind)
    invitations = sa.Table("family_relationship_invitations", metadata, autoload_with=bind)
    participants = sa.Table("family_session_participants", metadata, autoload_with=bind)
    users = sa.Table("users", metadata, autoload_with=bind)
    now = datetime.now(timezone.utc)
    valid_users = set(bind.execute(sa.select(users.c.id)).scalars())

    for row in bind.execute(sa.select(sessions)).mappings():
        owner = row["child_user_id"] if row["child_user_id"] in valid_users else None
        bind.execute(sessions.update().where(sessions.c.id == row["id"]).values(public_id=_opaque("fs"), owner_user_id=owner))
        if owner is not None:
            exists = bind.execute(sa.select(participants.c.id).where(participants.c.family_session_id == row["id"], participants.c.user_id == owner)).scalar_one_or_none()
            if exists is None:
                bind.execute(participants.insert().values(family_session_id=row["id"], user_id=owner, role="learner", joined_at=row["started_at"] or now, last_seen_at=None, left_at=None))

    for row in bind.execute(sa.select(invitations)).mappings():
        status = "accepted" if row["accepted_at"] else ("revoked" if row["revoked_at"] else "pending")
        bind.execute(invitations.update().where(invitations.c.id == row["id"]).values(public_id=_opaque("fi"), status=status))

    seen_pairs = set()
    for row in bind.execute(sa.select(relationships)).mappings():
        caregiver, learner = row["caregiver_user_id"], row["learner_user_id"]
        pair = tuple(sorted((caregiver, learner)))
        if caregiver == learner or pair in seen_pairs:
            bind.execute(relationships.update().where(relationships.c.id == row["id"]).values(public_id=_opaque("fr"), user_low_id=None, user_high_id=None, status="revoked", revoked_at=row["revoked_at"] or now))
            continue
        seen_pairs.add(pair)
        bind.execute(relationships.update().where(relationships.c.id == row["id"]).values(public_id=_opaque("fr"), user_low_id=pair[0], user_high_id=pair[1], status="revoked" if row["revoked_at"] else "active"))



def downgrade() -> None:
    for column in ("actor_user_id", "invitation_id", "relationship_id"):
        op.drop_index(f"ix_family_relationship_audit_events_{column}", table_name="family_relationship_audit_events")
    op.drop_table("family_relationship_audit_events")
    op.drop_index("uq_family_relationship_unordered_pair", table_name="family_relationships")
    op.drop_index("ix_family_relationships_public_id", table_name="family_relationships")
    with op.batch_alter_table("family_relationships") as batch:
        batch.drop_constraint("ck_family_relationship_distinct_users", type_="check")
        batch.drop_column("blocked_by_user_id")
        batch.drop_column("status")
        batch.drop_column("user_high_id")
        batch.drop_column("user_low_id")
        batch.drop_column("public_id")
    op.drop_index("ix_family_relationship_invitations_short_code_hash", table_name="family_relationship_invitations")
    op.drop_index("ix_family_relationship_invitations_public_id", table_name="family_relationship_invitations")
    with op.batch_alter_table("family_relationship_invitations") as batch:
        batch.drop_column("last_attempt_at")
        batch.drop_column("accept_attempt_count")
        batch.drop_column("failed_lookup_count")
        batch.drop_column("delivery_label")
        batch.drop_column("status")
        batch.drop_column("short_code_hash")
        batch.alter_column("learner_email", existing_type=sa.String(length=255), nullable=False)
        batch.drop_column("public_id")
    op.drop_index("ix_family_sessions_owner_user_id", table_name="family_sessions")
    op.drop_index("ix_family_sessions_public_id", table_name="family_sessions")
    with op.batch_alter_table("family_sessions") as batch:
        batch.drop_column("owner_user_id")
        batch.drop_column("public_id")
    with op.batch_alter_table("users") as batch:
        batch.drop_column("caregiver_consent_at")
        batch.drop_column("age_adaptation_consent_at")
        batch.drop_column("age_band")
