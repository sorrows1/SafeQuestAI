"""
SQLAlchemy ORM models for runtime PostgreSQL data.
Scenario content definitions are stored as JSON files — not in the DB.
Only runtime data (sessions, messages) lives here.
"""

from __future__ import annotations

import os
from datetime import datetime, timezone
from typing import Any, Optional

from sqlalchemy import String, DateTime, JSON, Integer, ForeignKey, Text
from sqlalchemy.orm import declarative_base, sessionmaker, Mapped, mapped_column, relationship
from sqlalchemy import create_engine

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


# ---------------------------------------------------------------------------
# ConversationSession — replaces the old Session model
# ---------------------------------------------------------------------------

class ConversationSession(Base):
    """
    Stores runtime state for a single play-through of a scenario.
    State JSON column mirrors the ConversationState dataclass from the engine.
    """
    __tablename__ = "conversation_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    scenario_id: Mapped[str] = mapped_column(String(255), index=True)
    difficulty: Mapped[str] = mapped_column(String(50), default="Medium")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
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


# ---------------------------------------------------------------------------
# ConversationMessage
# ---------------------------------------------------------------------------

class ConversationMessage(Base):
    """Single turn in a conversation — either user or assistant."""
    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("conversation_sessions.id"), index=True
    )
    sender: Mapped[str] = mapped_column(String(50))  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text)
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )

    session: Mapped[ConversationSession] = relationship(
        "ConversationSession", back_populates="messages"
    )


# ---------------------------------------------------------------------------
# Legacy models kept for backwards compatibility
# ---------------------------------------------------------------------------

class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scenario_id: Mapped[str] = mapped_column(String(255), index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(timezone.utc)
    )
    state: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)


class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(index=True)
    sender: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(String(5000))
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
    )


def create_tables() -> None:
    """Create all tables. Called on application startup."""
    Base.metadata.create_all(bind=engine)
