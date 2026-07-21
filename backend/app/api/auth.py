"""Auth endpoints — register, login, refresh, OAuth."""
from __future__ import annotations

import os
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.jwt import create_access_token, create_refresh_token, decode_token
from app.auth.oauth import get_google_auth_url, exchange_code_for_user
from app.auth.schemas import RegisterRequest, LoginRequest, TokenResponse, RefreshRequest, UserOut
from app.auth.security import hash_password, verify_password, get_current_user
from app.models.orm import User, get_db

router = APIRouter(prefix="/api/auth", tags=["Auth"])

APP_BASE_URL = os.getenv("APP_BASE_URL", "http://localhost:5173")


def _make_tokens(user: User) -> TokenResponse:
    data = {"sub": str(user.id), "role": user.role}
    return TokenResponse(
        access_token=create_access_token(data),
        refresh_token=create_refresh_token(data),
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(body: RegisterRequest, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
        role="user",
    )
    db.add(user); db.commit(); db.refresh(user)
    return _make_tokens(user)


@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == body.email, User.is_active == True).first()
    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return _make_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(body: RefreshRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise JWTError("wrong type")
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == user_id, User.is_active == True).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return _make_tokens(user)


@router.get("/me", response_model=UserOut)
def me(current_user: User = Depends(get_current_user)):
    return current_user


# ── Google OAuth ──────────────────────────────────────────────────────────────

@router.get("/google")
def google_login():
    """Redirect to Google's OAuth consent screen."""
    return RedirectResponse(get_google_auth_url())


@router.get("/google/callback")
async def google_callback(code: str, db: Session = Depends(get_db)):
    """Exchange Google code for JWT and redirect to frontend."""
    try:
        profile = await exchange_code_for_user(code)
    except Exception:
        raise HTTPException(status_code=400, detail="Google OAuth failed")

    google_id = profile.get("sub") or profile.get("id")
    email     = profile.get("email", "")
    name      = profile.get("name", email.split("@")[0])
    picture   = profile.get("picture")

    # Find or create user
    user = (
        db.query(User).filter(User.google_id == google_id).first()
        or db.query(User).filter(User.email == email).first()
    )
    if user:
        if not user.google_id:
            user.google_id = google_id
        if picture and not user.avatar_url:
            user.avatar_url = picture
        db.commit()
    else:
        user = User(email=email, display_name=name, avatar_url=picture, google_id=google_id, role="user")
        db.add(user); db.commit(); db.refresh(user)

    tokens = _make_tokens(user)
    # Redirect to frontend with tokens in query params (frontend stores them)
    redirect_url = (
        f"{APP_BASE_URL}/auth/callback"
        f"?access_token={tokens.access_token}"
        f"&refresh_token={tokens.refresh_token}"
        f"&role={user.role}"
    )
    return RedirectResponse(redirect_url)
