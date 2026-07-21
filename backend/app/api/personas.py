"""Admin — Personas CRUD (DB-backed)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.content_schemas import PersonaDefinition
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/personas", tags=["Admin - Personas"])


@router.get("/", response_model=list[PersonaDefinition])
def list_personas(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.list_personas(db)


@router.get("/{id}", response_model=PersonaDefinition)
def get_persona(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    p = content_repo.get_persona(db, id)
    if not p:
        raise HTTPException(status_code=404, detail="Persona not found")
    return p


@router.post("/", response_model=PersonaDefinition, status_code=201)
def create_persona(body: PersonaDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.upsert_persona(db, body)


@router.put("/{id}", response_model=PersonaDefinition)
def update_persona(id: str, body: PersonaDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    body.id = id
    return content_repo.upsert_persona(db, body)


@router.delete("/{id}", status_code=204)
def delete_persona(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not content_repo.delete_persona(db, id):
        raise HTTPException(status_code=404, detail="Persona not found")
