"""Admin — Objectives CRUD (DB-backed)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.content_schemas import ObjectiveDefinition
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/objectives", tags=["Admin - Objectives"])


@router.get("/", response_model=list[ObjectiveDefinition])
def list_objectives(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.list_objectives(db)


@router.get("/{id}", response_model=ObjectiveDefinition)
def get_objective(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    o = content_repo.get_objective(db, id)
    if not o:
        raise HTTPException(status_code=404, detail="Objective not found")
    return o


@router.post("/", response_model=ObjectiveDefinition, status_code=201)
def create_objective(body: ObjectiveDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.upsert_objective(db, body)


@router.put("/{id}", response_model=ObjectiveDefinition)
def update_objective(id: str, body: ObjectiveDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    body.id = id
    return content_repo.upsert_objective(db, body)


@router.delete("/{id}", status_code=204)
def delete_objective(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not content_repo.delete_objective(db, id):
        raise HTTPException(status_code=404, detail="Objective not found")
