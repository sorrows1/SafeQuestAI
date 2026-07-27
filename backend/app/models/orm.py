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
    Boolean, UniqueConstraint, CheckConstraint, Index, text, create_engine,
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
    # Optional coarse band only; exact birth dates are never collected or retained.
    age_band: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    age_adaptation_consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    caregiver_consent_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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
    scene_elements: Mapped[list[CuratedSceneElement]] = relationship(
        "CuratedSceneElement", back_populates="transcript", cascade="all, delete-orphan"
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


class CuratedSceneElement(Base):
    """Skin-neutral, selectable content authored alongside curated messages."""
    __tablename__ = "curated_scene_elements"
    __table_args__ = (UniqueConstraint("transcript_id", "element_key", name="uq_scene_element_transcript_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    transcript_id: Mapped[int] = mapped_column(Integer, ForeignKey("curated_transcripts.id"), index=True, nullable=False)
    element_key: Mapped[str] = mapped_column(String(255), nullable=False)
    element_type: Mapped[str] = mapped_column(String(40), nullable=False)
    parent_element_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    source_message_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("curated_messages.id"), nullable=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    actor_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    timestamp_semantics: Mapped[str] = mapped_column(String(20), default="none", nullable=False)
    timestamp: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    relationships: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list, nullable=False)
    presentation: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    selectable: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    accessible_label: Mapped[str] = mapped_column(String(500), nullable=False)
    semantic_role: Mapped[str] = mapped_column(String(100), nullable=False)

    transcript: Mapped[CuratedTranscript] = relationship("CuratedTranscript", back_populates="scene_elements")


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
    scene_element_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("curated_scene_elements.id"), nullable=True, index=True)
    child_safe_explanation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tiered_hints: Mapped[list[str]] = mapped_column(JSON, default=list)
    repeat_justification: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    transcript: Mapped[CuratedTranscript] = relationship(
        "CuratedTranscript", back_populates="red_flag_spans"
    )


class FamilySession(Base):
    """A cooperative session. It intentionally stores no child-performance score."""
    __tablename__ = "family_sessions"
    __table_args__ = (
        Index(
            "uq_family_sessions_active_learner_transcript",
            "child_user_id",
            "transcript_id",
            unique=True,
            sqlite_where=text("state NOT IN ('completed', 'abandoned', 'expired')"),
            postgresql_where=text("state NOT IN ('completed', 'abandoned', 'expired')"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # Public references are deliberately opaque; numeric IDs remain internal.
    public_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)
    owner_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
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
    # Scene sequences begin at zero, while -1 means that the opening beat has
    # not yet been revealed.
    revealed_up_to: Mapped[int] = mapped_column(Integer, default=-1)
    state: Mapped[str] = mapped_column(String(40), default="in_progress", nullable=False)
    state_version: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    active_checkpoint_element_key: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    participation_turn_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    # Per-session sequence source for persisted, reconnectable family events.
    event_sequence: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    # Acknowledging the completion review is distinct from reaching the end.
    completion_acknowledged_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    completion_acknowledged_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    attempt_number: Mapped[int] = mapped_column(Integer, default=1, nullable=False)
    previous_session_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    completed_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class FamilySessionCommand(Base):
    """Durable idempotency ledger for family-session state transitions."""
    __tablename__ = "family_session_commands"
    __table_args__ = (UniqueConstraint("family_session_id", "client_command_id", name="uq_family_session_command_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False, index=True)
    client_command_id: Mapped[str] = mapped_column(String(128), nullable=False)
    command: Mapped[str] = mapped_column(String(50), nullable=False)
    expected_state_version: Mapped[int] = mapped_column(Integer, nullable=False)
    resulting_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class FamilyRelationshipInvitation(Base):
    __tablename__ = "family_relationship_invitations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)
    caregiver_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    learner_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    short_code_hash: Mapped[Optional[str]] = mapped_column(String(255), unique=True, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default="pending", nullable=False)
    delivery_label: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    failed_lookup_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    accept_attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    last_attempt_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accepted_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class FamilyRelationship(Base):
    __tablename__ = "family_relationships"
    __table_args__ = (
        UniqueConstraint("user_low_id", "user_high_id", name="uq_family_relationship_unordered_pair"),
        CheckConstraint("user_low_id < user_high_id", name="ck_family_relationship_distinct_users"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[Optional[str]] = mapped_column(String(64), unique=True, nullable=True, index=True)
    caregiver_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    learner_user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    user_low_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    user_high_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    invitation_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_relationship_invitations.id"), nullable=True)
    source: Mapped[str] = mapped_column(String(40), default="invitation", nullable=False)
    accepted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active", nullable=False)
    blocked_by_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class FamilySessionParticipant(Base):
    __tablename__ = "family_session_participants"
    __table_args__ = (UniqueConstraint("family_session_id", "user_id", name="uq_family_session_participant"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False, index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    last_seen_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    left_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    presence_status: Mapped[str] = mapped_column(String(20), default="offline", nullable=False)
    last_heartbeat_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    presence_expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class FamilySessionEvent(Base):
    """Append-only, participant-safe event log used for family SSE recovery.

    Event payloads contain only shared state and server-authored text. Private
    companion exchanges and disclosure signals must never be copied here.
    """
    __tablename__ = "family_session_events"
    __table_args__ = (
        UniqueConstraint("family_session_id", "sequence", name="uq_family_session_event_sequence"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False, index=True)
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    actor_participant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_session_participants.id"), nullable=True, index=True)
    payload: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    is_ephemeral: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class FamilyCaregiverComment(Base):
    """A shared caregiver note anchored to a scene element or validated finding."""
    __tablename__ = "family_caregiver_comments"
    __table_args__ = (
        UniqueConstraint("family_session_id", "client_command_id", name="uq_family_caregiver_comment_command"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    public_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False, index=True)
    author_participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_session_participants.id"), nullable=False, index=True)
    scene_element_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("curated_scene_elements.id"), nullable=True, index=True)
    validated_finding_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("validated_findings.id"), nullable=True, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    child_visible_label: Mapped[str] = mapped_column(String(80), default="Caregiver note", nullable=False)
    client_command_id: Mapped[str] = mapped_column(String(128), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    deleted_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)


class FamilyCaregiverCommentAudit(Base):
    """Append-only audit trail for a caregiver comment; never exposed to players."""
    __tablename__ = "family_caregiver_comment_audits"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    comment_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_caregiver_comments.id"), nullable=False, index=True)
    actor_participant_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_session_participants.id"), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(20), nullable=False)
    text_snapshot: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)


class FamilyRelationshipAuditEvent(Base):
    """Security audit trail; payloads never contain invitation secrets."""
    __tablename__ = "family_relationship_audit_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    relationship_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_relationships.id"), nullable=True, index=True)
    invitation_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_relationship_invitations.id"), nullable=True, index=True)
    actor_user_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id"), nullable=True, index=True)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    metadata_json: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), nullable=False)

class SessionProgress(Base):
    __tablename__ = "session_progress"

    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), primary_key=True)
    reviewed_element_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    validated_finding_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    eligible_target_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    required_finding_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    checkpoint_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    content_progress: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    completion_ready: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))


class FlagAttempt(Base):
    __tablename__ = "flag_attempts"
    __table_args__ = (UniqueConstraint("family_session_id", "client_command_id", name="uq_flag_attempt_command_id"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False, index=True)
    participant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_session_participants.id"), nullable=True, index=True)
    element_id: Mapped[int] = mapped_column(Integer, ForeignKey("curated_scene_elements.id"), nullable=False, index=True)
    sanitized_reasoning: Mapped[str] = mapped_column(Text, nullable=False)
    claimed_red_flag: Mapped[bool] = mapped_column(Boolean, nullable=False)
    claim: Mapped[str] = mapped_column(String(20), default="red_flag", nullable=False)
    client_command_id: Mapped[str] = mapped_column(String(128), nullable=False, default="")
    validation_result: Mapped[str] = mapped_column(String(30), default="pending", nullable=False)
    feedback_snapshot: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    disclosure_state: Mapped[str] = mapped_column(String(30), default="none", nullable=False)
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


class ValidatedFinding(Base):
    __tablename__ = "validated_findings"
    __table_args__ = (UniqueConstraint("family_session_id", "element_id", "red_flag_span_id", name="uq_validated_finding_annotation"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    family_session_id: Mapped[int] = mapped_column(Integer, ForeignKey("family_sessions.id"), nullable=False, index=True)
    participant_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("family_session_participants.id"), nullable=True, index=True)
    element_id: Mapped[int] = mapped_column(Integer, ForeignKey("curated_scene_elements.id"), nullable=False, index=True)
    red_flag_span_id: Mapped[int] = mapped_column(Integer, ForeignKey("red_flag_spans.id"), nullable=False, index=True)
    visibility: Mapped[str] = mapped_column(String(20), default="shared", nullable=False)
    discovered_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))


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
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    client_command_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True, index=True)
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
    visibility: Mapped[str] = mapped_column(String(20), default="private", nullable=False)
    shared_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
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





