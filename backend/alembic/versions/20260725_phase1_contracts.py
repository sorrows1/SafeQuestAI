"""Phase 1 versioned scene, family membership, and progress contracts.

Revision ID: 20260725_phase1_contracts
Revises: 20260725_baseline_current
Create Date: 2026-07-25
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260725_phase1_contracts"
down_revision: Union[str, Sequence[str], None] = "20260725_baseline_current"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "curated_scene_elements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transcript_id", sa.Integer(), sa.ForeignKey("curated_transcripts.id"), nullable=False),
        sa.Column("element_key", sa.String(length=255), nullable=False),
        sa.Column("element_type", sa.String(length=40), nullable=False),
        sa.Column("parent_element_key", sa.String(length=255), nullable=True),
        sa.Column("source_message_id", sa.Integer(), sa.ForeignKey("curated_messages.id"), nullable=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("presentation", sa.JSON(), nullable=False),
        sa.Column("selectable", sa.Boolean(), nullable=False),
        sa.Column("accessible_label", sa.String(length=500), nullable=False),
        sa.Column("semantic_role", sa.String(length=100), nullable=False),
        sa.UniqueConstraint("transcript_id", "element_key", name="uq_scene_element_transcript_key"),
    )
    op.create_index("ix_curated_scene_elements_transcript_id", "curated_scene_elements", ["transcript_id"])

    with op.batch_alter_table("red_flag_spans") as batch:
        batch.add_column(sa.Column("scene_element_id", sa.Integer(), sa.ForeignKey("curated_scene_elements.id", name="fk_red_flag_spans_scene_element_id"), nullable=True))
        batch.add_column(sa.Column("child_safe_explanation", sa.Text(), nullable=True))
        batch.add_column(sa.Column("tiered_hints", sa.JSON(), nullable=True))
    op.create_index("ix_red_flag_spans_scene_element_id", "red_flag_spans", ["scene_element_id"])

    with op.batch_alter_table("family_sessions") as batch:
        batch.add_column(sa.Column("state", sa.String(length=40), nullable=False, server_default="in_progress"))
        batch.add_column(sa.Column("state_version", sa.Integer(), nullable=False, server_default="1"))
        batch.add_column(sa.Column("active_checkpoint_element_key", sa.String(length=255), nullable=True))
        batch.add_column(sa.Column("participation_turn_user_id", sa.Integer(), sa.ForeignKey("users.id", name="fk_family_sessions_participation_turn_user_id"), nullable=True))
        batch.add_column(sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        "family_relationship_invitations",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("caregiver_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("learner_email", sa.String(length=255), nullable=False),
        sa.Column("token_hash", sa.String(length=255), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("accepted_by_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_family_relationship_invitations_caregiver_user_id", "family_relationship_invitations", ["caregiver_user_id"])
    op.create_table(
        "family_relationships",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("caregiver_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("learner_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("invitation_id", sa.Integer(), sa.ForeignKey("family_relationship_invitations.id"), nullable=True),
        sa.Column("source", sa.String(length=40), nullable=False),
        sa.Column("accepted_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("caregiver_user_id", "learner_user_id", name="uq_family_relationship_pair"),
    )
    op.create_index("ix_family_relationships_caregiver_user_id", "family_relationships", ["caregiver_user_id"])
    op.create_index("ix_family_relationships_learner_user_id", "family_relationships", ["learner_user_id"])
    op.create_table(
        "family_session_participants",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("joined_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("left_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("family_session_id", "user_id", name="uq_family_session_participant"),
    )
    op.create_index("ix_family_session_participants_family_session_id", "family_session_participants", ["family_session_id"])
    op.create_index("ix_family_session_participants_user_id", "family_session_participants", ["user_id"])
    op.create_table(
        "session_progress",
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), primary_key=True),
        sa.Column("reviewed_element_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("validated_finding_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("eligible_target_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("required_finding_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("checkpoint_progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("content_progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("completion_ready", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_table(
        "flag_attempts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("family_session_participants.id"), nullable=True),
        sa.Column("element_id", sa.Integer(), sa.ForeignKey("curated_scene_elements.id"), nullable=False),
        sa.Column("sanitized_reasoning", sa.Text(), nullable=False),
        sa.Column("claimed_red_flag", sa.Boolean(), nullable=False),
        sa.Column("validation_result", sa.String(length=30), nullable=False, server_default="pending"),
        sa.Column("feedback_snapshot", sa.JSON(), nullable=False),
        sa.Column("disclosure_state", sa.String(length=30), nullable=False, server_default="none"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for name, columns in (("family_session_id", ["family_session_id"]), ("participant_id", ["participant_id"]), ("element_id", ["element_id"])):
        op.create_index(f"ix_flag_attempts_{name}", "flag_attempts", columns)
    op.create_table(
        "validated_findings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("participant_id", sa.Integer(), sa.ForeignKey("family_session_participants.id"), nullable=True),
        sa.Column("element_id", sa.Integer(), sa.ForeignKey("curated_scene_elements.id"), nullable=False),
        sa.Column("red_flag_span_id", sa.Integer(), sa.ForeignKey("red_flag_spans.id"), nullable=False),
        sa.Column("visibility", sa.String(length=20), nullable=False, server_default="shared"),
        sa.Column("discovered_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("family_session_id", "element_id", "red_flag_span_id", name="uq_validated_finding_annotation"),
    )
    for name, columns in (("family_session_id", ["family_session_id"]), ("participant_id", ["participant_id"]), ("element_id", ["element_id"]), ("red_flag_span_id", ["red_flag_span_id"])):
        op.create_index(f"ix_validated_findings_{name}", "validated_findings", columns)

    _backfill_existing_data()


def _backfill_existing_data() -> None:
    """Backfill message elements, annotation targets, legacy members, and progress."""
    bind = op.get_bind()
    metadata = sa.MetaData()
    messages = sa.Table("curated_messages", metadata, autoload_with=bind)
    elements = sa.Table("curated_scene_elements", metadata, autoload_with=bind)
    spans = sa.Table("red_flag_spans", metadata, autoload_with=bind)
    users = sa.Table("users", metadata, autoload_with=bind)
    sessions = sa.Table("family_sessions", metadata, autoload_with=bind)
    participants = sa.Table("family_session_participants", metadata, autoload_with=bind)
    relationships = sa.Table("family_relationships", metadata, autoload_with=bind)
    progress = sa.Table("session_progress", metadata, autoload_with=bind)
    now = datetime.now(timezone.utc)

    element_by_message: dict[int, int] = {}
    for message in bind.execute(sa.select(messages).order_by(messages.c.transcript_id, messages.c.sequence)).mappings():
        key = f"message-{message['id']}"
        existing = bind.execute(sa.select(elements.c.id).where(elements.c.transcript_id == message["transcript_id"], elements.c.element_key == key)).scalar_one_or_none()
        if existing is None:
            result = bind.execute(elements.insert().values(
                transcript_id=message["transcript_id"], element_key=key, element_type="message",
                parent_element_key=None, source_message_id=message["id"], sequence=message["sequence"],
                content=message["content"], presentation={}, selectable=True,
                accessible_label=f"Message from {message['speaker_label']}", semantic_role="article",
            ))
            existing = result.inserted_primary_key[0]
        element_by_message[message["id"]] = existing

    messages_by_transcript_sequence = {(row["transcript_id"], row["sequence"]): row["id"] for row in bind.execute(sa.select(messages.c.id, messages.c.transcript_id, messages.c.sequence)).mappings()}
    for span in bind.execute(sa.select(spans.c.id, spans.c.transcript_id, spans.c.message_sequence, spans.c.scene_element_id)).mappings():
        message_id = messages_by_transcript_sequence.get((span["transcript_id"], span["message_sequence"]))
        element_id = element_by_message.get(message_id) if message_id is not None else None
        if span["scene_element_id"] is None and element_id is not None:
            bind.execute(spans.update().where(spans.c.id == span["id"]).values(scene_element_id=element_id, tiered_hints=[]))

    valid_users = set(bind.execute(sa.select(users.c.id)).scalars())
    eligible_by_transcript = {row["transcript_id"]: row["count"] for row in bind.execute(sa.select(spans.c.transcript_id, sa.func.count(spans.c.id).label("count")).group_by(spans.c.transcript_id)).mappings()}
    content_by_transcript = {row["transcript_id"]: row["count"] for row in bind.execute(sa.select(messages.c.transcript_id, sa.func.count(messages.c.id).label("count")).group_by(messages.c.transcript_id)).mappings()}
    existing_pairs = set()
    for session in bind.execute(sa.select(sessions)).mappings():
        started = session["started_at"] or now
        child = session["child_user_id"]
        parent = session["parent_user_id"]
        if child in valid_users:
            bind.execute(participants.insert().values(family_session_id=session["id"], user_id=child, role="learner", joined_at=started))
        if parent in valid_users and parent != child:
            bind.execute(participants.insert().values(family_session_id=session["id"], user_id=parent, role="caregiver", joined_at=started))
            pair = (parent, child)
            if child in valid_users and pair not in existing_pairs:
                bind.execute(relationships.insert().values(caregiver_user_id=parent, learner_user_id=child, invitation_id=None, source="legacy_direct_session", accepted_at=started, revoked_at=None, created_at=now))
                existing_pairs.add(pair)
        eligible = eligible_by_transcript.get(session["transcript_id"], 0)
        bind.execute(progress.insert().values(family_session_id=session["id"], reviewed_element_count=0, validated_finding_count=0, eligible_target_count=eligible, required_finding_count=eligible, checkpoint_progress=0, content_progress=content_by_transcript.get(session["transcript_id"], 0), completion_ready=False, updated_at=now))
        bind.execute(sessions.update().where(sessions.c.id == session["id"]).values(updated_at=started))


def downgrade() -> None:
    for name in ("red_flag_span_id", "element_id", "participant_id", "family_session_id"):
        op.drop_index(f"ix_validated_findings_{name}", table_name="validated_findings")
    op.drop_table("validated_findings")
    for name in ("element_id", "participant_id", "family_session_id"):
        op.drop_index(f"ix_flag_attempts_{name}", table_name="flag_attempts")
    op.drop_table("flag_attempts")
    op.drop_table("session_progress")
    op.drop_index("ix_family_session_participants_user_id", table_name="family_session_participants")
    op.drop_index("ix_family_session_participants_family_session_id", table_name="family_session_participants")
    op.drop_table("family_session_participants")
    op.drop_index("ix_family_relationships_learner_user_id", table_name="family_relationships")
    op.drop_index("ix_family_relationships_caregiver_user_id", table_name="family_relationships")
    op.drop_table("family_relationships")
    op.drop_index("ix_family_relationship_invitations_caregiver_user_id", table_name="family_relationship_invitations")
    op.drop_table("family_relationship_invitations")
    with op.batch_alter_table("family_sessions") as batch:
        batch.drop_column("updated_at")
        batch.drop_column("participation_turn_user_id")
        batch.drop_column("active_checkpoint_element_key")
        batch.drop_column("state_version")
        batch.drop_column("state")
    op.drop_index("ix_red_flag_spans_scene_element_id", table_name="red_flag_spans")
    with op.batch_alter_table("red_flag_spans") as batch:
        batch.drop_column("tiered_hints")
        batch.drop_column("child_safe_explanation")
        batch.drop_column("scene_element_id")
    op.drop_index("ix_curated_scene_elements_transcript_id", table_name="curated_scene_elements")
    op.drop_table("curated_scene_elements")
