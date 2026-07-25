"""Database-backed content repository.
Replaces ScenarioLoader for all CRUD operations on content entities.
Falls back gracefully if tables are empty (migration not yet run).
"""
from __future__ import annotations

from typing import Any

from sqlalchemy.orm import Session

from app.models.orm import (
    ContentScenario, ContentPersona, ContentStage,
    ContentObjective, ContentConstraint, ContentPrompt,
)
from app.models.content_schemas import (
    ScenarioDefinition, PersonaDefinition, StageDefinition,
    ObjectiveDefinition, ConstraintDefinition, PromptTemplate,
)


# ── Generic helpers ──────────────────────────────────────────────────────────

def _to_scenario(row: ContentScenario) -> ScenarioDefinition:
    return ScenarioDefinition(**row.data)

def _to_persona(row: ContentPersona) -> PersonaDefinition:
    return PersonaDefinition(**row.data)

def _to_stage(row: ContentStage) -> StageDefinition:
    return StageDefinition(**row.data)

def _to_objective(row: ContentObjective) -> ObjectiveDefinition:
    return ObjectiveDefinition(**row.data)

def _to_constraint(row: ContentConstraint) -> ConstraintDefinition:
    return ConstraintDefinition(**row.data)

def _to_prompt(row: ContentPrompt) -> PromptTemplate:
    return PromptTemplate(
        name=row.name, content=row.content,
        variables=row.variables, description=row.description,
        kind=row.kind, role_scope=row.role_scope, version=row.version,
    )


# ── Scenario reference validation ─────────────────────────────────────────────

def validate_scenario_references(db: Session, scenario: ScenarioDefinition) -> None:
    """Raise an actionable error when a canonical scenario points at missing content."""
    errors: list[str] = []
    if db.get(ContentStage, scenario.starting_stage) is None:
        errors.append(f"starting_stage '{scenario.starting_stage}' does not exist")
    for index, step in enumerate(scenario.stage_sequence):
        if db.get(ContentStage, step.stage) is None:
            errors.append(f"stage_sequence[{index}].stage '{step.stage}' does not exist")
        for objective_id in step.mandatory_objectives + step.optional_objectives:
            if db.get(ContentObjective, objective_id) is None:
                errors.append(f"stage_sequence[{index}] objective '{objective_id}' does not exist")
        for constraint_id in step.constraints:
            if db.get(ContentConstraint, constraint_id) is None:
                errors.append(f"stage_sequence[{index}] constraint '{constraint_id}' does not exist")

    bindings = (("authoring", scenario.authoring),) if scenario.authoring else (
        ("initiator", scenario.initiator), ("respondent", scenario.respondent)
    )
    for role, binding in bindings:
        if binding is None:
            errors.append(f"{role} binding is required")
            continue
        if db.get(ContentPersona, binding.persona_id) is None:
            errors.append(f"{role}.persona_id '{binding.persona_id}' does not exist")
        prompt = db.get(ContentPrompt, binding.dialogue_prompt_id)
        if prompt is None:
            errors.append(f"{role}.dialogue_prompt_id '{binding.dialogue_prompt_id}' does not exist")
            continue
        expected_kind = "single_pass" if role == "authoring" else "dialogue"
        if prompt.kind != expected_kind:
            errors.append(f"{role}.dialogue_prompt_id '{prompt.name}' must have kind '{expected_kind}'")
        if prompt.role_scope not in {role, "either"}:
            errors.append(f"{role}.dialogue_prompt_id '{prompt.name}' has role_scope '{prompt.role_scope}', not '{role}' or 'either'")
    if errors:
        raise ValueError("; ".join(errors))


# ── Scenarios ────────────────────────────────────────────────────────────────

def list_scenarios(db: Session) -> list[ScenarioDefinition]:
    return [_to_scenario(r) for r in db.query(ContentScenario).all()]

def get_scenario(db: Session, id: str) -> ScenarioDefinition | None:
    row = db.query(ContentScenario).filter(ContentScenario.id == id).first()
    return _to_scenario(row) if row else None

def upsert_scenario(db: Session, s: ScenarioDefinition) -> ScenarioDefinition:
    validate_scenario_references(db, s)
    data = s.model_dump()
    row = db.query(ContentScenario).filter(ContentScenario.id == s.id).first()
    if row:
        row.display_name = s.display_name
        row.difficulty   = s.difficulty
        row.data         = data
    else:
        row = ContentScenario(id=s.id, display_name=s.display_name, difficulty=s.difficulty, data=data)
        db.add(row)
    db.commit(); db.refresh(row)
    return _to_scenario(row)

def delete_scenario(db: Session, id: str) -> bool:
    row = db.query(ContentScenario).filter(ContentScenario.id == id).first()
    if not row: return False
    db.delete(row); db.commit(); return True

def duplicate_scenario(db: Session, id: str) -> ScenarioDefinition | None:
    row = db.query(ContentScenario).filter(ContentScenario.id == id).first()
    if not row: return None
    new_id   = f"{id}_copy"
    new_data = {**row.data, "id": new_id, "display_name": f"{row.display_name} (Copy)"}
    new_row  = ContentScenario(id=new_id, display_name=new_data["display_name"],
                                difficulty=row.difficulty, data=new_data)
    db.add(new_row); db.commit(); db.refresh(new_row)
    return _to_scenario(new_row)


