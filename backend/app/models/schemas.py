"""
API request/response schemas and the structured LLM output schema.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


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
