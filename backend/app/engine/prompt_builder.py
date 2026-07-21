"""
PromptBuilder — assembles the final LLM prompt from a template and variable map.

Takes the prompt template string (loaded by ScenarioLoader) and replaces
all {{variable}} placeholders with values from the PolicyDecision's variable map.

Design: stateless, pure function — no side effects.
"""

from __future__ import annotations

import re
import logging
from typing import Any

from app.engine.scenario_loader import ScenarioLoader

logger = logging.getLogger(__name__)

# Matches {{variable_name}} patterns
_VARIABLE_PATTERN = re.compile(r"\{\{(\w+)\}\}")


class PromptBuilder:
    """
    Assembles the final prompt string for the LLM.
    Supports per-scenario custom templates with fallback to 'default_dialogue'.
    """

    def __init__(self, loader: ScenarioLoader) -> None:
        self._loader = loader

    def build(self, template_name: str, variables: dict[str, str]) -> str:
        """
        Load the template by name and interpolate all {{variable}} placeholders.

        Args:
            template_name: Name of the prompt template (without .txt extension).
            variables: Key-value map produced by DialoguePolicyEngine.

        Returns:
            Fully interpolated prompt string ready for the LLM.
        """
        # Try the named template first, then fall back to default
        try:
            template = self._loader.get_prompt_template(template_name)
        except KeyError:
            logger.warning(
                "Prompt template '%s' not found — falling back to 'default_dialogue'.",
                template_name,
            )
            template = self._loader.get_prompt_template("default_dialogue")

        return self._interpolate(template.content, variables)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _interpolate(self, template: str, variables: dict[str, str]) -> str:
        """Replace all {{key}} occurrences. Log warnings for any missing keys."""
        missing: list[str] = []

        def replacer(match: re.Match[str]) -> str:
            key = match.group(1)
            if key in variables:
                return str(variables[key])
            missing.append(key)
            return f"[MISSING:{key}]"

        result = _VARIABLE_PATTERN.sub(replacer, template)

        if missing:
            logger.warning(
                "PromptBuilder: missing variables in template: %s",
                missing,
            )

        return result

    @staticmethod
    def extract_variables(template_content: str) -> list[str]:
        """Utility: extract the list of variable names used in a template."""
        return list(dict.fromkeys(_VARIABLE_PATTERN.findall(template_content)))
