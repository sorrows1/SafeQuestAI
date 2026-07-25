"""Baseline current Safe Quest schema.

Revision ID: 20260725_baseline_current
Revises:
Create Date: 2026-07-25
"""

from __future__ import annotations

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "20260725_baseline_current"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("email", sa.String(length=255), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=True),
        sa.Column("display_name", sa.String(length=100), nullable=False),
        sa.Column("avatar_url", sa.String(length=512), nullable=True),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("google_id", sa.String(length=255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.UniqueConstraint("email"),
        sa.UniqueConstraint("google_id"),
    )
    op.create_index("ix_users_id", "users", ["id"])
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    op.create_table(
        "conversation_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("scenario_id", sa.String(length=255), nullable=False),
        sa.Column("difficulty", sa.String(length=50), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
    )
    op.create_index("ix_conversation_sessions_id", "conversation_sessions", ["id"])
    op.create_index("ix_conversation_sessions_scenario_id", "conversation_sessions", ["scenario_id"])

    for table_name, columns in [
        (
            "content_scenarios",
            [
                sa.Column("id", sa.String(length=255), primary_key=True),
                sa.Column("display_name", sa.String(length=255), nullable=False),
                sa.Column("difficulty", sa.String(length=50), nullable=False),
                sa.Column("data", sa.JSON(), nullable=False),
                sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            ],
        ),
        (
            "content_personas",
            [
                sa.Column("id", sa.String(length=255), primary_key=True),
                sa.Column("display_name", sa.String(length=255), nullable=False),
                sa.Column("data", sa.JSON(), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            ],
        ),
        (
            "content_stages",
            [
                sa.Column("id", sa.String(length=255), primary_key=True),
                sa.Column("display_name", sa.String(length=255), nullable=False),
                sa.Column("data", sa.JSON(), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            ],
        ),
        (
            "content_objectives",
            [
                sa.Column("id", sa.String(length=255), primary_key=True),
                sa.Column("display_name", sa.String(length=255), nullable=False),
                sa.Column("data", sa.JSON(), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            ],
        ),
        (
            "content_constraints",
            [
                sa.Column("id", sa.String(length=255), primary_key=True),
                sa.Column("data", sa.JSON(), nullable=False),
                sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
            ],
        ),
    ]:
        op.create_table(table_name, *columns)

    op.create_table(
        "content_prompts",
        sa.Column("name", sa.String(length=255), primary_key=True),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("variables", sa.JSON(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("kind", sa.String(length=30), nullable=False),
        sa.Column("role_scope", sa.String(length=30), nullable=False),
        sa.Column("version", sa.String(length=30), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )

    op.create_table(
        "conversation_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("session_id", sa.Integer(), sa.ForeignKey("conversation_sessions.id"), nullable=False),
        sa.Column("sender", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=True),
        sa.Column("sequence", sa.Integer(), nullable=True),
        sa.Column("branch_id", sa.String(length=64), nullable=False),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversation_messages_id", "conversation_messages", ["id"])
    op.create_index("ix_conversation_messages_session_id", "conversation_messages", ["session_id"])
    op.create_index("ix_conversation_messages_sequence", "conversation_messages", ["sequence"])

    op.create_table(
        "curated_transcripts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("source_session_id", sa.Integer(), sa.ForeignKey("conversation_sessions.id"), nullable=False),
        sa.Column("is_concerning_example", sa.Boolean(), nullable=False),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("tactic_tags", sa.JSON(), nullable=False),
        sa.Column("reviewed_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_published", sa.Boolean(), nullable=False),
        sa.Column("category", sa.String(length=50), nullable=False),
        sa.Column("render_skin", sa.String(length=50), nullable=False),
        sa.Column("source_scenario_id", sa.String(length=255), nullable=True),
        sa.Column("public_metadata_snapshot", sa.JSON(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_index("ix_curated_transcripts_source_scenario_id", "curated_transcripts", ["source_scenario_id"])

    op.create_table(
        "curated_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transcript_id", sa.Integer(), sa.ForeignKey("curated_transcripts.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("speaker_label", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("pace", sa.String(length=20), nullable=False),
        sa.Column("is_checkpoint", sa.Boolean(), nullable=False),
        sa.Column("checkpoint_prompt", sa.Text(), nullable=True),
    )
    op.create_index("ix_curated_messages_transcript_id", "curated_messages", ["transcript_id"])

    op.create_table(
        "red_flag_spans",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transcript_id", sa.Integer(), sa.ForeignKey("curated_transcripts.id"), nullable=False),
        sa.Column("message_sequence", sa.Integer(), nullable=True),
        sa.Column("start_offset", sa.Integer(), nullable=True),
        sa.Column("end_offset", sa.Integer(), nullable=True),
        sa.Column("tactic_tag", sa.String(length=100), nullable=False),
        sa.Column("source", sa.String(length=20), nullable=False),
    )
    op.create_index("ix_red_flag_spans_transcript_id", "red_flag_spans", ["transcript_id"])

    op.create_table(
        "family_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("transcript_id", sa.Integer(), sa.ForeignKey("curated_transcripts.id"), nullable=False),
        sa.Column("child_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("parent_user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("companion_mode", sa.Boolean(), nullable=False),
        sa.Column("detective_mode", sa.Boolean(), nullable=False),
        sa.Column("disclosure_flagged", sa.Boolean(), nullable=False),
        sa.Column("revealed_up_to", sa.Integer(), nullable=False),
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
        sa.Column("completed_together", sa.Boolean(), nullable=False),
        sa.Column("generated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_conversation_guides_family_session_id", "conversation_guides", ["family_session_id"])

    op.create_table(
        "companion_exchanges",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("family_session_id", sa.Integer(), sa.ForeignKey("family_sessions.id"), nullable=False),
        sa.Column("exchange_type", sa.String(length=30), nullable=False),
        sa.Column("child_text", sa.Text(), nullable=False),
        sa.Column("companion_text", sa.Text(), nullable=False),
        sa.Column("disclosure_triggered", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_companion_exchanges_family_session_id", "companion_exchanges", ["family_session_id"])

    op.create_table(
        "simulation_runs",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("mode", sa.String(length=30), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column("creator_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("scenario_id", sa.String(length=255), nullable=True),
        sa.Column("config_snapshot", sa.JSON(), nullable=False),
        sa.Column("state", sa.JSON(), nullable=False),
        sa.Column("progress", sa.JSON(), nullable=False),
        sa.Column("stop_reason", sa.Text(), nullable=True),
        sa.Column("resource_usage", sa.JSON(), nullable=False),
        sa.Column("worker_lease", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_simulation_runs_creator_id", "simulation_runs", ["creator_id"])
    op.create_index("ix_simulation_runs_scenario_id", "simulation_runs", ["scenario_id"])

    op.create_table(
        "simulation_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("simulation_runs.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("branch_id", sa.String(length=64), nullable=False),
        sa.Column("sender", sa.String(length=50), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_simulation_messages_run_id", "simulation_messages", ["run_id"])

    op.create_table(
        "simulation_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("run_id", sa.Integer(), sa.ForeignKey("simulation_runs.id"), nullable=False),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("event_type", sa.String(length=80), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_simulation_events_run_id", "simulation_events", ["run_id"])

    op.create_table(
        "simulation_message_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("simulation_messages.id"), nullable=False),
        sa.Column("revision_number", sa.Integer(), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("metadata_json", sa.JSON(), nullable=False),
        sa.Column("supersedes_revision_id", sa.Integer(), sa.ForeignKey("simulation_message_revisions.id"), nullable=True),
        sa.Column("editor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("reason", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_simulation_message_revisions_message_id", "simulation_message_revisions", ["message_id"])


def downgrade() -> None:
    op.drop_index("ix_simulation_message_revisions_message_id", table_name="simulation_message_revisions")
    op.drop_table("simulation_message_revisions")
    op.drop_index("ix_simulation_events_run_id", table_name="simulation_events")
    op.drop_table("simulation_events")
    op.drop_index("ix_simulation_messages_run_id", table_name="simulation_messages")
    op.drop_table("simulation_messages")
    op.drop_index("ix_simulation_runs_scenario_id", table_name="simulation_runs")
    op.drop_index("ix_simulation_runs_creator_id", table_name="simulation_runs")
    op.drop_table("simulation_runs")
    op.drop_index("ix_companion_exchanges_family_session_id", table_name="companion_exchanges")
    op.drop_table("companion_exchanges")
    op.drop_index("ix_conversation_guides_family_session_id", table_name="conversation_guides")
    op.drop_table("conversation_guides")
    op.drop_index("ix_checkpoint_responses_family_session_id", table_name="checkpoint_responses")
    op.drop_table("checkpoint_responses")
    op.drop_index("ix_family_sessions_child_user_id", table_name="family_sessions")
    op.drop_table("family_sessions")
    op.drop_index("ix_red_flag_spans_transcript_id", table_name="red_flag_spans")
    op.drop_table("red_flag_spans")
    op.drop_index("ix_curated_messages_transcript_id", table_name="curated_messages")
    op.drop_table("curated_messages")
    op.drop_index("ix_curated_transcripts_source_scenario_id", table_name="curated_transcripts")
    op.drop_table("curated_transcripts")
    op.drop_index("ix_conversation_messages_sequence", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_session_id", table_name="conversation_messages")
    op.drop_index("ix_conversation_messages_id", table_name="conversation_messages")
    op.drop_table("conversation_messages")
    op.drop_table("content_prompts")
    op.drop_table("content_constraints")
    op.drop_table("content_objectives")
    op.drop_table("content_stages")
    op.drop_table("content_personas")
    op.drop_table("content_scenarios")
    op.drop_index("ix_conversation_sessions_scenario_id", table_name="conversation_sessions")
    op.drop_index("ix_conversation_sessions_id", table_name="conversation_sessions")
    op.drop_table("conversation_sessions")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_index("ix_users_id", table_name="users")
    op.drop_table("users")
