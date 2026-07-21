"""Pydantic schemas for auth endpoints."""
from __future__ import annotations
from pydantic import BaseModel, EmailStr
from typing import Optional


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    display_name: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserOut(BaseModel):
    id: int
    email: str
    display_name: str
    avatar_url: Optional[str]
    role: str
    google_id: Optional[str]

    model_config = {"from_attributes": True}
