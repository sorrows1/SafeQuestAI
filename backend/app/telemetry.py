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

# Keys alone are not enough: a caller could otherwise put private prose in a
# harmless-looking ``status`` field. Operational dimensions are deliberately
# finite enums, which also makes dashboards safe to aggregate.
ALLOWED_VALUES = {
    "command": frozenset({
        "start", "reveal_next", "continue_checkpoint", "enter_completion_review",
        "acknowledge_completion", "open_help", "complete", "reset", "restart",
    }),
    "reason": frozenset({"stale_state", "unavailable", "provider_unavailable", "provider_failure"}),
    "channel": frozenset({"family", "solo", "checkpoint", "flag_attempt", "private_child"}),
    "transport": frozenset({"sse"}),
    "status": frozenset({
        "created", "waiting_for_participants", "in_progress", "checkpoint",
        "completion_review", "help_and_resources", "completed", "abandoned",
        "expired", "paused_for_support", "accepted",
    }),
    "feature": frozenset({
        "scene_contract", "gameplay_shell", "flag_attempts", "relationships",
        "multiplayer_events", "admin_diagnostics", "new_solo_sessions",
    }),
    "source": frozenset({"run_history", "run_detail", "event_history", "event_stream", "skin_router"}),
}


def sanitize_attributes(attributes: Mapping[str, Any]) -> dict[str, str | int | bool]:
    """Drop all unknown or potentially identifying attributes before logging."""
    clean: dict[str, str | int | bool] = {}
    for key, value in attributes.items():
        lowered = key.lower()
        if key not in ALLOWED_DIMENSIONS or any(marker in lowered for marker in PRIVATE_MARKERS):
            continue
        # All currently approved dimensions are low-cardinality strings. Do
        # not accept booleans/integers until a specific aggregation need is
        # approved and documented here.
        if isinstance(value, str) and value in ALLOWED_VALUES[key]:
            clean[key] = value
    return clean


def record(event: str, /, **attributes: Any) -> None:
    """Emit one scrubbed operational event without retaining user content."""
    if event not in ALLOWED_EVENTS:
        raise ValueError(f"Telemetry event {event!r} is not allow-listed")
    logger.info("safequest_telemetry %s", json.dumps({"event": event, "attributes": sanitize_attributes(attributes)}, sort_keys=True))
