"""
Simulator API — the full runtime dialogue engine.

Flow for each /chat call:
  1. Load session state from DB.
  2. Append user message to history.
  3. DialoguePolicyEngine.decide() → PolicyDecision.
  4. PromptBuilder.build() → prompt string.
  5. LLMService.generate() → raw JSON dict.
  6. Validator.validate() → ValidationResult.
  7. StateUpdater.apply() → updated state.
  8. Persist state to DB.
  9. Return reply + state summary.
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session as DBSession

from app.engine.conversation_state import ConversationState
from app.engine.dialogue_policy import DialoguePolicyEngine
from app.engine.prompt_builder import PromptBuilder
from app.repositories import content_repo
from app.engine.state_updater import StateUpdater
from app.engine.validator import Validator
from app.llm.llm_service import LLMService
from app.models.orm import ConversationSession, ConversationMessage, get_db
from app.models.schemas import (
    SimulatorStartRequest,
    SimulatorStartResponse,
    SimulatorChatRequest,
    SimulatorChatResponse,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/simulator", tags=["Admin - Simulator"])

# Validator is stateless — one instance is fine
_validator = Validator()


from app.auth.security import require_admin
from app.models.orm import User


def get_llm() -> LLMService:
    from app.main import llm_service
    return llm_service


@router.post("/start", response_model=SimulatorStartResponse, summary="Start a new simulation")
def start_simulation(
    request: SimulatorStartRequest,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Initialise a new conversation session for the given scenario.
    Returns the session ID and initial state.
    """
    scenario = content_repo.get_scenario(db, request.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail=f"Scenario '{request.scenario_id}' not found.")

    if not scenario.stage_sequence:
        raise HTTPException(status_code=400, detail="Scenario has no stage_sequence defined.")

    # Create DB session record
    db_session = ConversationSession(
        scenario_id=request.scenario_id,
        difficulty=request.difficulty,
        state={},
    )
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    # Build initial state
    first_step = scenario.stage_sequence[0]
    first_objective = first_step.mandatory_objectives[0] if first_step.mandatory_objectives else ""

    state = ConversationState(
        session_id=db_session.id,
        scenario_id=request.scenario_id,
        difficulty=request.difficulty,
        current_stage=scenario.starting_stage,
        stage_sequence_index=0,
        current_objective=first_objective,
    )

    # Persist initial state
    db_session.state = state.to_db_dict()
    db.commit()

    # Build welcome message from persona
    persona = content_repo.get_persona(db, scenario.persona)
    if persona:
        first_name = persona.display_name.split()[0] if ' ' in persona.display_name else persona.display_name
        initial_message = f"Hey! I'm {first_name}. Just saw you here and thought I'd say hi!"
    else:
        initial_message = "Hey! Just saw you here and thought I'd say hi!"

    return SimulatorStartResponse(
        session_id=db_session.id,
        scenario_id=request.scenario_id,
        initial_message=initial_message,
        state=state.to_db_dict(),
    )


