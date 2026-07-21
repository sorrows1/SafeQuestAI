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
  - Build the variable map used by PromptBuilder.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.engine.conversation_state import ConversationState
from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import (
    ConstraintDefinition,
    ObjectiveDefinition,
    ScenarioDefinition,
    StageDefinition,
    StageStep,
)

logger = logging.getLogger(__name__)


@dataclass
class PolicyDecision:
    """
    Output of the DialoguePolicyEngine.
    All fields are resolved from config — no LLM involvement.
    """
    current_stage: StageDefinition
    current_stage_step: StageStep
    current_objective: ObjectiveDefinition
    active_constraints: list[ConstraintDefinition]
    valid_next_stages: list[str]
    prompt_variables: dict[str, str] = field(default_factory=dict)


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

        prompt_variables = self._build_prompt_variables(
            state, scenario, stage, stage_step, objective, constraints
        )

        return PolicyDecision(
            current_stage=stage,
            current_stage_step=stage_step,
            current_objective=objective,
            active_constraints=constraints,
            valid_next_stages=valid_next_stages,
            prompt_variables=prompt_variables,
        )

    def advance_state(self, state: ConversationState, objective_completed: bool, next_stage: str) -> None:
        """
        After the LLM responds, advance the state machine:
        - Mark objective complete if flagged.
        - Advance to next objective within the same stage.
        - Advance to next stage step if all objectives are done.
        - Update current_stage in state.
        """
        scenario = self._loader.get_scenario(state.scenario_id)
        stage_step = self._get_current_stage_step(scenario, state)

        if objective_completed and state.current_objective:
            state.mark_objective_complete(state.current_objective)
            # Try to advance to next objective in this stage step
            remaining = [
                obj_id for obj_id in stage_step.objectives
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
                    if next_step.objectives:
                        state.current_objective = next_step.objectives[0]

        # Allow LLM-suggested stage transitions within valid transitions
        current_stage = self._loader.get_stage(state.current_stage)
        if next_stage and next_stage != state.current_stage and next_stage in current_stage.allowed_next:
            # Find matching stage step
            for idx, step in enumerate(scenario.stage_sequence):
                if step.stage == next_stage:
                    state.stage_sequence_index = idx
                    state.current_stage = next_stage
                    non_completed = [o for o in step.objectives if o not in state.completed_objectives]
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
        for obj_id in stage_step.objectives:
            if obj_id not in state.completed_objectives:
                state.current_objective = obj_id
                return self._loader.get_objective(obj_id)

        # All objectives complete — return the last one as context
        if stage_step.objectives:
            last_id = stage_step.objectives[-1]
            return self._loader.get_objective(last_id)

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

    def _build_prompt_variables(
        self,
        state: ConversationState,
        scenario: ScenarioDefinition,
        stage: StageDefinition,
        stage_step: StageStep,
        objective: ObjectiveDefinition,
        constraints: list[ConstraintDefinition],
    ) -> dict[str, str]:
        """Build the flat string variable map for PromptBuilder."""
        try:
            persona = self._loader.get_persona(scenario.persona)
        except KeyError:
            logger.warning("Persona '%s' not found for scenario '%s'", scenario.persona, scenario.id)
            persona = None

        # Format history as a readable dialogue
        history_lines: list[str] = []
        for entry in state.history[-20:]:  # last 20 turns
            role = "User" if entry.sender == "user" else persona.display_name if persona else "Assistant"
            history_lines.append(f"{role}: {entry.content}")
        history_text = "\n".join(history_lines) if history_lines else "(No previous messages)"

        # Format constraints
        constraint_lines: list[str] = []
        for c in constraints:
            constraint_lines.append(f"- [{c.violation_severity.upper()}] {c.description}")
            if c.forbidden_phrases:
                constraint_lines.append(
                    f"  Forbidden phrases: {', '.join(repr(p) for p in c.forbidden_phrases[:5])}"
                )
        constraints_text = "\n".join(constraint_lines) if constraint_lines else "No active constraints."

        completed_text = (
            ", ".join(state.completed_objectives) if state.completed_objectives else "None"
        )

        # Difficulty modifier description
        diff_modifier = scenario.difficulty_modifiers.get(state.difficulty)

        return {
            "persona_display_name": persona.display_name if persona else scenario.persona,
            "persona_description": persona.description if persona else "",
            "persona_tone": ", ".join(persona.tone) if persona else "",
            "persona_interests": ", ".join(persona.interests) if persona else "",
            "persona_speaking_style": (
                f"emoji={'yes' if persona.speaking_style.emoji else 'no'}, "
                f"slang={'yes' if persona.speaking_style.slang else 'no'}, "
                f"vocabulary={persona.speaking_style.vocabulary_level}"
            ) if persona else "",
            "persona_background": persona.background if persona else "",
            "scenario_display_name": scenario.display_name,
            "difficulty": state.difficulty,
            "current_stage": stage.id,
            "current_stage_description": stage.description,
            "current_objective": objective.id,
            "current_objective_description": objective.description,
            "completed_objectives": completed_text,
            "trust": f"{state.trust:.2f}",
            "suspicion": f"{state.suspicion:.2f}",
            "history": history_text,
            "active_constraints": constraints_text,
        }
