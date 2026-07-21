"""
Validator — validates LLM output before it is applied to conversation state.

Checks:
  1. JSON structure matches LLMOutputSchema.
  2. current_stage is a known stage ID.
  3. next_stage is in the valid_next_stages list.
  4. confidence is above minimum threshold.
  5. No constraint violations detected in the reply text.

Returns a ValidationResult — either valid with the parsed output, or
invalid with a list of rejection reasons.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field

from app.models.content_schemas import ConstraintDefinition
from app.models.schemas import LLMOutputSchema

logger = logging.getLogger(__name__)

# Minimum acceptable confidence from the LLM
MIN_CONFIDENCE = 0.4


@dataclass
class ValidationResult:
    """Outcome of running the Validator on an LLM response."""
    valid: bool
    output: LLMOutputSchema | None = None
    errors: list[str] = field(default_factory=list)


class Validator:
    """
    Validates LLM output for structural correctness and policy compliance.
    Stateless — all context is passed in as arguments.
    """

    def validate(
        self,
        raw_output: dict,
        known_stage_ids: list[str],
        valid_next_stages: list[str],
        active_constraints: list[ConstraintDefinition],
    ) -> ValidationResult:
        """
        Run all validation checks on the LLM's raw JSON output dict.

        Args:
            raw_output: Parsed JSON dict from the LLM response.
            known_stage_ids: All valid stage IDs (from ScenarioLoader).
            valid_next_stages: Stages the LLM is allowed to transition to.
            active_constraints: Active constraint definitions for this turn.

        Returns:
            ValidationResult with valid=True and parsed output, or valid=False with errors.
        """
        errors: list[str] = []

        # 1. Parse against schema
        try:
            output = LLMOutputSchema.model_validate(raw_output)
        except Exception as exc:
            return ValidationResult(
                valid=False,
                errors=[f"Schema validation failed: {exc}"],
            )

        # 2. Check current_stage is a known stage
        if output.current_stage not in known_stage_ids:
            errors.append(
                f"current_stage '{output.current_stage}' is not a known stage. "
                f"Known: {known_stage_ids}"
            )

        # 3. Check next_stage is a valid transition
        if output.next_stage not in valid_next_stages:
            logger.warning(
                "LLM suggested invalid transition to '%s'. Clamping to current stage.",
                output.next_stage,
            )
            # Clamp instead of reject — keeps the conversation going
            output.next_stage = output.current_stage

        # 4. Confidence check
        if output.confidence < MIN_CONFIDENCE:
            errors.append(
                f"LLM confidence {output.confidence:.2f} is below minimum {MIN_CONFIDENCE}."
            )

        # 5. Constraint violation check on reply text
        constraint_errors = self._check_constraints(output.reply, active_constraints)
        errors.extend(constraint_errors)

        if errors:
            logger.warning("Validator rejected LLM output: %s", errors)
            return ValidationResult(valid=False, errors=errors)

        return ValidationResult(valid=True, output=output)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _check_constraints(reply: str, constraints: list[ConstraintDefinition]) -> list[str]:
        """
        Scan the reply text for forbidden phrases from active constraints.
        Returns a list of violation error strings.
        """
        violations: list[str] = []
        reply_lower = reply.lower()

        for constraint in constraints:
            for phrase in constraint.forbidden_phrases:
                if phrase.lower() in reply_lower:
                    violations.append(
                        f"Constraint '{constraint.id}' violated: "
                        f"forbidden phrase '{phrase}' detected in reply. "
                        f"Severity: {constraint.violation_severity}"
                    )

        return violations
