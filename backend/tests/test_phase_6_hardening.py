from fastapi.routing import APIRoute

from app.auth.security import require_admin
from app.main import ALLOWED_ORIGINS, app
from app.models.schemas import (
    CheckpointResponseOut,
    ConversationGuideOut,
    FamilyMessageOut,
    FamilySessionOut,
    PublishedScenarioOut,
)


def test_every_admin_route_requires_admin_role() -> None:
    admin_routes = [route for route in app.routes if isinstance(route, APIRoute) and route.path.startswith("/api/admin/")]
    assert admin_routes
    for route in admin_routes:
        assert any(dependency.call is require_admin for dependency in route.dependant.dependencies), route.path


def test_family_serializers_exclude_internal_diagnostics_and_grading() -> None:
    prohibited = {"score", "grade", "accuracy", "mistakes", "trust", "suspicion", "hidden_objective", "prompt", "events", "disclosure_flagged"}
    serializers = (PublishedScenarioOut, FamilySessionOut, FamilyMessageOut, CheckpointResponseOut, ConversationGuideOut)
    assert all(prohibited.isdisjoint(serializer.model_fields) for serializer in serializers)


def test_cors_origins_are_explicit() -> None:
    assert ALLOWED_ORIGINS
    assert "*" not in ALLOWED_ORIGINS
