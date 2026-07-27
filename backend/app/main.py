"""
Safe Quest API — FastAPI application entry point.

Startup sequence:
  1. Verify the database has been migrated with Alembic.
  2. Seed admin account (if ADMIN_EMAIL env var is set and no admin exists).
  3. Initialise LLMService.
  4. Register all routers.
  5. Mount static frontend files (production).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.llm.llm_service import LLMService
from app.config.rollout import rollout_status
from app.models.orm import CuratedTranscript, SessionLocal, SimulationRun, User, get_db

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ---------------------------------------------------------------------------
# Global singleton — injected into routers that need it
# ---------------------------------------------------------------------------
llm_service: LLMService | None = None




# Keep this explicit instead of calling ``create_all`` at startup. A deploy
# that has not run the latest migration must fail fast rather than quietly
# serving a partially upgraded contract.
EXPECTED_SCHEMA_REVISION = "20260727_phase9_authoring_quality"

def _init_db() -> None:
    """Verify the database has been migrated; startup never changes schema."""
    from sqlalchemy import text

    db = SessionLocal()
    try:
        version = db.execute(text("SELECT version_num FROM alembic_version")).scalar_one_or_none()
    except Exception as exc:
        raise RuntimeError(
            "Database schema is not managed by Alembic. Run `alembic upgrade head` before starting Safe Quest."
        ) from exc
    finally:
        db.close()

    if version != EXPECTED_SCHEMA_REVISION:
        raise RuntimeError(
            f"Database schema revision is {version or 'none'}; expected {EXPECTED_SCHEMA_REVISION}. "
            "Run `alembic upgrade head` before starting Safe Quest."
        )


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global llm_service

    _init_db()


    try:
        llm_service = LLMService()
        logger.info("LLMService initialised.")
        from app.api.admin_simulations import runtime as simulation_runtime
        recovered = simulation_runtime.recover()
        logger.info("Scheduled recovery for %d durable simulation run(s).", recovered)
    except RuntimeError as exc:
        logger.warning("LLMService could not be initialised: %s", exc)
        llm_service = None  # type: ignore[assignment]

    logger.info("Safe Quest API startup complete.")
    yield
    if llm_service is not None:
        from app.api.admin_simulations import runtime as simulation_runtime
        simulation_runtime.shutdown()
    logger.info("Safe Quest API shutting down.")


# ---------------------------------------------------------------------------
# Application
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Safe Quest API",
    description="Educational Dialogue Platform",
    version="3.0.0",
    lifespan=lifespan,
)

ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv(
        "CORS_ALLOWED_ORIGINS",
        "http://localhost:5173,http://localhost:3000,http://localhost:8000",
    ).split(",")
    if origin.strip()
]
if not ALLOWED_ORIGINS or any(origin == "*" for origin in ALLOWED_ORIGINS):
    raise RuntimeError("CORS_ALLOWED_ORIGINS must contain one or more explicit origins and must not contain '*'.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
from app.api.auth         import router as auth_router
from app.api.scenarios    import router as scenarios_router
from app.api.personas     import router as personas_router
from app.api.stages       import router as stages_router
from app.api.objectives   import router as objectives_router
from app.api.constraints  import router as constraints_router
from app.api.prompts      import router as prompts_router
from app.api.validation   import router as validation_router
from app.api.admin_users  import router as admin_users_router
from app.api.admin_simulations import router as admin_simulations_router
from app.api.family_sessions import router as family_sessions_router
from app.api.family_links import router as family_links_router
from app.api.companion import router as companion_router

app.include_router(auth_router)
app.include_router(scenarios_router)
app.include_router(personas_router)
app.include_router(stages_router)
app.include_router(objectives_router)
app.include_router(constraints_router)
app.include_router(prompts_router)
app.include_router(validation_router)
app.include_router(admin_users_router)
app.include_router(admin_simulations_router)
app.include_router(family_sessions_router)
app.include_router(family_links_router)
app.include_router(companion_router)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "llm_available": llm_service is not None}


from app.auth.security import require_admin


@app.get("/api/admin/config/summary", tags=["Admin - Health"])
def config_summary(db=Depends(get_db), _: User = Depends(require_admin)):
    """Admin dashboard summary."""
    from app.api.validation import validate_all
    from app.repositories import content_repo

    # This summary intentionally uses authoring/publication data only. Family sessions,
    # participants, and private companion exchanges are never queried here.
    validation = validate_all(db, None)
    recently_published = db.query(CuratedTranscript).filter(
        CuratedTranscript.is_published.is_(True)
    ).order_by(CuratedTranscript.published_at.desc()).limit(5).all()
    return {
        "scenarios": [
            {"id": s.id, "display_name": s.display_name, "difficulty": s.difficulty}
            for s in content_repo.list_scenarios(db)
        ],
        "personas": [p.id for p in content_repo.list_personas(db)],
        "stages": [s.id for s in content_repo.list_stages(db)],
        "objectives": [o.id for o in content_repo.list_objectives(db)],
        "constraints": [c.id for c in content_repo.list_constraints(db)],
        "prompt_templates": [t.name for t in content_repo.list_prompts(db)],
        "rollout_flags": rollout_status(),
        "observability": {
            "review_ready_count": db.query(SimulationRun).filter(SimulationRun.status == "ready_for_review").count(),
            "unpublished_approved_transcript_count": db.query(CuratedTranscript).filter(CuratedTranscript.is_published.is_(False)).count(),
            "active_run_count": db.query(SimulationRun).filter(SimulationRun.status.in_(["running", "paused", "awaiting_admin"])).count(),
            "failed_run_count": db.query(SimulationRun).filter(SimulationRun.status.in_(["failed", "failed_retryable", "failed_terminal"])).count(),
            "limited_run_count": db.query(SimulationRun).filter(SimulationRun.status == "limit_reached").count(),
            "validation_blocker_count": len(validation.errors),
            "recently_published": [
                {"id": item.id, "scenario_id": item.source_scenario_id, "category": item.category,
                 "published_at": item.published_at.isoformat() if item.published_at else None}
                for item in recently_published
            ],
            "system_health": {"database": "available", "llm": "available" if llm_service is not None else "unavailable"},
        },
    }


# ---------------------------------------------------------------------------
# Static SPA serving (production)
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

if STATIC_DIR.exists():
    logger.info("Serving frontend from: %s", STATIC_DIR)
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        return FileResponse(str(STATIC_DIR / "index.html"))
else:
    logger.info("Frontend dist not found — API-only mode.")

