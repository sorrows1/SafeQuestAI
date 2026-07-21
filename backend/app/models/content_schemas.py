"""
Pydantic models for all JSON content types.
These mirror the JSON schema of config files and are used for validation on load and API serialization.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------


class ViolationSeverity(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class Difficulty(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


# ---------------------------------------------------------------------------
# Stage
# ---------------------------------------------------------------------------

class StageDefinition(BaseModel):
    id: str
    display_name: str
    description: str
    allowed_next: list[str] = Field(default_factory=list)
    default_constraints: list[str] = Field(default_factory=list)
    # Pacing controls — engine enforces these; LLM does not see them
    min_turns: int = 1
    max_turns: int = 30
    # Optional guidance injected into the current-stage prompt block
    preferred_style: str = ""   # e.g. "casual small talk", "gentle probing"


# ---------------------------------------------------------------------------
# Objective — modelled as a hidden intent, not an explicit task
# ---------------------------------------------------------------------------

class ObjectiveDefinition(BaseModel):
    id: str
    display_name: str
    # hidden_intent is what the LLM sees — framed as a background desire, not a task
    hidden_intent: str = ""
    # natural_triggers: conversational cues that make pursuing this feel organic
    natural_triggers: list[str] = Field(default_factory=list)
    # priority 0.0–1.0: base bias toward this intent per turn
    priority: float = 0.5
    # patience: turns to wait before urgency starts increasing automatically
    patience: int = 5
    # success_signals: machine-readable strings checked by the engine after each turn
    success_signals: list[str] = Field(default_factory=list)
    # Legacy / admin display only — kept for the admin UI, NOT injected into the LLM prompt
    description: str = ""


# ---------------------------------------------------------------------------
# Persona — split into cover story and behavioural guidance
# ---------------------------------------------------------------------------

class ConversationStyle(BaseModel):
    """
    Behavioural fingerprint for the persona.
    Controls HOW the LLM writes, not WHAT it says.
    Injected as structured JSON so the model interprets it consistently,
    rather than inferring style from vague prose like 'tone: friendly'.
    """
    uses_lowercase: bool = True
    omits_end_punctuation: bool = True          # skips periods at sentence end
    emoji_frequency: float = 0.0                # 0.0 = never, 1.0 = every message
    average_message_length: Literal["very_short", "short", "medium", "long"] = "short"
    double_texts: bool = False                  # occasionally sends two messages in a row
    initiates_topic_changes: bool = False       # False = waits for user to lead topic
    uses_slang: bool = True
    humour: Literal["dry", "playful", "sarcastic", "none"] = "playful"
    # reactive = mostly responds; proactive = often introduces new topics
    response_style: Literal["reactive", "proactive"] = "reactive"


class PersonaDefinition(BaseModel):
    id: str
    display_name: str

    # ── Cover story (world knowledge) ────────────────────────────────────────
    # Facts the persona CAN state IF directly asked.
    # Labelled "hidden world knowledge" in the prompt — must NEVER be volunteered.
    claimed_age: int = 15
    claimed_location: str = ""
    claimed_interests: list[str] = Field(default_factory=list)
    cover_story: str = ""   # e.g. "Claims to be 14, loves gaming, goes to school in London"

    # ── Manipulation profile ─────────────────────────────────────────────────
    manipulation_style: str = ""    # e.g. "flattery_and_common_ground"
    escalation_speed: Literal["slow", "medium", "fast"] = "slow"

    # ── Conversation style ───────────────────────────────────────────────────
    conversation_style: ConversationStyle = Field(default_factory=ConversationStyle)

    # ── Legacy / admin display only ──────────────────────────────────────────
    # Kept for backward compatibility and the admin UI. NOT injected into the LLM prompt.
    description: str = ""
    background: str = ""
    tone: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Constraint
# ---------------------------------------------------------------------------

class ConstraintDefinition(BaseModel):
    id: str
    description: str
    forbidden_actions: list[str] = Field(default_factory=list)
    forbidden_phrases: list[str] = Field(default_factory=list)
    forbidden_topics: list[str] = Field(default_factory=list)
    required_behaviours: list[str] = Field(default_factory=list)
    violation_severity: ViolationSeverity = ViolationSeverity.MEDIUM
    # Hint to the LLM for how to recover if it is approaching a boundary
    recovery_suggestion: str = ""


# ---------------------------------------------------------------------------
# Scenario
# ---------------------------------------------------------------------------

class DifficultyModifier(BaseModel):
    trust_delta_multiplier: float = 1.0
    escalation_speed: str = "slow"
    red_flag_visibility: str = "medium"


class StageStep(BaseModel):
    stage: str
    mandatory_objectives: list[str] = Field(default_factory=list)
    optional_objectives: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)


class ScenarioDefinition(BaseModel):
    id: str
    display_name: str
    description: str
    difficulty: Difficulty = Difficulty.MEDIUM
    persona: str
    starting_stage: str
    prompt_template: str = "default_dialogue"
    version: str = "1.0.0"
    created_at: str | None = None
    tags: list[str] = Field(default_factory=list)
    learning_objectives: list[str] = Field(default_factory=list)
    stage_sequence: list[StageStep] = Field(default_factory=list)
    difficulty_modifiers: dict[str, DifficultyModifier] = Field(default_factory=dict)


# ---------------------------------------------------------------------------
# Prompt Template
# ---------------------------------------------------------------------------

class PromptTemplate(BaseModel):
    name: str
    content: str
    variables: list[str] = Field(default_factory=list)
    description: str = ""

