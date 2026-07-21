"""
ConversationState — the runtime state of a single conversation session.

Stored as a JSON column in the ConversationSession DB row.
Fully serializable and deserializable via Pydantic.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field


class HistoryEntry(BaseModel):
    """Single turn in the conversation history."""
    sender: str  # "user" | "assistant"
    content: str
    timestamp: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    metadata: dict[str, Any] = Field(default_factory=dict)


class ConversationState(BaseModel):
    """
    Full runtime state for a single play-through.
    This is what gets persisted to the DB state column and what the
    DialoguePolicyEngine reads to make decisions.
    """
    session_id: int
    scenario_id: str
    difficulty: str = "Medium"

    # Stage tracking
    current_stage: str = ""
    stage_sequence_index: int = 0  # index into scenario.stage_sequence

    # Objective tracking
    current_objective: str = ""
    objective_index: int = 0  # index within the current stage's objectives list
    completed_objectives: list[str] = Field(default_factory=list)

    # Emotional metrics — float 0.0 to 1.0
    trust: float = 0.0
    suspicion: float = 0.0

    # Conversation history (full turns)
    history: list[HistoryEntry] = Field(default_factory=list)

    # Flags raised during the conversation
    flags: list[str] = Field(default_factory=list)

    # Arbitrary extra metadata (e.g. discovered name, age, etc.)
    metadata: dict[str, Any] = Field(default_factory=dict)

    # Timestamps
    started_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )
    updated_at: str = Field(
        default_factory=lambda: datetime.now(timezone.utc).isoformat()
    )

    def add_message(self, sender: str, content: str, metadata: dict[str, Any] | None = None) -> None:
        """Append a new turn to the history."""
        self.history.append(
            HistoryEntry(sender=sender, content=content, metadata=metadata or {})
        )
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def mark_objective_complete(self, objective_id: str) -> None:
        """Mark an objective as done if not already completed."""
        if objective_id not in self.completed_objectives:
            self.completed_objectives.append(objective_id)

    def clamp_metrics(self) -> None:
        """Clamp trust and suspicion to [0.0, 1.0]."""
        self.trust = max(0.0, min(1.0, self.trust))
        self.suspicion = max(0.0, min(1.0, self.suspicion))

    def to_db_dict(self) -> dict[str, Any]:
        """Serialize state for storage in the DB JSON column."""
        return self.model_dump()

    @classmethod
    def from_db_dict(cls, data: dict[str, Any]) -> "ConversationState":
        """Deserialize state from the DB JSON column."""
        return cls.model_validate(data)
