"""
LLMService — thin async wrapper around the OpenAI-compatible API.

Accepts system and user prompt layers from approved callers and
returns a parsed dict for validation by the Validator.

The current configuration uses the GitHub Models endpoint with
GITHUB_TOKEN authentication. When GPT-5.5 mini becomes available,
update OPENAI_MODEL in the .env file — no code changes needed.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Sequence

from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam

logger = logging.getLogger(__name__)


class LLMService:
    """
    Async LLM client.
    Accepts a fully-built prompt string and conversation history,
    returns raw parsed JSON dict.
    """

    def __init__(self) -> None:
        self._endpoint = os.getenv(
            "OPENAI_ENDPOINT", "https://models.github.ai/inference")
        self._model = os.getenv("OPENAI_MODEL", "openai/gpt-4.1-mini")

        if "github.ai" in self._endpoint:
            self._token = os.getenv(
                "GITHUB_TOKEN") or os.getenv("OPENAI_API_KEY")
        else:
            self._token = os.getenv(
                "OPENAI_API_KEY") or os.getenv("GITHUB_TOKEN")

        if not self._token:
            raise RuntimeError(
                "No LLM API token found. Set GITHUB_TOKEN or OPENAI_API_KEY in environment."
            )

        self._client = AsyncOpenAI(
            base_url=self._endpoint,
            api_key=self._token,
            timeout=30.0,
        )
        logger.info("LLMService initialised: model=%s endpoint=%s",
                    self._model, self._endpoint)

    async def generate(self, system_prompt: str, user_message: str) -> dict:
        """
        Call the LLM with a system prompt and user message.

        Args:
            system_prompt: The composed system instruction from an approved caller.
            user_message: The raw user input for this turn.

        Returns:
            Parsed JSON dict from the LLM response.

        Raises:
            ValueError: If the LLM response is not valid JSON.
            Exception: On API call failure.
        """
        sys_content = system_prompt
        if "json" not in system_prompt.lower() and "json" not in user_message.lower():
            sys_content = f"{system_prompt}\n\nRespond strictly with a valid JSON object."

        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": sys_content},
            {"role": "user", "content": user_message},
        ]

        logger.debug("LLMService: calling %s with %d message(s)",
                     self._model, len(messages))

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=4096,
            extra_body={
                "thinking": {
                    "type": "disabled",
                },
            },
        )

        choice = response.choices[0]

        if choice.finish_reason == "length":
            raise RuntimeError(
                "LLM generation exceeded max_tokens before producing a complete response."
            )

        content = choice.message.content

        if not content or not content.strip():
            raise RuntimeError(
                f"LLM returned empty response. finish_reason={choice.finish_reason!r}"
            )

        if not content:
            raise ValueError("LLM returned empty response.")

        try:
            return json.loads(content)
        except json.JSONDecodeError as exc:
            logger.error("LLM response is not valid JSON: %s",
                         content[:500])
            raise ValueError(f"LLM response is not valid JSON: {exc}") from exc

    async def generate_layers(
        self, system_layers: Sequence[str], user_layers: Sequence[str]
    ) -> dict[str, Any]:
        """Structured/layered compatibility API for durable runtime callers."""
        return await self.generate("\n\n".join(system_layers), "\n\n".join(user_layers))
