"""
API request/response schemas and the structured LLM output schema.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Scenario foundations
# ---------------------------------------------------------------------------

class Difficulty(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class ScenarioCategory(str, Enum):
    GROOMING = "grooming"
    CYBERBULLYING = "cyberbullying"
    SCAM = "scam"
    IMAGE_REQUEST = "image_request"
    OVERSHARING = "oversharing"


class RenderSkin(str, Enum):
    CHAT = "chat"
    EMAIL = "email"
    SOCIAL_FEED = "social_feed"


class GenerationMode(str, Enum):
    DUAL_AGENT = "dual_agent"
    SINGLE_PASS = "single_pass"


class ParticipantRole(str, Enum):
    CHILD = "child"
    PARENT = "parent"
    AI_COMPANION = "ai_companion"


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
    """Scenario configuration shared by content authoring and generation."""

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
    category: ScenarioCategory = ScenarioCategory.GROOMING
    render_skin: RenderSkin = RenderSkin.CHAT
    generation_mode: GenerationMode = GenerationMode.DUAL_AGENT


# ---------------------------------------------------------------------------
# LLM Output Schema
# ---------------------------------------------------------------------------

class LLMOutputSchema(BaseModel):
    """Exact structure that the LLM must return."""
    reply: str
    current_stage: str
    next_stage: str
    current_objective: str
    objective_completed: bool
    trust_delta: float = Field(default=0.0, ge=-0.3, le=0.3)
    suspicion_delta: float = Field(default=0.0, ge=-0.3, le=0.3)
    flags: list[str] = Field(default_factory=list)
    reasoning: str = ""
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Simulator API
# ---------------------------------------------------------------------------

class SimulatorStartRequest(BaseModel):
    scenario_id: str
    difficulty: str = "Medium"


class SimulatorStartResponse(BaseModel):
    session_id: int
    scenario_id: str
    initial_message: str
    state: dict[str, Any]


class SimulatorChatRequest(BaseModel):
    session_id: int
    message: str


class SimulatorChatResponse(BaseModel):
    reply: str
    current_stage: str
    next_stage: str
    current_objective: str
    objective_completed: bool
    trust: float
    suspicion: float
    flags: list[str]
    reasoning: str
    confidence: float
    built_prompt: str | None = None  # Only populated in debug mode


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidationError(BaseModel):
    severity: str  # "error" | "warning" | "info"
    code: str
    message: str
    location: str  # e.g. "scenarios/helpful_stranger.json > stage_sequence[0]"
    suggestion: str | None = None


class ValidationReport(BaseModel):
    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationError] = Field(default_factory=list)
    info: list[ValidationError] = Field(default_factory=list)
    total_scenarios: int = 0
    total_personas: int = 0
    total_stages: int = 0
    total_objectives: int = 0
    total_constraints: int = 0


# ---------------------------------------------------------------------------
# Legacy compat (kept to avoid breaking existing code)
# ---------------------------------------------------------------------------

class ChatRequest(BaseModel):
    session_id: int
    message: str


class ChatResponse(BaseModel):
    reply: str
    current_stage: str
    flags: list[str]


class ScenarioStartRequest(BaseModel):
    scenario_id: str
    difficulty: str = "Medium"


class ScenarioStartResponse(BaseModel):
    session_id: int
    initial_message: str | None = None


# ---------------------------------------------------------------------------
# Family scenario player API (no scoring fields by design)
# ---------------------------------------------------------------------------

class PublishedScenarioOut(BaseModel):
    id: int
    category: ScenarioCategory
    render_skin: RenderSkin
    difficulty: str
    message_count: int


class CreateFamilySessionRequest(BaseModel):
    parent_user_id: int | None = None
    detective_mode: bool = False


class FamilySessionOut(BaseModel):
    id: int
    transcript_id: int
    parent_user_id: int | None
    companion_mode: bool
    detective_mode: bool
    started_at: str
    completed_at: str | None


class FamilyMessageOut(BaseModel):
    id: int
    sequence: int
    speaker_label: str
    content: str
    pace: str
    is_checkpoint: bool
    checkpoint_prompt: str | None


class CheckpointResponseRequest(BaseModel):
    checkpoint_message_id: int
    responder_role: ParticipantRole
    response_text: str = Field(min_length=1, max_length=10_000)
    flagged_message_ids: list[int] = Field(default_factory=list)
    tactic_tag_guess: str | None = Field(default=None, max_length=100)


class CheckpointResponseOut(BaseModel):
    id: int
    checkpoint_message_id: int
    responder_role: ParticipantRole
    response_text: str
    flagged_message_ids: list[int]
    tactic_tag_guess: str | None
    created_at: str


class ConversationGuideOut(BaseModel):
    id: int
    family_session_id: int
    scenario_summary: str
    child_reasoning_excerpt: dict[str, Any]
    discussion_prompts: list[str]
    completed_together: bool
    generated_at: str


# ---------------------------------------------------------------------------
# Companion AI (separate from content-generation personas)
# ---------------------------------------------------------------------------
class SupportResourceOut(BaseModel):
    label: str
    href: str

class CompanionCheckpointRequest(BaseModel):
    checkpoint_message_id: int
    child_response_text: str = Field(min_length=1, max_length=10_000)
    flagged_message_ids: list[int] = Field(default_factory=list)
    tactic_tag_guess: str | None = Field(default=None, max_length=100)

class CompanionCheckpointOut(BaseModel):
    response_text: str
    child_response: CheckpointResponseOut
    checkpoint_response: CheckpointResponseOut
    disclosure_triggered: bool
    support_resources: list[SupportResourceOut] = Field(default_factory=list)

class CompanionExplainRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)

class CompanionExplainOut(BaseModel):
    response_text: str
    disclosure_triggered: bool
    support_resources: list[SupportResourceOut] = Field(default_factory=list)
