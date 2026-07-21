"""Admin — Prompt Templates CRUD (DB-backed)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Any

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.content_schemas import PromptTemplate
from app.repositories import content_repo

router = APIRouter(prefix="/api/admin/prompts", tags=["Admin - Prompts"])


@router.get("/", response_model=list[PromptTemplate])
def list_prompts(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.list_prompts(db)


@router.get("/{name}", response_model=PromptTemplate)
def get_prompt(name: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    t = content_repo.get_prompt(db, name)
    if not t:
        raise HTTPException(status_code=404, detail="Prompt template not found")
    return t


@router.post("/", response_model=PromptTemplate, status_code=201)
def create_prompt(body: PromptTemplate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return content_repo.upsert_prompt(db, body)


@router.put("/{name}", response_model=PromptTemplate)
def update_prompt(name: str, body: PromptTemplate, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    body.name = name
    return content_repo.upsert_prompt(db, body)


@router.delete("/{name}", status_code=204)
def delete_prompt(name: str, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    if not content_repo.delete_prompt(db, name):
        raise HTTPException(status_code=404, detail="Prompt not found")


@router.post("/{name}/preview")
def preview_prompt(name: str, vars: dict[str, Any], db: Session = Depends(get_db), _: User = Depends(require_admin)):
    t = content_repo.get_prompt(db, name)
    if not t:
        raise HTTPException(status_code=404, detail="Prompt not found")
    try:
        rendered = t.content.format(**vars)
    except KeyError as e:
        rendered = t.content  # return raw if missing vars
    return {"rendered": rendered}
