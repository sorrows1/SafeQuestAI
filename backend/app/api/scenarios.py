"""Admin — Scenarios CRUD (DB-backed)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.content_schemas import ScenarioDefinition
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/scenarios", tags=["Admin - Scenarios"])


@router.get("/", response_model=list[ScenarioDefinition])
def list_scenarios(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.list_scenarios(db)


@router.get("/{id}", response_model=ScenarioDefinition)
def get_scenario(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    s = content_repo.get_scenario(db, id)
    if not s:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return s


@router.post("/", response_model=ScenarioDefinition, status_code=201)
def create_scenario(body: ScenarioDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if content_repo.get_scenario(db, body.id):
        raise HTTPException(status_code=409, detail="Scenario ID already exists")

    try:
        return content_repo.upsert_scenario(db, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.put("/{id}", response_model=ScenarioDefinition)
def update_scenario(id: str, body: ScenarioDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    body.id = id

    try:
        return content_repo.upsert_scenario(db, body)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc


@router.delete("/{id}", status_code=204)
def delete_scenario(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not content_repo.delete_scenario(db, id):
        raise HTTPException(status_code=404, detail="Scenario not found")


@router.post("/{id}/duplicate", response_model=ScenarioDefinition)
def duplicate_scenario(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    result = content_repo.duplicate_scenario(db, id)
    if not result:
        raise HTTPException(status_code=404, detail="Scenario not found")
    return result
