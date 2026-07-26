"""Privacy-safe structured operational telemetry.

This module deliberately permits only small, allow-listed operational
dimensions. It has no persistence layer and must never receive raw child text,
disclosures, invitation secrets, answer keys, or opaque identifiers.
"""
from __future__ import annotations

import json
import logging
from collections.abc import Mapping
from typing import Any


logger = logging.getLogger("safequest.telemetry")

ALLOWED_EVENTS = frozenset({
    "family.command.failed", "family.session.transition", "family.stream.reconnect",
    "companion.fallback", "companion.hint", "invitation.failure",
    "invitation.success", "admin.diagnostics", "skin.fallback", "session.completed",
})
ALLOWED_DIMENSIONS = frozenset({"command", "reason", "channel", "transport", "status", "feature", "source"})
PRIVATE_MARKERS = ("reasoning", "disclosure", "secret", "token", "answer", "email", "text", "message", "session", "user", "member", "invite")


def sanitize_attributes(attributes: Mapping[str, Any]) -> dict[str, str | int | bool]:
    """Drop all unknown or potentially identifying attributes before logging."""
    clean: dict[str, str | int | bool] = {}
    for key, value in attributes.items():
        lowered = key.lower()
        if key not in ALLOWED_DIMENSIONS or any(marker in lowered for marker in PRIVATE_MARKERS):
            continue
        if isinstance(value, (bool, int)):
            clean[key] = value
        elif isinstance(value, str):
            clean[key] = value[:80]
    return clean


def record(event: str, /, **attributes: Any) -> None:
    """Emit one scrubbed operational event without retaining user content."""
    if event not in ALLOWED_EVENTS:
        raise ValueError(f"Telemetry event {event!r} is not allow-listed")
    logger.info("safequest_telemetry %s", json.dumps({"event": event, "attributes": sanitize_attributes(attributes)}, sort_keys=True))
