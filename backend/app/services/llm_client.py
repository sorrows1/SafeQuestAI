import json
from openai import AsyncOpenAI
from openai.types.chat import ChatCompletionMessageParam
import os
from app.prompts.system import SYSTEM_PROMPT


class LLMService:
    def __init__(self):
        self.token = os.getenv("GITHUB_TOKEN")
        self.endpoint = os.getenv("OPENAI_ENDPOINT")
        self.model = os.getenv("OPENAI_MODEL", "openai/gpt-4.1-mini")

        if self.token is None:
            raise RuntimeError("GITHUB_TOKEN not set")

        if self.endpoint is None:
            raise RuntimeError("OPENAI_ENDPOINT not set")
        
        self.client = AsyncOpenAI(base_url=self.endpoint, api_key=self.token,)

    async def generate_response(self, scenario_config: dict, history: list, user_message: str) -> dict:
        system_content = SYSTEM_PROMPT.format(
            scenario_config=json.dumps(scenario_config),
            emotional_state="neutral"
        )
        
        messages: list[ChatCompletionMessageParam] = [{"role": "system", "content": system_content}]
        for msg in history:
            messages.append({"role": msg["sender"], "content": msg["content"]})
            
        messages.append({"role": "user", "content": user_message})

        response = await self.client.chat.completions.create(
            model=self.model,
            messages=messages,
            response_format={ "type": "json_object" },
            temperature=0.7
        )
        
        return json.loads(response.choices[0].message.content)
