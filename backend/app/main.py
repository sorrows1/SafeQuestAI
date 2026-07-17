from fastapi import FastAPI, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession
from app.database.core import SessionLocal, Session, Message
from app.models.schemas import ChatRequest, ChatResponse, ScenarioStartRequest, ScenarioStartResponse
from app.services.llm_client import LLMService
import json

app = FastAPI(title="Safe Quest API")
llm_service = LLMService()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@app.post("/scenario/start", response_model=ScenarioStartResponse)
def start_scenario(request: ScenarioStartRequest, db: DBSession = Depends(get_db)):
    new_session = Session(scenario_id=request.scenario_id, state={"difficulty": request.difficulty})
    db.add(new_session)
    db.commit()
    db.refresh(new_session)
    return ScenarioStartResponse(session_id=new_session.id, initial_message="Hi there!")

@app.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, db: DBSession = Depends(get_db)):
    session = db.query(Session).filter(Session.id == request.session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    user_msg = Message(session_id=session.id, sender="user", content=request.message)
    db.add(user_msg)
    
    history_records = db.query(Message).filter(Message.session_id == session.id).order_by(Message.timestamp).all()
    history = [{"sender": "assistant" if m.sender == "ai" else "user", "content": m.content} for m in history_records]

    scenario_config = {"role": "Helpful Stranger", "difficulty": session.state.get("difficulty")} 
    ai_response = await llm_service.generate_response(scenario_config, history, request.message)

    ai_msg = Message(
        session_id=session.id, 
        sender="ai", 
        content=ai_response["reply"], 
        metadata_json=ai_response
    )
    db.add(ai_msg)
    db.commit()

    return ChatResponse(**ai_response)
