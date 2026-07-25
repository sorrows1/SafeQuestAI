"""
DialoguePolicyEngine — pure business logic for determining what happens next.

IMPORTANT: This module makes NO LLM calls.
It reads the current ConversationState and scenario definitions to produce
a PolicyDecision — a data structure that tells the rest of the pipeline
exactly what to do.

Responsibilities:
  - Determine the active objective for the current stage.
  - Determine which stage constraints are currently active.
  - Determine valid next stages (for LLM to choose from).
  - Advance to the next objective or stage when an objective is marked complete.
  - Build structured JSON prompt blocks (NOT flat string variables).
  - Compute dynamic objective priority based on patience counter.
  - Track conversation topic for inertia injection.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field

from app.engine.conversation_state import ConversationState
from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import (
    ConstraintDefinition,
    ObjectiveDefinition,
    PersonaDefinition,
    ScenarioDefinition,
    StageDefinition,
    StageStep,
)

logger = logging.getLogger(__name__)

# Minimum messages kept in recent history sent to the LLM each turn
_HISTORY_WINDOW = 10


@dataclass
class PolicyDecision:
    """
    Output of the DialoguePolicyEngine.
    All fields are resolved from config — no LLM involvement.

    prompt_blocks is a list of (label, content) tuples assembled by PromptBuilder
    into the final layered prompt.
    """
    current_stage: StageDefinition
    current_stage_step: StageStep
    current_objective: ObjectiveDefinition
    active_constraints: list[ConstraintDefinition]
    valid_next_stages: list[str]
    effective_priority: float = 0.5   # dynamic priority after patience scaling
    # Structured JSON blocks injected per turn — replaces flat string variables
    prompt_blocks: dict[str, str] = field(default_factory=dict)


class DialoguePolicyEngine:
    """
    Pure business logic layer — determines what the conversation should do next.
    Stateless: all context comes from ConversationState + ScenarioLoader.
    """

    def __init__(self, loader: ScenarioLoader) -> None:
        self._loader = loader

    def decide(self, state: ConversationState) -> PolicyDecision:
        """
        Main entry point. Returns a PolicyDecision for the current state.
        Raises ValueError if scenario config is inconsistent.
        """
        scenario = self._loader.get_scenario(state.scenario_id)
        stage_step = self._get_current_stage_step(scenario, state)
        stage = self._loader.get_stage(stage_step.stage)
        objective = self._get_current_objective(stage_step, state)
        constraints = self._resolve_constraints(stage_step, stage)
        valid_next_stages = list(stage.allowed_next)

        # Compute dynamic priority — increases as patience counter grows
        effective_priority = self._compute_priority(objective, state)

        prompt_blocks = self._build_prompt_blocks(
            state, scenario, stage, stage_step, objective, constraints,
            valid_next_stages, effective_priority
        )

        return PolicyDecision(
            current_stage=stage,
            current_stage_step=stage_step,
            current_objective=objective,
            active_constraints=constraints,
            valid_next_stages=valid_next_stages,
            effective_priority=effective_priority,
            prompt_blocks=prompt_blocks,
        )

    def advance_state(self, state: ConversationState, objective_completed: bool, next_stage: str) -> None:
        """
        After the LLM responds, advance the state machine:
        - Mark objective complete if flagged.
        - Advance to next objective within the same stage.
        - Advance to next stage step if all objectives are done.
        - Update current_stage in state.
        - Increment turn counters.
        """
        scenario = self._loader.get_scenario(state.scenario_id)
        stage_step = self._get_current_stage_step(scenario, state)

        # Increment turn-in-stage counter
        state.turns_in_stage += 1

        if objective_completed and state.current_objective:
            state.mark_objective_complete(state.current_objective)
            state.objective_patience_counter = 0
            # Try to advance to next objective in this stage step
            all_objs = stage_step.mandatory_objectives + stage_step.optional_objectives
            remaining = [
                obj_id for obj_id in all_objs
                if obj_id not in state.completed_objectives
            ]
            if remaining:
                state.current_objective = remaining[0]
            else:
                # All objectives in this stage done — try next stage step
                next_index = state.stage_sequence_index + 1
                if next_index < len(scenario.stage_sequence):
                    state.stage_sequence_index = next_index
                    next_step = scenario.stage_sequence[next_index]
                    state.current_stage = next_step.stage
                    state.objective_index = 0
                    state.turns_in_stage = 0
                    state.objective_patience_counter = 0
                    all_next = next_step.mandatory_objectives + next_step.optional_objectives
                    if all_next:
                        state.current_objective = all_next[0]
        else:
            # Objective not completed — increment patience counter
            state.objective_patience_counter += 1

        # Allow LLM-suggested stage transitions within valid transitions
        current_stage = self._loader.get_stage(state.current_stage)
        if next_stage and next_stage != state.current_stage and next_stage in current_stage.allowed_next:
            # Check min_turns enforcement
            if state.turns_in_stage >= current_stage.min_turns:
                for idx, step in enumerate(scenario.stage_sequence):
                    if step.stage == next_stage:
                        state.stage_sequence_index = idx
                        state.current_stage = next_stage
                        state.turns_in_stage = 0
                        state.objective_patience_counter = 0
                        all_step_objs = step.mandatory_objectives + step.optional_objectives
                        non_completed = [o for o in all_step_objs if o not in state.completed_objectives]
                        state.current_objective = non_completed[0] if non_completed else ""
                        break

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_current_stage_step(self, scenario: ScenarioDefinition, state: ConversationState) -> StageStep:
        """Return the StageStep at the current index, with bounds checking."""
        seq = scenario.stage_sequence
        if not seq:
            raise ValueError(f"Scenario '{scenario.id}' has no stage_sequence defined.")
        idx = min(state.stage_sequence_index, len(seq) - 1)
        return seq[idx]

    def _get_current_objective(self, stage_step: StageStep, state: ConversationState) -> ObjectiveDefinition:
        """Return the first incomplete objective in this stage step."""
        for obj_id in stage_step.mandatory_objectives:
            if obj_id not in state.completed_objectives:
                state.current_objective = obj_id
                return self._loader.get_objective(obj_id)

        for obj_id in stage_step.optional_objectives:
            if obj_id not in state.completed_objectives:
                state.current_objective = obj_id
                return self._loader.get_objective(obj_id)

        # All objectives complete — return the last one as context
        all_objs = stage_step.mandatory_objectives + stage_step.optional_objectives
        if all_objs:
            return self._loader.get_objective(all_objs[-1])

        raise ValueError(f"Stage step for stage '{stage_step.stage}' has no objectives defined.")

    def _resolve_constraints(
        self, stage_step: StageStep, stage: StageDefinition
    ) -> list[ConstraintDefinition]:
        """Merge stage-step constraints with stage default constraints, deduplicated."""
        all_constraint_ids: list[str] = list(dict.fromkeys(
            stage_step.constraints + stage.default_constraints
        ))
        resolved: list[ConstraintDefinition] = []
        for c_id in all_constraint_ids:
            try:
                resolved.append(self._loader.get_constraint(c_id))
            except KeyError:
                logger.warning("Constraint '%s' not found — skipping.", c_id)
        return resolved

    def _compute_priority(self, objective: ObjectiveDefinition, state: ConversationState) -> float:
        """
        Compute effective priority for the current objective.
        Priority increases gradually as the patience counter grows,
        creating natural urgency without forcing immediate completion.
        """
        patience = max(objective.patience, 1)
        urgency_boost = min(state.objective_patience_counter / patience, 1.0) * 0.35
        return min(objective.priority + urgency_boost, 1.0)

    def _build_prompt_blocks(
        self,
        state: ConversationState,
        scenario: ScenarioDefinition,
        stage: StageDefinition,
        stage_step: StageStep,
        objective: ObjectiveDefinition,
        constraints: list[ConstraintDefinition],
        valid_next_stages: list[str],
        effective_priority: float,
    ) -> dict[str, str]:
        """
        Build structured JSON prompt blocks.

        Returns a dict with keys:
          - "persona"      → JSON block (changes per conversation)
          - "stage"        → JSON block (changes per stage transition)
          - "turn_state"   → JSON block (changes every turn)
          - "history"      → formatted recent messages (changes every turn)
        """
        try:
            persona = self._loader.get_persona(scenario.persona)
        except KeyError:
            logger.warning("Persona '%s' not found for scenario '%s'", scenario.persona, scenario.id)
            persona = None

        persona_block = self._build_persona_block(persona)
        stage_block = self._build_stage_block(stage, stage_step, scenario)
        turn_state_block = self._build_turn_state_block(
            state, objective, constraints, valid_next_stages, effective_priority
        )
        history_block = self._build_history_block(state, persona)

        return {
            "persona": persona_block,
            "stage": stage_block,
            "turn_state": turn_state_block,
            "history": history_block,
        }

    def _build_persona_block(self, persona: PersonaDefinition | None) -> str:
        """
        Persona block — injected once per conversation (cache-friendly).
        Separates hidden world knowledge from behavioural style.
        """
        if not persona:
            return json.dumps({"persona": {"name": "Unknown"}}, indent=2)

        style = persona.conversation_style
        data = {
            "persona": {
                "name": persona.display_name,
                "cover_story": persona.cover_story,
                "manipulation_style": persona.manipulation_style,
                "escalation_speed": persona.escalation_speed,
                # Hidden world knowledge — only reveal if DIRECTLY asked
                "world_knowledge": {
                    "_note": "These facts exist for consistency. NEVER volunteer them. Only state them if directly asked.",
                    "claimed_age": persona.claimed_age,
                    "claimed_location": persona.claimed_location,
                    "claimed_interests": persona.claimed_interests,
                },
                "conversation_style": {
                    "uses_lowercase": style.uses_lowercase,
                    "omits_end_punctuation": style.omits_end_punctuation,
                    "emoji_frequency": style.emoji_frequency,
                    "average_message_length": style.average_message_length,
                    "double_texts": style.double_texts,
                    "initiates_topic_changes": style.initiates_topic_changes,
                    "uses_slang": style.uses_slang,
                    "humour": style.humour,
                    "response_style": style.response_style,
                },
            }
        }
        return json.dumps(data, indent=2)

    def _build_stage_block(
        self, stage: StageDefinition, stage_step: StageStep, scenario: ScenarioDefinition
    ) -> str:
        """Stage block — injected on stage transitions (semi-cached)."""
        data = {
            "current_stage": {
                "id": stage.id,
                "display_name": stage.display_name,
                "description": stage.description,
                "preferred_style": stage.preferred_style,
                "valid_next_stages": list(stage.allowed_next),
            },
            "scenario": {
                "id": scenario.id,
                "display_name": scenario.display_name,
                "difficulty": scenario.difficulty,
                "category": scenario.category.value,
                "render_skin": scenario.render_skin.value,
                "generation_mode": scenario.generation_mode.value,
            }
        }
        return json.dumps(data, indent=2)

    def _build_turn_state_block(
        self,
        state: ConversationState,
        objective: ObjectiveDefinition,
        constraints: list[ConstraintDefinition],
        valid_next_stages: list[str],
        effective_priority: float,
    ) -> str:
        """
        Turn state block — changes every turn.
        This is the only block with high token churn.
        Kept minimal: persona state + conversation state + hidden intent.
        """
        # Determine urgency label from effective priority
        if effective_priority >= 0.85:
            urgency_label = "high — a natural opportunity has likely passed several times"
        elif effective_priority >= 0.6:
            urgency_label = "medium — pursue if a natural opportunity arises"
        else:
            urgency_label = "low — wait for a completely natural moment; do not force it"

        # Build constraints list
        constraint_entries = []
        for c in constraints:
            entry: dict = {"id": c.id, "description": c.description}
            if c.forbidden_actions:
                entry["forbidden_actions"] = c.forbidden_actions
            if c.forbidden_topics:
                entry["forbidden_topics"] = c.forbidden_topics
            if c.forbidden_phrases:
                entry["forbidden_phrases"] = c.forbidden_phrases
            if c.required_behaviours:
                entry["required_behaviours"] = c.required_behaviours
            if c.recovery_suggestion:
                entry["recovery_suggestion"] = c.recovery_suggestion
            constraint_entries.append(entry)

        data = {
            "persona_state": {
                "trust": round(state.trust, 2),
                "suspicion": round(state.suspicion, 2),
            },
            "conversation_state": {
                "current_topic": state.current_topic or "general",
                "turns_on_topic": state.turns_on_topic,
                "turns_in_stage": state.turns_in_stage,
            },
            "hidden_intent": {
                "id": objective.id,
                "description": objective.hidden_intent or objective.description,
                "natural_triggers": objective.natural_triggers,
                "priority": round(effective_priority, 2),
                "urgency": urgency_label,
            },
            "active_constraints": constraint_entries,
            "valid_next_stages": valid_next_stages,
        }
        return json.dumps(data, indent=2)

    def _build_history_block(
        self, state: ConversationState, persona: PersonaDefinition | None
    ) -> str:
        """Format the last N turns as a readable dialogue string."""
        persona_name = persona.display_name if persona else "them"
        lines: list[str] = []
        for entry in state.history[-_HISTORY_WINDOW:]:
            role = "user" if entry.sender == "user" else persona_name
            lines.append(f"{role}: {entry.content}")
        return "\n".join(lines) if lines else "(conversation just started)"

