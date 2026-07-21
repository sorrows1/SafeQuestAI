"""JWT token creation and verification."""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any

from jose import  jwt

SECRET_KEY = os.getenv("JWT_SECRET", "insecure-dev-secret")
ALGORITHM  = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_EXPIRE_MINUTES  = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))
REFRESH_EXPIRE_DAYS    = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "30"))


def create_access_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE_MINUTES)
    payload["type"] = "access"
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict[str, Any]) -> str:
    payload = data.copy()
    payload["exp"] = datetime.now(timezone.utc) + timedelta(days=REFRESH_EXPIRE_DAYS)
    payload["type"] = "refresh"
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def decode_token(token: str) -> dict[str, Any]:
    """Raises JWTError on invalid/expired token."""
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
