"""
Pydantic models for all JSON content types.
These mirror the JSON schema of config files and are used for validation on load and API serialization.
"""

from __future__ import annotations

from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enumerations
# ---------------------------------------------------------------------------

class CompletionRuleType(str, Enum):
    LLM = "llm"
    KEYWORD = "keyword"
    ALWAYS = "always"


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


# ---------------------------------------------------------------------------
# Objective
# ---------------------------------------------------------------------------

class CompletionRule(BaseModel):
    type: CompletionRuleType
    keywords: list[str] | None = None


class ObjectiveDefinition(BaseModel):
    id: str
    display_name: str
    description: str
    priority: int = 5
    tags: list[str] = Field(default_factory=list)
    completion_rule: CompletionRule = Field(
        default_factory=lambda: CompletionRule(type=CompletionRuleType.LLM)
    )


# ---------------------------------------------------------------------------
# Persona
# ---------------------------------------------------------------------------

class SpeakingStyle(BaseModel):
    emoji: bool = False
    slang: bool = False
    vocabulary_level: str = "casual"
    sentence_length: str = "short"


class PersonaDefinition(BaseModel):
    id: str
    display_name: str
    description: str
    tone: list[str] = Field(default_factory=list)
    interests: list[str] = Field(default_factory=list)
    speaking_style: SpeakingStyle = Field(default_factory=SpeakingStyle)
    background: str = ""
    manipulation_style: str = ""
    escalation_speed: str = "slow"


# ---------------------------------------------------------------------------
# Constraint
# ---------------------------------------------------------------------------

class ConstraintDefinition(BaseModel):
    id: str
    description: str
    forbidden_actions: list[str] = Field(default_factory=list)
    forbidden_phrases: list[str] = Field(default_factory=list)
    violation_severity: ViolationSeverity = ViolationSeverity.MEDIUM


# ---------------------------------------------------------------------------
# Scenario
# ---------------------------------------------------------------------------

class DifficultyModifier(BaseModel):
    trust_delta_multiplier: float = 1.0
    escalation_speed: str = "slow"
    red_flag_visibility: str = "medium"


class StageStep(BaseModel):
    stage: str
    objectives: list[str] = Field(default_factory=list)
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
