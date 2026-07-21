"""
StateUpdater — applies a validated LLM output to the ConversationState.

Responsibilities:
  - Apply trust_delta and suspicion_delta (clamped to [0.0, 1.0]).
  - Append assistant reply to history.
  - Add any flags raised by the LLM.
  - Delegate objective/stage progression to DialoguePolicyEngine.
  - Update the timestamp.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.engine.conversation_state import ConversationState
from app.engine.dialogue_policy import DialoguePolicyEngine
from app.models.schemas import LLMOutputSchema

logger = logging.getLogger(__name__)


class StateUpdater:
    """
    Applies a validated LLM output to the conversation state.
    Delegates stage/objective progression to DialoguePolicyEngine.
    """

    def __init__(self, policy_engine: DialoguePolicyEngine) -> None:
        self._policy_engine = policy_engine

    def apply(
        self,
        state: ConversationState,
        llm_output: LLMOutputSchema,
        difficulty_trust_multiplier: float = 1.0,
    ) -> ConversationState:
        """
        Apply the LLM output to the state and return the updated state.

        Args:
            state: Current conversation state (mutated in-place).
            llm_output: Validated LLM output from Validator.
            difficulty_trust_multiplier: Scaling factor from difficulty modifiers.

        Returns:
            Updated ConversationState.
        """
        # 1. Apply trust / suspicion deltas
        state.trust += llm_output.trust_delta * difficulty_trust_multiplier
        state.suspicion += llm_output.suspicion_delta
        state.clamp_metrics()

        # 2. Append assistant reply to history
        state.add_message(
            sender="assistant",
            content=llm_output.reply,
            metadata={
                "current_stage": llm_output.current_stage,
                "next_stage": llm_output.next_stage,
                "objective_completed": llm_output.objective_completed,
                "trust_delta": llm_output.trust_delta,
                "suspicion_delta": llm_output.suspicion_delta,
                "flags": llm_output.flags,
                "reasoning": llm_output.reasoning,
                "confidence": llm_output.confidence,
            },
        )

        # 3. Accumulate flags
        for flag in llm_output.flags:
            if flag not in state.flags:
                state.flags.append(flag)

        # 4. Advance stage/objective via policy engine
        self._policy_engine.advance_state(
            state,
            objective_completed=llm_output.objective_completed,
            next_stage=llm_output.next_stage,
        )

        # 5. Update timestamp
        state.updated_at = datetime.now(timezone.utc).isoformat()

        logger.debug(
            "StateUpdater: trust=%.2f suspicion=%.2f stage=%s objective=%s",
            state.trust,
            state.suspicion,
            state.current_stage,
            state.current_objective,
        )

        return state
