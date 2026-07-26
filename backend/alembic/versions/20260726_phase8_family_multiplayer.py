"""Phase 8 durable family multiplayer, presence, and review records.

Revision ID: 20260726_p8_multiplayer
Revises: 20260726_phase7_family_linking
Create Date: 2026-07-26
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

revision: str = "20260726_p8_multiplayer"
down_revision: Union[str, Sequence[str], None] = "20260726_phase7_family_linking"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table("family_sessions") as batch:
        batch.add_column(sa.Column("event_sequence", sa.Integer(), nullable=False, server_default="0"))

    with op.batch_alter_table("family_session_participants") as batch:
        batch.add_column(sa.Column("presence_status", sa.String(length=20), nullable=False, server_default="offline"))
        batch.add_column(sa.Column("last_heartbeat_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("presence_expires_at", sa.DateTime(timezone=True), nullable=True))

    with op.batch_alter_table("flag_attempts") as batch:
        batch.add_column(sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"))

    with op.batch_alter_table("checkpoint_responses") as batch:
        batch.add_column(sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"))
        batch.add_column(sa.Column("client_command_id", sa.String(length=128), nullable=True))
    op.create_index("ix_checkpoint_responses_client_command_id", "checkpoint_responses", ["client_command_id"])

    with op.batch_alter_table("companion_exchanges") as batch:
        batch.add_column(sa.Column("visibility", sa.String(length=20), nullable=False, server_default="private"))
        batch.add_column(sa.Column("shared_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "family_session_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=50), nullable=False),
        sa.Column("actor_participant_id", sa.Integer(), sa.ForeignKey("family_session_participants.id"), nullable=True),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("is_ephemeral", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("family_session_id", "sequence", name="uq_family_session_event_sequence"),
    )
    op.create_index("ix_family_session_events_family_session_id", "family_session_events", ["family_session_id"])
    op.create_index("ix_family_session_events_actor_participant_id", "family_session_events", ["actor_participant_id"])

    op.create_table(
        "family_caregiver_comments",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("public_id", sa.String(length=64), nullable=False, unique=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("author_participant_id", sa.Integer(), sa.ForeignKey("family_session_participants.id"), nullable=False),
        sa.Column("scene_element_id", sa.Integer(), sa.ForeignKey("curated_scene_elements.id"), nullable=True),
        sa.Column("validated_finding_id", sa.Integer(), sa.ForeignKey("validated_findings.id"), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("child_visible_label", sa.String(length=80), nullable=False, server_default="Caregiver note"),
        sa.Column("client_command_id", sa.String(length=128), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("family_session_id", "client_command_id", name="uq_family_caregiver_comment_command"),
        sa.CheckConstraint("(scene_element_id IS NOT NULL) <> (validated_finding_id IS NOT NULL)", name="ck_family_caregiver_comment_anchor"),
    )
    for column in ("public_id", "family_session_id", "author_participant_id", "scene_element_id", "validated_finding_id"):
        op.create_index(f"ix_family_caregiver_comments_{column}", "family_caregiver_comments", [column], unique=column == "public_id")

    op.create_table(
        "family_caregiver_comment_audits",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("comment_id", sa.Integer(), sa.ForeignKey("family_caregiver_comments.id"), nullable=False),
        sa.Column("actor_participant_id", sa.Integer(), sa.ForeignKey("family_session_participants.id"), nullable=False),
        sa.Column("action", sa.String(length=20), nullable=False),
        sa.Column("text_snapshot", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_family_caregiver_comment_audits_comment_id", "family_caregiver_comment_audits", ["comment_id"])
    op.create_index("ix_family_caregiver_comment_audits_actor_participant_id", "family_caregiver_comment_audits", ["actor_participant_id"])


def downgrade() -> None:
    op.drop_index("ix_family_caregiver_comment_audits_actor_participant_id", table_name="family_caregiver_comment_audits")
    op.drop_index("ix_family_caregiver_comment_audits_comment_id", table_name="family_caregiver_comment_audits")
    op.drop_table("family_caregiver_comment_audits")
    for column in ("validated_finding_id", "scene_element_id", "author_participant_id", "family_session_id", "public_id"):
        op.drop_index(f"ix_family_caregiver_comments_{column}", table_name="family_caregiver_comments")
    op.drop_table("family_caregiver_comments")
    op.drop_index("ix_family_session_events_actor_participant_id", table_name="family_session_events")
    op.drop_index("ix_family_session_events_family_session_id", table_name="family_session_events")
    op.drop_table("family_session_events")
    with op.batch_alter_table("companion_exchanges") as batch:
        batch.drop_column("shared_at")
        batch.drop_column("visibility")
    op.drop_index("ix_checkpoint_responses_client_command_id", table_name="checkpoint_responses")
    with op.batch_alter_table("checkpoint_responses") as batch:
        batch.drop_column("client_command_id")
        batch.drop_column("visibility")
    with op.batch_alter_table("flag_attempts") as batch:
        batch.drop_column("visibility")
    with op.batch_alter_table("family_session_participants") as batch:
        batch.drop_column("presence_expires_at")
        batch.drop_column("last_heartbeat_at")
        batch.drop_column("presence_status")
    with op.batch_alter_table("family_sessions") as batch:
        batch.drop_column("event_sequence")
