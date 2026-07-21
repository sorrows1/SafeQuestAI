"""Admin — User management."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional

from app.auth.security import require_admin
from app.models.orm import User, get_db

router = APIRouter(prefix="/api/admin/users", tags=["Admin - Users"])


class UserAdminOut(BaseModel):
    id: int
    email: str
    display_name: str
    role: str
    is_active: bool
    google_id: Optional[str]
    model_config = {"from_attributes": True}


class PatchUserBody(BaseModel):
    role: Optional[str] = None
    is_active: Optional[bool] = None


@router.get("/", response_model=list[UserAdminOut])
def list_users(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return db.query(User).order_by(User.id).all()


@router.patch("/{user_id}", response_model=UserAdminOut)
def patch_user(user_id: int, body: PatchUserBody, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if body.role is not None:
        if body.role not in ("user", "admin"):
            raise HTTPException(status_code=400, detail="Role must be 'user' or 'admin'")
        user.role = body.role
    if body.is_active is not None:
        user.is_active = body.is_active
    db.commit()
    db.refresh(user)
    return user