# ── Personas ─────────────────────────────────────────────────────────────────

def list_personas(db: Session) -> list[PersonaDefinition]:
    return [_to_persona(r) for r in db.query(ContentPersona).all()]

def get_persona(db: Session, id: str) -> PersonaDefinition | None:
    row = db.query(ContentPersona).filter(ContentPersona.id == id).first()
    return _to_persona(row) if row else None

def upsert_persona(db: Session, p: PersonaDefinition) -> PersonaDefinition:
    data = p.model_dump()
    row  = db.query(ContentPersona).filter(ContentPersona.id == p.id).first()
    if row:
        row.display_name = p.display_name; row.data = data
    else:
        row = ContentPersona(id=p.id, display_name=p.display_name, data=data)
        db.add(row)
    db.commit(); db.refresh(row); return _to_persona(row)

def delete_persona(db: Session, id: str) -> bool:
    row = db.query(ContentPersona).filter(ContentPersona.id == id).first()
    if not row: return False
    db.delete(row); db.commit(); return True


# ── Stages ───────────────────────────────────────────────────────────────────

def list_stages(db: Session) -> list[StageDefinition]:
    return [_to_stage(r) for r in db.query(ContentStage).all()]

def get_stage(db: Session, id: str) -> StageDefinition | None:
    row = db.query(ContentStage).filter(ContentStage.id == id).first()
    return _to_stage(row) if row else None

def upsert_stage(db: Session, s: StageDefinition) -> StageDefinition:
    data = s.model_dump()
    row  = db.query(ContentStage).filter(ContentStage.id == s.id).first()
    if row:
        row.display_name = s.display_name; row.data = data
    else:
        row = ContentStage(id=s.id, display_name=s.display_name, data=data)
        db.add(row)
    db.commit(); db.refresh(row); return _to_stage(row)

def delete_stage(db: Session, id: str) -> bool:
    row = db.query(ContentStage).filter(ContentStage.id == id).first()
    if not row: return False
    db.delete(row); db.commit(); return True


# ── Objectives ───────────────────────────────────────────────────────────────

def list_objectives(db: Session) -> list[ObjectiveDefinition]:
    return [_to_objective(r) for r in db.query(ContentObjective).all()]

def get_objective(db: Session, id: str) -> ObjectiveDefinition | None:
    row = db.query(ContentObjective).filter(ContentObjective.id == id).first()
    return _to_objective(row) if row else None

def upsert_objective(db: Session, o: ObjectiveDefinition) -> ObjectiveDefinition:
    data = o.model_dump()
    row  = db.query(ContentObjective).filter(ContentObjective.id == o.id).first()
    if row:
        row.display_name = o.display_name; row.data = data
    else:
        row = ContentObjective(id=o.id, display_name=o.display_name, data=data)
        db.add(row)
    db.commit(); db.refresh(row); return _to_objective(row)

def delete_objective(db: Session, id: str) -> bool:
    row = db.query(ContentObjective).filter(ContentObjective.id == id).first()
    if not row: return False
    db.delete(row); db.commit(); return True


# ── Constraints ──────────────────────────────────────────────────────────────

def list_constraints(db: Session) -> list[ConstraintDefinition]:
    return [_to_constraint(r) for r in db.query(ContentConstraint).all()]

def get_constraint(db: Session, id: str) -> ConstraintDefinition | None:
    row = db.query(ContentConstraint).filter(ContentConstraint.id == id).first()
    return _to_constraint(row) if row else None

def upsert_constraint(db: Session, c: ConstraintDefinition) -> ConstraintDefinition:
    data = c.model_dump()
    row  = db.query(ContentConstraint).filter(ContentConstraint.id == c.id).first()
    if row:
        row.data = data
    else:
        row = ContentConstraint(id=c.id, data=data)
        db.add(row)
    db.commit(); db.refresh(row); return _to_constraint(row)

def delete_constraint(db: Session, id: str) -> bool:
    row = db.query(ContentConstraint).filter(ContentConstraint.id == id).first()
    if not row: return False
    db.delete(row); db.commit(); return True


# ── Prompts ──────────────────────────────────────────────────────────────────

def list_prompts(db: Session) -> list[PromptTemplate]:
    return [_to_prompt(r) for r in db.query(ContentPrompt).all()]

def get_prompt(db: Session, name: str) -> PromptTemplate | None:
    row = db.query(ContentPrompt).filter(ContentPrompt.name == name).first()
    return _to_prompt(row) if row else None

def upsert_prompt(db: Session, t: PromptTemplate) -> PromptTemplate:
    row = db.query(ContentPrompt).filter(ContentPrompt.name == t.name).first()
    if row:
        row.content     = t.content
        row.variables   = t.variables
        row.description = t.description
        row.kind = t.kind
        row.role_scope = t.role_scope
        row.version = t.version
    else:
        row = ContentPrompt(name=t.name, content=t.content, variables=t.variables,
                            description=t.description, kind=t.kind,
                            role_scope=t.role_scope, version=t.version)
        db.add(row)
    db.commit(); db.refresh(row); return _to_prompt(row)

def delete_prompt(db: Session, name: str) -> bool:
    row = db.query(ContentPrompt).filter(ContentPrompt.name == name).first()
    if not row: return False
    db.delete(row); db.commit(); return True
