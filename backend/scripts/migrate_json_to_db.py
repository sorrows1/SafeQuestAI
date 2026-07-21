#!/usr/bin/env python3
"""
migrate_json_to_db.py
─────────────────────
One-time migration: reads all JSON config files and upserts them into PostgreSQL.
Safe to re-run (idempotent).

Usage:
  cd /app
  python scripts/migrate_json_to_db.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path
from dotenv import load_dotenv

# Ensure app is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.orm import SessionLocal, create_tables
from app.repositories import content_repo
from app.models.content_schemas import (
    ScenarioDefinition, PersonaDefinition, StageDefinition,
    ObjectiveDefinition, ConstraintDefinition, PromptTemplate,
)

# Load the root .env file so we can connect to the database locally
env_path = Path(__file__).parent.parent.parent / ".env"
load_dotenv(dotenv_path=env_path, override=True)

CONFIG_DIR = Path(__file__).parent.parent / "app" / "config"


def migrate():
    create_tables()
    db = SessionLocal()
    counts = {k: 0 for k in ["scenarios", "personas", "stages", "objectives", "constraints", "prompts"]}

    try:
        # ── Scenarios ──────────────────────────────────────────────────────
        scenarios_dir = CONFIG_DIR / "scenarios"
        if scenarios_dir.exists():
            for scenarios_file in scenarios_dir.glob("*.json"):
                data = json.loads(scenarios_file.read_text())
                sid = data.get("id", scenarios_file.stem)
                data.setdefault("id", sid)
                try:
                    s = ScenarioDefinition(**data)
                    content_repo.upsert_scenario(db, s)
                    counts["scenarios"] += 1
                except Exception as e:
                    print(f"  [WARN] Scenario {sid}: {e}")

        # ── Personas ───────────────────────────────────────────────────────
        personas_file = CONFIG_DIR / "personas.json"
        if personas_file.exists():
            data = json.loads(personas_file.read_text())
            for pid, pdata in data.items():
                pdata.setdefault("id", pid)
                try:
                    p = PersonaDefinition(**pdata)
                    content_repo.upsert_persona(db, p)
                    counts["personas"] += 1
                except Exception as e:
                    print(f"  [WARN] Persona {pid}: {e}")

        # ── Stages ────────────────────────────────────────────────────────
        stages_file = CONFIG_DIR / "stages.json"
        if stages_file.exists():
            data = json.loads(stages_file.read_text())
            for stid, stdata in data.items():
                stdata.setdefault("id", stid)
                try:
                    s = StageDefinition(**stdata)
                    content_repo.upsert_stage(db, s)
                    counts["stages"] += 1
                except Exception as e:
                    print(f"  [WARN] Stage {stid}: {e}")

        # ── Objectives ────────────────────────────────────────────────────
        objectives_file = CONFIG_DIR / "objectives.json"
        if objectives_file.exists():
            data = json.loads(objectives_file.read_text())
            for oid, odata in data.items():
                odata.setdefault("id", oid)
                try:
                    o = ObjectiveDefinition(**odata)
                    content_repo.upsert_objective(db, o)
                    counts["objectives"] += 1
                except Exception as e:
                    print(f"  [WARN] Objective {oid}: {e}")

        # ── Constraints ───────────────────────────────────────────────────
        constraints_file = CONFIG_DIR / "constraints.json"
        if constraints_file.exists():
            data = json.loads(constraints_file.read_text())
            for cid, cdata in data.items():
                cdata.setdefault("id", cid)
                try:
                    c = ConstraintDefinition(**cdata)
                    content_repo.upsert_constraint(db, c)
                    counts["constraints"] += 1
                except Exception as e:
                    print(f"  [WARN] Constraint {cid}: {e}")

        # ── Prompt Templates ──────────────────────────────────────────────
        prompts_dir = CONFIG_DIR / "prompts"
        if prompts_dir.exists():
            for txt_file in prompts_dir.glob("*.txt"):
                name = txt_file.stem
                content = txt_file.read_text(encoding="utf-8")
                # Simple variable extraction: find {var_name} patterns
                import re
                variables = list(dict.fromkeys(re.findall(r"\{(\w+)\}", content)))
                try:
                    t = PromptTemplate(name=name, content=content, variables=variables, description="")
                    content_repo.upsert_prompt(db, t)
                    counts["prompts"] += 1
                except Exception as e:
                    print(f"  [WARN] Prompt {name}: {e}")

    finally:
        db.close()

    print("\n✅ Migration complete:")
    for k, v in counts.items():
        print(f"   {k:15s}: {v} records")


if __name__ == "__main__":
    migrate()
