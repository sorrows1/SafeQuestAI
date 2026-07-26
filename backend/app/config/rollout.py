"""Server-side rollout controls for additive Safe Quest releases.

Flags are intentionally environment-backed: toggling presentation or a new
workflow never rolls back schema or mutates existing session records.
"""
from __future__ import annotations

import os
from enum import StrEnum

from fastapi import HTTPException, status


class FeatureFlag(StrEnum):
    SCENE_CONTRACT = "scene_contract"
    GAMEPLAY_SHELL = "gameplay_shell"
    FLAG_ATTEMPTS = "flag_attempts"
    RELATIONSHIPS = "relationships"
    MULTIPLAYER_EVENTS = "multiplayer_events"
    ADMIN_DIAGNOSTICS = "admin_diagnostics"
    NEW_SOLO_SESSIONS = "new_solo_sessions"


def _environment_name(flag: FeatureFlag) -> str:
    return f"SAFE_QUEST_FEATURE_{flag.value.upper()}"


def is_enabled(flag: FeatureFlag) -> bool:
    """Return the current flag value; unset flags are enabled for this release."""
    value = os.getenv(_environment_name(flag), "true").strip().lower()
    return value in {"1", "true", "yes", "on"}


def rollout_status() -> dict[str, bool]:
    return {flag.value: is_enabled(flag) for flag in FeatureFlag}


def require_feature(flag: FeatureFlag) -> None:
    if not is_enabled(flag):
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="This feature is not enabled for this rollout.",
        )
