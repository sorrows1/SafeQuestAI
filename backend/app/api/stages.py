"""Admin — Stages CRUD (DB-backed)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.content_schemas import StageDefinition
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/stages", tags=["Admin - Stages"])


@router.get("/", response_model=list[StageDefinition])
def list_stages(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.list_stages(db)


@router.get("/{id}", response_model=StageDefinition)
def get_stage(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    s = content_repo.get_stage(db, id)
    if not s:
        raise HTTPException(status_code=404, detail="Stage not found")
    return s


@router.post("/", response_model=StageDefinition, status_code=201)
def create_stage(body: StageDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.upsert_stage(db, body)


@router.put("/{id}", response_model=StageDefinition)
def update_stage(id: str, body: StageDefinition, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    body.id = id
    return content_repo.upsert_stage(db, body)


@router.delete("/{id}", status_code=204)
def delete_stage(id: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not content_repo.delete_stage(db, id):
        raise HTTPException(status_code=404, detail="Stage not found")
