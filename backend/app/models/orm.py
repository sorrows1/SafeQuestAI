"""
SQLAlchemy ORM models for Safe Quest.

Tables:
  Runtime:
    users, conversations, user_messages, conversation_sessions, conversation_messages
  Content (replaces JSON files after migration):
    content_scenarios, content_personas, content_stages,
    content_objectives, content_constraints, content_prompts
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

import logging
from sqlalchemy import (
    String, DateTime, JSON, Integer, ForeignKey, Text,
    Boolean, create_engine,
)
from sqlalchemy.engine import make_url
from sqlalchemy.orm import (
    declarative_base, sessionmaker, Mapped,
    mapped_column, relationship,
)
from dotenv import load_dotenv
from pathlib import Path

logger = logging.getLogger(__name__)

env_path = Path(__file__).parent.parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg://user:password@db:5432/SQ_DB"
)

def ensure_database_exists(db_url: str) -> bool:
    """Check if target database exists in Postgres; if not, connect to default db and create it. Returns True if created."""
    try:
        url = make_url(db_url)
        if not url.drivername.startswith("postgresql"):
            return False

        db_name = url.database
        if not db_name or db_name in ("postgres", "template0", "template1"):
            return False

        default_url = url._replace(database="postgres")
        default_engine = create_engine(default_url, isolation_level="AUTOCOMMIT")

        created = False
        with default_engine.connect() as conn:
            result = conn.execute(
                text("SELECT 1 FROM pg_database WHERE datname = :dbname"),
                {"dbname": db_name},
            )
            if not result.scalar():
                logger.info("Database '%s' does not exist. Auto-creating database...", db_name)
                conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                logger.info("Database '%s' created successfully.", db_name)
                created = True

        default_engine.dispose()
        return created
    except Exception as exc:
        logger.warning("Auto database creation check encountered an issue: %s", exc)
        return False

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

    conversations: Mapped[list[Conversation]] = relationship(
        "Conversation", back_populates="user", cascade="all, delete-orphan"
    )


# ─────────────────────────────────────────────────────────────────────────────
# Public Conversations (messaging layer)
# ─────────────────────────────────────────────────────────────────────────────

class Conversation(Base):
    """A user's conversation thread — maps to a hidden scenario internally."""
    __tablename__ = "conversations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("users.id"), index=True)
    scenario_id: Mapped[str] = mapped_column(
        String(255), index=True)  # hidden from public API
    contact_name: Mapped[str] = mapped_column(
        String(100), nullable=False)    # e.g. "Alex"
    contact_avatar: Mapped[Optional[str]] = mapped_column(
        String(512), nullable=True)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")
    status: Mapped[str] = mapped_column(
        String(20), default="active")  # active|archived|deleted
    engine_state: Mapped[dict[str, Any]] = mapped_column(
        JSON, default=dict)  # dialogue engine state
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
    last_message_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    user: Mapped[User] = relationship("User", back_populates="conversations")
    messages: Mapped[list[UserMessage]] = relationship(
        "UserMessage", back_populates="conversation", cascade="all, delete-orphan"
    )


class UserMessage(Base):
    """A single message in a user conversation."""
    __tablename__ = "user_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    conversation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversations.id"), index=True
    )
    sender: Mapped[str] = mapped_column(
        String(20), nullable=False)  # "user" | "contact"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    metadata_json: Mapped[Optional[dict[str, Any]]
                          ] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)

    conversation: Mapped[Conversation] = relationship(
        "Conversation", back_populates="messages")


# ─────────────────────────────────────────────────────────────────────────────
# Admin simulator sessions (kept for admin use)
# ─────────────────────────────────────────────────────────────────────────────

class ConversationSession(Base):
    """Admin simulator session — not exposed to public users."""
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
    metadata_json: Mapped[Optional[dict[str, Any]]
                          ] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )

    session: Mapped[ConversationSession] = relationship(
        "ConversationSession", back_populates="messages"
    )


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
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )


def create_tables() -> None:
    """Ensure database exists and create all tables. Called on application startup."""
    created = ensure_database_exists(DATABASE_URL)
    Base.metadata.create_all(bind=engine)






