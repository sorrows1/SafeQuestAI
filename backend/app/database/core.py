import os
from sqlalchemy import create_engine,  String, DateTime, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Mapped, mapped_column
from datetime import datetime, timezone
from typing import Optional, Any

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql+psycopg://user:password@db:5432/safe_quest")
engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class Session(Base):
    __tablename__ = "sessions"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    scenario_id: Mapped[str] = mapped_column(String(255), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    state: Mapped[dict[str, Any]] = mapped_column(JSON)

class Message(Base):
    __tablename__ = "messages"
    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    session_id: Mapped[int] = mapped_column(index=True)
    sender: Mapped[str] = mapped_column(String(50))
    content: Mapped[str] = mapped_column(String(5000))
    metadata_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    
    timestamp: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), 
        default=lambda: datetime.now(timezone.utc)
    )

Base.metadata.create_all(bind=engine)