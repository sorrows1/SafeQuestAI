"""Admin — Constraints CRUD (DB-backed)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.content_schemas import ConstraintDefinition
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/constraints", tags=["Admin - Constraints"])


@router.get("/", response_model=list[ConstraintDefinition])
def list_constraints(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.list_constraints(db)


@router.get("/{id}", response_model=ConstraintDefinition)
def get_constraint(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    c = content_repo.get_constraint(db, id)
    if not c:
        raise HTTPException(status_code=404, detail="Constraint not found")
    return c


@router.post("/", response_model=ConstraintDefinition, status_code=201)
def create_constraint(body: ConstraintDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.upsert_constraint(db, body)


@router.put("/{id}", response_model=ConstraintDefinition)
def update_constraint(id: str, body: ConstraintDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    body.id = id
    return content_repo.upsert_constraint(db, body)


@router.delete("/{id}", status_code=204)
def delete_constraint(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not content_repo.delete_constraint(db, id):
        raise HTTPException(status_code=404, detail="Constraint not found")