@router.post("/chat", response_model=SimulatorChatResponse, summary="Send a message in a simulation")
async def chat(
    request: SimulatorChatRequest,
    debug: bool = False,
    db: DBSession = Depends(get_db),
    _: User = Depends(require_admin),
    llm: LLMService = Depends(get_llm),
):
    """
    Full engine pipeline for a single conversation turn.
    Set debug=true to include the built prompt in the response.
    """
    # Load session
    db_session = db.query(ConversationSession).filter(
        ConversationSession.id == request.session_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found.")

    # Deserialize state
    state = ConversationState.from_db_dict(db_session.state)

    # Append user message to state history
    state.add_message(sender="user", content=request.message)

    # Store user message in DB messages table
    db.add(ConversationMessage(
        session_id=state.session_id,
        sender="user",
        content=request.message,
    ))

    # Build a temporary in-memory loader for the engine (adapter pattern)
    from app.engine.scenario_loader import ScenarioLoader as _Loader
    from pathlib import Path
    _loader = _Loader(Path("/tmp"))  # dummy path — we override caches below
    _loader._scenarios = {s.id: s for s in content_repo.list_scenarios(db)}
    _loader._personas  = {p.id: p for p in content_repo.list_personas(db)}
    _loader._stages    = {s.id: s for s in content_repo.list_stages(db)}
    _loader._objectives= {o.id: o for o in content_repo.list_objectives(db)}
    _loader._constraints={c.id: c for c in content_repo.list_constraints(db)}
    _loader._prompt_templates = {t.name: t for t in content_repo.list_prompts(db)}

    # 1. Dialogue policy decision
    policy_engine = DialoguePolicyEngine(_loader)
    try:
        decision = policy_engine.decide(state)
    except (KeyError, ValueError) as exc:
        raise HTTPException(status_code=422, detail=f"Policy engine error: {exc}")

    # 2. Build prompt
    prompt_builder = PromptBuilder(_loader)
    scenario = content_repo.get_scenario(db, state.scenario_id)
    if not scenario:
        raise HTTPException(status_code=404, detail="Scenario not found.")
    prompt = prompt_builder.build(
        scenario.prompt_template, decision.prompt_blocks, category=scenario.category, role="initiator"
    )

    # 3. LLM call
    try:
        raw_output = await llm.generate(system_prompt=prompt, user_message=request.message)
    except Exception as exc:
        logger.error("LLM call failed: %s", exc)
        raise HTTPException(status_code=502, detail=f"LLM call failed: {exc}")

    # 4. Validate
    known_stage_ids = list(_loader._stages.keys())
    validation_result = _validator.validate(
        raw_output=raw_output,
        known_stage_ids=known_stage_ids,
        valid_next_stages=decision.valid_next_stages,
        active_constraints=decision.active_constraints,
    )

    if not validation_result.valid:
        logger.warning("Validation failed — returning fallback reply. Errors: %s", validation_result.errors)
        # Fallback: return a safe generic response
        return SimulatorChatResponse(
            reply="Hmm, let me think about that... What else are you up to today?",
            current_stage=state.current_stage,
            next_stage=state.current_stage,
            current_objective=state.current_objective,
            objective_completed=False,
            trust=state.trust,
            suspicion=state.suspicion,
            flags=["validation_failure"],
            reasoning=f"Validation failed: {validation_result.errors}",
            confidence=0.0,
            built_prompt=prompt if debug else None,
        )

    llm_output = validation_result.output

    # 5. Get difficulty trust multiplier
    diff_modifier = scenario.difficulty_modifiers.get(state.difficulty)
    trust_multiplier = diff_modifier.trust_delta_multiplier if diff_modifier else 1.0

    # 6. Update state
    state_updater = StateUpdater(policy_engine)
    state = state_updater.apply(state, llm_output, trust_multiplier)

    # 7. Persist updated state and assistant message
    db_session.state = state.to_db_dict()
    db.add(ConversationMessage(
        session_id=state.session_id,
        sender="assistant",
        content=llm_output.reply,
        metadata_json=llm_output.model_dump(),
    ))
    db.commit()

    return SimulatorChatResponse(
        reply=llm_output.reply,
        current_stage=state.current_stage,
        next_stage=llm_output.next_stage,
        current_objective=state.current_objective,
        objective_completed=llm_output.objective_completed,
        trust=state.trust,
        suspicion=state.suspicion,
        flags=state.flags,
        reasoning=llm_output.reasoning,
        confidence=llm_output.confidence,
        built_prompt=prompt if debug else None,
    )


@router.get("/session/{session_id}", summary="Get session state")
def get_session(session_id: int, db: DBSession = Depends(get_db)):
    db_session = db.query(ConversationSession).filter(
        ConversationSession.id == session_id
    ).first()
    if not db_session:
        raise HTTPException(status_code=404, detail="Session not found.")
    return db_session.state


@router.get("/session/{session_id}/history", summary="Get message history for a session")
def get_history(session_id: int, db: DBSession = Depends(get_db)):
    messages = db.query(ConversationMessage).filter(
        ConversationMessage.session_id == session_id
    ).order_by(ConversationMessage.timestamp).all()
    return [
        {
            "id": m.id,
            "sender": m.sender,
            "content": m.content,
            "timestamp": m.timestamp.isoformat(),
            "metadata": m.metadata_json,
        }
        for m in messages
    ]
