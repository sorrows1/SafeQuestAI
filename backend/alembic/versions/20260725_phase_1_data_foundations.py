"""Add Phase 1 content and family-session foundations.

Revision ID: 20260725_phase1
Revises:
Create Date: 2026-07-25
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260725_phase1"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create the curated-content and non-graded family-session tables.

    This repository has no pre-existing ``game_sessions`` or ``player_attempts``
    tables to transform. These replacement tables are therefore created as the
    initial family-session schema. Deployments that have those legacy tables
    must map their data separately before this revision is applied.
    """
    op.create_table(
        "curated_transcripts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_session_id", sa.Integer(), sa.ForeignKey("conversation_sessions.id"), nullable=False),
        sa.Column("is_grooming", sa.Boolean(), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False, server_default="Medium"),
        sa.Column("tactic_tags", sa.JSON(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("category", sa.String(length=50), nullable=False, server_default="grooming"),
        sa.Column("render_skin", sa.String(length=50), nullable=False, server_default="chat"),
    )
    op.create_table(
        "curated_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transcript_id", sa.Integer(), sa.ForeignKey("curated_transcripts.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("speaker_label", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("pace", sa.String(length=20), nullable=False, server_default="normal"),
        sa.Column("is_checkpoint", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("checkpoint_prompt", sa.Text(), nullable=True),
    )
    op.create_index("ix_curated_messages_transcript_id", "curated_messages", ["transcript_id"])
    op.create_table(
        "family_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transcript_id", sa.Integer(), sa.ForeignKey("curated_transcripts.id"), nullable=False),
        sa.Column("child_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("parent_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("companion_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("detective_mode", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("revealed_up_to", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_family_sessions_child_user_id", "family_sessions", ["child_user_id"])
    op.create_table(
        "checkpoint_responses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("checkpoint_message_id", sa.Integer(), sa.ForeignKey("curated_messages.id"), nullable=False),
        sa.Column("responder_role", sa.String(length=20), nullable=False),
        sa.Column("response_text", sa.Text(), nullable=False),
        sa.Column("flagged_message_ids", sa.JSON(), nullable=False),
        sa.Column("tactic_tag_guess", sa.String(length=100), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_checkpoint_responses_family_session_id", "checkpoint_responses", ["family_session_id"])
    op.create_table(
        "conversation_guides",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("scenario_summary", sa.Text(), nullable=False),
        sa.Column("child_reasoning_excerpt", sa.JSON(), nullable=False),
        sa.Column("discussion_prompts", sa.JSON(), nullable=False),
        sa.Column("completed_together", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversation_guides_family_session_id", "conversation_guides", ["family_session_id"])


def downgrade() -> None:
    op.drop_index("ix_conversation_guides_family_session_id", table_name="conversation_guides")
    op.drop_table("conversation_guides")
    op.drop_index("ix_checkpoint_responses_family_session_id", table_name="checkpoint_responses")
    op.drop_table("checkpoint_responses")
    op.drop_index("ix_family_sessions_child_user_id", table_name="family_sessions")
    op.drop_table("family_sessions")
    op.drop_index("ix_curated_messages_transcript_id", table_name="curated_messages")
    op.drop_table("curated_messages")
    op.drop_table("curated_transcripts")
