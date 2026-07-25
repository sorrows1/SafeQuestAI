"""
SQLAlchemy ORM models for Safe Quest.

Tables:
  Runtime:
    users, conversation_sessions, conversation_messages
    curated_transcripts, curated_messages, family_sessions, checkpoint_responses,
    conversation_guides
  Content (replaces JSON files after migration):
    content_scenarios, content_personas, content_stages,
    content_objectives, content_constraints, content_prompts
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import (
    String, DateTime, JSON, Integer, ForeignKey, Text,
    Boolean, create_engine,
)
from sqlalchemy.orm import (
    declarative_base, sessionmaker, Mapped,
    mapped_column, relationship,
)
from dotenv import load_dotenv
from pathlib import Path

env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://user:password@db:5432/safe_quest"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────────────────────────────────────────────────────────
# User & Auth
# ─────────────────────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, index=True, nullable=False)
    hashed_password: Mapped[Optional[str]] = mapped_column(
        String(255), nullable=True)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    avatar_url: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True)
    role: Mapped[str] = mapped_column(
        String(20), default="user", nullable=False)  # "user" | "admin"
    google_id: Mapped[Optional[str]] = mapped_column(
        String(255), unique=True, nullable=True)
    is_active: Mapped[bool] = mapped_column(
        Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


# ─────────────────────────────────────────────────────────────────────────────
# Archived legacy simulation source records. These remain only because curated
# transcripts preserve foreign-key links to their reviewed source material.
# ─────────────────────────────────────────────────────────────────────────────

class ConversationSession(Base):
    """Archived source session; new simulations use ``SimulationRun``."""
    __tablename__ = "conversation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scenario_id: Mapped[str] = mapped_column(String(255), index=True)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)

    messages: Mapped[list[ConversationMessage]] = relationship(
        "ConversationMessage", back_populates="session", cascade="all, delete-orphan"
    )


class ConversationMessage(Base):
    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversation_sessions.id"), index=True
    )
    sender: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True, index=True)
    branch_id: Mapped[str] = mapped_column(String(64), nullable=False, default="main")
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped[ConversationSession] = relationship(
        "ConversationSession", back_populates="messages"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Curated scenarios and cooperative family sessions
# ─────────────────────────────────────────────────────────────────────────────

class CuratedTranscript(Base):
    """A reviewed example; the concern flag applies across all categories."""
    __tablename__ = "curated_transcripts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    source_session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversation_sessions.id"), nullable=False
    )
    is_concerning_example: Mapped[bool] = mapped_column(Boolean, nullable=False)
    difficulty: Mapped[str] = mapped_column(String(20), default="Medium")
    tactic_tags: Mapped[list[str]] = mapped_column(JSON, default=list)
    reviewed_by: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=False
    )
    reviewed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str] = mapped_column(String(50), default="grooming")
    render_skin: Mapped[str] = mapped_column(String(50), default="chat")
    source_scenario_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    public_metadata_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    messages: Mapped[list[CuratedMessage]] = relationship(
        "CuratedMessage", back_populates="transcript", cascade="all, delete-orphan"
    )
    red_flag_spans: Mapped[list[RedFlagSpan]] = relationship(
        "RedFlagSpan", back_populates="transcript", cascade="all, delete-orphan"
    )


class CuratedMessage(Base):
    __tablename__ = "curated_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("curated_transcripts.id"), index=True, nullable=False
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker_label: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    pace: Mapped[str] = mapped_column(String(20), default="normal")
    is_checkpoint: Mapped[bool] = mapped_column(Boolean, default=False)
    checkpoint_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    transcript: Mapped[CuratedTranscript] = relationship(
        "CuratedTranscript", back_populates="messages"
    )


class RedFlagSpan(Base):
    """Reviewer-confirmed or automatic red-flag annotations for curated content."""
    __tablename__ = "red_flag_spans"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("curated_transcripts.id"), index=True, nullable=False
    )
    message_sequence: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    start_offset: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    end_offset: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    tactic_tag: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(20), default="auto", nullable=False)

    transcript: Mapped[CuratedTranscript] = relationship(
        "CuratedTranscript", back_populates="red_flag_spans"
    )


class FamilySession(Base):
    """A cooperative session. It intentionally stores no child-performance score."""
    __tablename__ = "family_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("curated_transcripts.id"), nullable=False
    )
    child_user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True, nullable=False
    )
    parent_user_id: Mapped[Optional[int]] = mapped_column(
        Integer, ForeignKey("users.id"), nullable=True
    )
    companion_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    detective_mode: Mapped[bool] = mapped_column(Boolean, default=False)
    # Internal safety signal only. Never expose this through player or parent schemas.
    disclosure_flagged: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    revealed_up_to: Mapped[int] = mapped_column(Integer, default=0)
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class CheckpointResponse(Base):
    """A discussion response, not a graded answer."""
    __tablename__ = "checkpoint_responses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("family_sessions.id"), index=True, nullable=False
    )
    checkpoint_message_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("curated_messages.id"), nullable=False
    )
    responder_role: Mapped[str] = mapped_column(String(20), nullable=False)
    response_text: Mapped[str] = mapped_column(Text, nullable=False)
    flagged_message_ids: Mapped[list[int]] = mapped_column(JSON, default=list)
    tactic_tag_guess: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class ConversationGuide(Base):
    """Parent discussion aid. Do not add child scoring or grading fields here."""
    __tablename__ = "conversation_guides"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("family_sessions.id"), index=True, nullable=False
    )
    scenario_summary: Mapped[str] = mapped_column(Text, nullable=False)
    child_reasoning_excerpt: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    discussion_prompts: Mapped[list[str]] = mapped_column(JSON, default=list)
    completed_together: Mapped[bool] = mapped_column(Boolean, default=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


class CompanionExchange(Base):
    """Private, sanitised companion reasoning exchange for guide-building only."""
    __tablename__ = "companion_exchanges"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("family_sessions.id"), index=True, nullable=False
    )
    exchange_type: Mapped[str] = mapped_column(String(30), nullable=False)
    child_text: Mapped[str] = mapped_column(Text, nullable=False)
    companion_text: Mapped[str] = mapped_column(Text, nullable=False)
    disclosure_triggered: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )


# ─────────────────────────────────────────────────────────────────────────────
# Durable simulation runtime support (introduced additively in Phase 1)
# ─────────────────────────────────────────────────────────────────────────────

class SimulationRun(Base):
    __tablename__ = "simulation_runs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    mode: Mapped[str] = mapped_column(String(30), nullable=False)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="queued")
    creator_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    scenario_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    config_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    progress: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    stop_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    resource_usage: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    worker_lease: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class SimulationMessage(Base):
    __tablename__ = "simulation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("simulation_runs.id"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    branch_id: Mapped[str] = mapped_column(String(64), nullable=False, default="main")
    sender: Mapped[str] = mapped_column(String(50), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SimulationEvent(Base):
    __tablename__ = "simulation_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    run_id: Mapped[int] = mapped_column(Integer, ForeignKey("simulation_runs.id"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(80), nullable=False)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class SimulationMessageRevision(Base):
    __tablename__ = "simulation_message_revisions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    message_id: Mapped[int] = mapped_column(Integer, ForeignKey("simulation_messages.id"), nullable=False, index=True)
    revision_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    supersedes_revision_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("simulation_message_revisions.id"), nullable=True)
    editor_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


# ─────────────────────────────────────────────────────────────────────────────
# Content tables (replaces JSON config files)
# ─────────────────────────────────────────────────────────────────────────────

class ContentScenario(Base):
    __tablename__ = "content_scenarios"
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ContentPersona(Base):
    __tablename__ = "content_personas"
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ContentStage(Base):
    __tablename__ = "content_stages"
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ContentObjective(Base):
    __tablename__ = "content_objectives"
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ContentConstraint(Base):
    __tablename__ = "content_constraints"
    id: Mapped[str] = mapped_column(String(255), primary_key=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


class ContentPrompt(Base):
    __tablename__ = "content_prompts"
    name: Mapped[str] = mapped_column(String(255), primary_key=True)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    variables: Mapped[list[str]] = mapped_column(JSON, default=list)
    description: Mapped[str] = mapped_column(Text, default="")
    kind: Mapped[str] = mapped_column(String(30), nullable=False, default="dialogue")
    role_scope: Mapped[str] = mapped_column(String(30), nullable=False, default="either")
    version: Mapped[str] = mapped_column(String(30), nullable=False, default="1.0.0")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )





