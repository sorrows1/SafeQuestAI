"""
LLMService — thin async wrapper around the OpenAI-compatible API.

Accepts a pre-built prompt string (produced by PromptBuilder) and
returns a parsed dict for validation by the Validator.

The current configuration uses the GitHub Models endpoint with
GITHUB_TOKEN authentication. When GPT-5.5 mini becomes available,
update OPENAI_MODEL in the .env file — no code changes needed.
"""

from __future__ import annotations

import json
import logging
import os

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
        self._token = os.getenv("GITHUB_TOKEN") or os.getenv("OPENAI_API_KEY")
        self._endpoint = os.getenv("OPENAI_ENDPOINT", "https://models.github.ai/inference")
        self._model = os.getenv("OPENAI_MODEL", "openai/gpt-4.1-mini")

        if not self._token:
            raise RuntimeError(
                "No LLM API token found. Set GITHUB_TOKEN or OPENAI_API_KEY in environment."
            )

        self._client = AsyncOpenAI(
            base_url=self._endpoint,
            api_key=self._token,
        )
        logger.info("LLMService initialised: model=%s endpoint=%s", self._model, self._endpoint)

    async def generate(self, system_prompt: str, user_message: str) -> dict:
        """
        Call the LLM with a system prompt and user message.

        Args:
            system_prompt: The fully built prompt from PromptBuilder.
            user_message: The raw user input for this turn.

        Returns:
            Parsed JSON dict from the LLM response.

        Raises:
            ValueError: If the LLM response is not valid JSON.
            Exception: On API call failure.
        """
        messages: list[ChatCompletionMessageParam] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        logger.debug("LLMService: calling %s with %d message(s)", self._model, len(messages))

        response = await self._client.chat.completions.create(
            model=self._model,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.7,
            max_tokens=1024,
        )

        raw_content = response.choices[0].message.content
        if not raw_content:
            raise ValueError("LLM returned empty response.")

        try:
            return json.loads(raw_content)
        except json.JSONDecodeError as exc:
            logger.error("LLM response is not valid JSON: %s", raw_content[:500])
            raise ValueError(f"LLM response is not valid JSON: {exc}") from exc
