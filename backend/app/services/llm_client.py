import json
from openai import AsyncOpenAI
import os
from app.prompts.system import SYSTEM_PROMPT

class LLMService:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
        
    async def generate_response(self, scenario_config: dict, history: list, user_message: str) -> dict:
        system_content = SYSTEM_PROMPT.format(
            scenario_config=json.dumps(scenario_config),
            emotional_state="neutral"
        )
        
        messages = [{"role": "system", "content": system_content}]
        for msg in history:
            messages.append({"role": msg["sender"], "content": msg["content"]})
            
        messages.append({"role": "user", "content": user_message})

        response = await self.client.chat.completions.create(
            model="gpt-4-1106-preview",
            messages=messages,
            response_format={ "type": "json_object" },
            temperature=0.7
        )
        
        return json.loads(response.choices[0].message.content)
