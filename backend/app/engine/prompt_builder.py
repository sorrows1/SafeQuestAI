"""
PromptBuilder — assembles the layered LLM prompt from structured JSON blocks.

Architecture (cache-optimized):
  Layer 1: Static system prompt  — loaded from system_prompt.txt, NEVER changes.
  Layer 2: Persona block         — JSON, changes per conversation.
  Layer 3: Stage block           — JSON, changes per stage transition.
  Layer 4: Turn state block      — JSON, changes every turn (kept minimal).
  Layer 5: Recent history        — last N messages, changes every turn.

Design: stateless, pure function — no side effects.
"""

from __future__ import annotations

import logging
from pathlib import Path

from app.engine.scenario_loader import ScenarioLoader

logger = logging.getLogger(__name__)

# Separator used between prompt layers — helps the LLM distinguish sections
_SEP = "\n" + "─" * 60 + "\n"


class PromptBuilder:
    """
    Assembles the final layered prompt string for the LLM.

    Expects the PolicyDecision to carry a `prompt_blocks` dict with keys:
        "persona", "stage", "turn_state", "history"

    Falls back gracefully if any block is missing.
    """

    def __init__(self, loader: ScenarioLoader) -> None:
        self._loader = loader
        self._system_prompt: str | None = None

    def build(self, template_name: str, prompt_blocks: dict[str, str]) -> str:
        """
        Assemble the full prompt from structured blocks.

        Args:
            template_name: Name of the prompt template (used to load the JSON schema section).
            prompt_blocks:  Dict produced by DialoguePolicyEngine._build_prompt_blocks().

        Returns:
            Fully assembled prompt string ready for the LLM.
        """
        system = self._get_system_prompt()

        persona_block    = prompt_blocks.get("persona", "")
        stage_block      = prompt_blocks.get("stage", "")
        turn_state_block = prompt_blocks.get("turn_state", "")
        history_block    = prompt_blocks.get("history", "(conversation just started)")

        parts: list[str] = [
            system,
            _SEP + "## PERSONA & SCENARIO\n" + persona_block,
            _SEP + "## CURRENT STAGE\n" + stage_block,
            _SEP + "## TURN STATE\n" + turn_state_block,
            _SEP + "## RECENT CONVERSATION\n" + history_block,
            _SEP + self._get_output_schema(),
        ]

        return "\n".join(parts)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _get_system_prompt(self) -> str:
        """Load the static system prompt (cached after first load)."""
        if self._system_prompt is not None:
            return self._system_prompt

        # Try loading from file (preferred — never changes, ideal for prompt caching)
        try:
            template = self._loader.get_prompt_template("system_prompt")
            self._system_prompt = template.content
            return self._system_prompt
        except KeyError:
            pass

        # Fallback: load from filesystem directly
        config_dir = self._loader._config_dir
        system_file = config_dir / "prompts" / "system_prompt.txt"
        if system_file.exists():
            self._system_prompt = system_file.read_text(encoding="utf-8")
            return self._system_prompt

        logger.warning("system_prompt.txt not found — using minimal fallback")
        self._system_prompt = (
            "You are a realistic person chatting on a messaging app. "
            "Respond naturally. Never sound like an AI assistant."
        )
        return self._system_prompt

    def _get_output_schema(self) -> str:
        """Return the required JSON output schema instruction."""
        return (
            "## YOUR RESPONSE\n"
            "You MUST respond ONLY with a valid JSON object. No prose before or after.\n\n"
            "{\n"
            '  "reply": "Your message as the character — plain string, no formatting",\n'
            '  "current_stage": "current stage id unchanged unless transitioning",\n'
            '  "next_stage": "one of valid_next_stages, or current stage if staying",\n'
            '  "current_objective": "current objective id",\n'
            '  "objective_completed": true or false,\n'
            '  "trust_delta": 0.0,\n'
            '  "suspicion_delta": 0.0,\n'
            '  "flags": [],\n'
            '  "reasoning": "one sentence — why did you write this reply",\n'
            '  "confidence": 0.8\n'
            "}"
        )

    @staticmethod
    def extract_variables(template_content: str) -> list[str]:
        """Legacy utility kept for backward compat — returns empty list for new templates."""
        return []

