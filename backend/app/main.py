"""
Safe Quest API — FastAPI application entry point.

Startup sequence:
  1. Create/migrate DB tables.
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

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.llm.llm_service import LLMService
from app.models.orm import create_tables, SessionLocal, User

logger = logging.getLogger(__name__)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)

# ---------------------------------------------------------------------------
# Global singleton — injected into routers that need it
# ---------------------------------------------------------------------------
llm_service: LLMService | None = None


# ---------------------------------------------------------------------------
# Admin seeding
# ---------------------------------------------------------------------------
def _seed_admin() -> None:
    from app.auth.security import hash_password

    email    = os.getenv("ADMIN_EMAIL")
    password = os.getenv("ADMIN_PASSWORD")
    name     = os.getenv("ADMIN_DISPLAY_NAME", "Administrator")
    if not email or not password:
        logger.info("ADMIN_EMAIL/ADMIN_PASSWORD not set — skipping admin seed.")
        return

    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            if existing.role != "admin":
                existing.role = "admin"
                db.commit()
                logger.info("Upgraded existing user %s to admin.", email)
            return

        admin = User(
            email=email,
            hashed_password=hash_password(password),
            display_name=name,
            role="admin",
        )
        db.add(admin)
        db.commit()
        logger.info("Seeded admin account: %s", email)
    finally:
        db.close()


def _init_db() -> None:
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine.url import make_url
    from app.models.orm import DATABASE_URL, create_tables
    import subprocess
    import sys
    from pathlib import Path

    was_created = False
    try:
        url = make_url(DATABASE_URL)
        db_name = url.database
        
        if db_name:
            postgres_url = url.set(database="postgres")
            engine = create_engine(postgres_url, isolation_level="AUTOCOMMIT")
            
            with engine.connect() as conn:
                result = conn.execute(
                    text("SELECT 1 FROM pg_database WHERE datname = :db"),
                    {"db": db_name}
                ).scalar()
                
                if not result:
                    logger.info("Database '%s' does not exist. Creating...", db_name)
                    conn.execute(text(f'CREATE DATABASE "{db_name}"'))
                    was_created = True
                else:
                    logger.info("Database '%s' already exists.", db_name)
    except Exception as e:
        logger.warning("Could not check or create database: %s", e)

    logger.info("Creating database tables...")
    create_tables()
    
    if was_created:
        logger.info("Running initial JSON-to-DB migration script...")
        script_path = Path(__file__).parent.parent / "scripts" / "migrate_json_to_db.py"
        try:
            subprocess.run([sys.executable, str(script_path)], check=True)
            logger.info("Migration script completed successfully.")
        except subprocess.CalledProcessError as e:
            logger.error("Migration script failed: %s", e)
        except Exception as e:
            logger.error("Failed to run migration script: %s", e)


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global llm_service

    _init_db()

    logger.info("Seeding admin account...")
    _seed_admin()

    try:
        llm_service = LLMService()
        logger.info("LLMService initialised.")
    except RuntimeError as exc:
        logger.warning("LLMService could not be initialised: %s", exc)
        llm_service = None  # type: ignore[assignment]

    logger.info("Safe Quest API startup complete.")
    yield
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
    "http://localhost:5173",
    "http://localhost:3000",
    "http://localhost:8000",
    "*",
]

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
from app.api.simulator    import router as simulator_router
from app.api.validation   import router as validation_router
from app.api.admin_users  import router as admin_users_router
from app.api.admin_generation import router as admin_generation_router
from app.api.family_sessions import router as family_sessions_router
from app.api.companion import router as companion_router

app.include_router(auth_router)
app.include_router(scenarios_router)
app.include_router(personas_router)
app.include_router(stages_router)
app.include_router(objectives_router)
app.include_router(constraints_router)
app.include_router(prompts_router)
app.include_router(simulator_router)
app.include_router(validation_router)
app.include_router(admin_users_router)
app.include_router(admin_generation_router)
app.include_router(family_sessions_router)
app.include_router(companion_router)


# ---------------------------------------------------------------------------
# Health
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["Health"])
def health_check():
    return {"status": "ok", "llm_available": llm_service is not None}


@app.get("/api/admin/config/summary", tags=["Admin - Health"])
def config_summary(db=None):
    """Admin dashboard summary."""
    from app.repositories import content_repo
    from app.models.orm import get_db
    from fastapi import Depends
    # This is called directly, so we open a session here
    from app.models.orm import SessionLocal
    db = SessionLocal()
    try:
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
        }
    finally:
        db.close()


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
