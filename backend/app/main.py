"""
Safe Quest API — main FastAPI application.

Startup sequence:
  1. Create DB tables.
  2. Initialise ScenarioLoader and load all JSON config.
  3. Initialise LLMService.
  4. Register all routers.
  5. Mount static frontend files (for production serving).
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.engine.scenario_loader import ScenarioLoader
from app.llm.llm_service import LLMService
from app.models.orm import create_tables

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config paths
# ---------------------------------------------------------------------------
CONFIG_DIR = Path(__file__).parent / "config"

# ---------------------------------------------------------------------------
# Singletons — instantiated at startup, injected via dependency
# ---------------------------------------------------------------------------
scenario_loader = ScenarioLoader(CONFIG_DIR)
llm_service: LLMService | None = None


# ---------------------------------------------------------------------------
# Lifespan
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global llm_service

    # Create DB tables
    logger.info("Creating database tables...")
    create_tables()

    # Load all JSON config content
    logger.info("Loading scenario content from: %s", CONFIG_DIR)
    scenario_loader.load_all()

    # Initialise LLM service
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
    description="Scenario Authoring & Dialogue Simulation Platform",
    version="2.0.0",
    lifespan=lifespan,
)

# ---------------------------------------------------------------------------
# CORS — allow frontend dev server and production origin
# ---------------------------------------------------------------------------
ALLOWED_ORIGINS = [
    "http://localhost:5173",   # Vite dev server
    "http://localhost:3000",   # Alternative dev port
    "http://localhost:8000",   # Same-origin (production static serving)
    "*",                       # Heroku / cloud — restrict in production!
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
from app.api.scenarios import router as scenarios_router
from app.api.personas import router as personas_router
from app.api.stages import router as stages_router
from app.api.objectives import router as objectives_router
from app.api.constraints import router as constraints_router
from app.api.prompts import router as prompts_router
from app.api.simulator import router as simulator_router
from app.api.validation import router as validation_router

app.include_router(scenarios_router)
app.include_router(personas_router)
app.include_router(stages_router)
app.include_router(objectives_router)
app.include_router(constraints_router)
app.include_router(prompts_router)
app.include_router(simulator_router)
app.include_router(validation_router)


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------
@app.get("/api/health", tags=["Health"])
def health_check():
    return {
        "status": "ok",
        "scenarios": len(scenario_loader.all_scenarios()),
        "personas": len(scenario_loader.all_personas()),
        "stages": len(scenario_loader.all_stages()),
        "objectives": len(scenario_loader.all_objectives()),
        "constraints": len(scenario_loader.all_constraints()),
        "llm_available": llm_service is not None,
    }


@app.get("/api/config/summary", tags=["Health"])
def config_summary():
    """Returns a quick summary of all loaded content — used by Dashboard."""
    return {
        "scenarios": [
            {"id": s.id, "display_name": s.display_name, "difficulty": s.difficulty}
            for s in scenario_loader.all_scenarios().values()
        ],
        "personas": list(scenario_loader.all_personas().keys()),
        "stages": list(scenario_loader.all_stages().keys()),
        "objectives": list(scenario_loader.all_objectives().keys()),
        "constraints": list(scenario_loader.all_constraints().keys()),
        "prompt_templates": list(scenario_loader.all_prompt_templates().keys()),
    }


# ---------------------------------------------------------------------------
# Static files — serve the React build in production
# ---------------------------------------------------------------------------
STATIC_DIR = Path(__file__).parent.parent.parent / "frontend" / "dist"

if STATIC_DIR.exists():
    logger.info("Serving frontend static files from: %s", STATIC_DIR)
    # Mount assets directory
    app.mount("/assets", StaticFiles(directory=STATIC_DIR / "assets"), name="assets")

    # SPA fallback — serve index.html for all non-API routes
    from fastapi.responses import FileResponse

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_spa(full_path: str):
        index = STATIC_DIR / "index.html"
        return FileResponse(str(index))
else:
    logger.info("Frontend static build not found — API-only mode.")
