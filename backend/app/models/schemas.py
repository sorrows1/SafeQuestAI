from pydantic import BaseModel
from typing import List, Optional, Dict, Any

class ChatRequest(BaseModel):
    session_id: int
    message: str

class ChatResponse(BaseModel):
    reply: str
    emotion: str
    conversation_stage: str
    risk_score: float
    flags: List[str]

class ScenarioStartRequest(BaseModel):
    scenario_id: str
    difficulty: str

class ScenarioStartResponse(BaseModel):
    session_id: int
    initial_message: Optional[str]
