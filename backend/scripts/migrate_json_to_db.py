#!/usr/bin/env python3
"""Validate and idempotently seed database-backed content.

Run `alembic upgrade head` before this command. The command never creates or
migrates schema. Use `--dry-run` to validate every source definition without
writing anything.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).parent.parent))

from app.models.content_schemas import (
    ConstraintDefinition, ObjectiveDefinition, PersonaDefinition, PromptTemplate,
    ScenarioDefinition, StageDefinition,
)
from app.models.orm import (
    ContentConstraint, ContentObjective, ContentPersona, ContentPrompt, ContentScenario, ContentStage,
    ConversationMessage, ConversationSession, CuratedMessage, CuratedTranscript, RedFlagSpan, User,
    SessionLocal,
)
from app.repositories import content_repo

load_dotenv(Path(__file__).parent.parent.parent / ".env", override=True)
CONFIG_DIR = Path(__file__).parent.parent / "app" / "config"


@dataclass
class SeedContent:
    scenarios: list[ScenarioDefinition]
    personas: list[PersonaDefinition]
    stages: list[StageDefinition]
    objectives: list[ObjectiveDefinition]
    constraints: list[ConstraintDefinition]
    prompts: list[PromptTemplate]
    demo_fixtures: list[dict]


def _load_mapping(path: Path, model_type):
    data = json.loads(path.read_text(encoding="utf-8"))
    return [model_type(**{**value, "id": value.get("id", key)}) for key, value in data.items()]


def load_seed_content() -> SeedContent:
    errors: list[str] = []
    try:
        scenarios = []
        for path in sorted((CONFIG_DIR / "scenarios").glob("*.json")):
            raw = json.loads(path.read_text(encoding="utf-8"))
            scenarios.append(ScenarioDefinition(**{**raw, "id": raw.get("id", path.stem)}))
        personas = _load_mapping(CONFIG_DIR / "personas.json", PersonaDefinition)
        stages = _load_mapping(CONFIG_DIR / "stages.json", StageDefinition)
        objectives = _load_mapping(CONFIG_DIR / "objectives.json", ObjectiveDefinition)
        constraints = _load_mapping(CONFIG_DIR / "constraints.json", ConstraintDefinition)
        prompt_metadata = json.loads((CONFIG_DIR / "prompts.json").read_text(encoding="utf-8"))
        prompts = []
        for name, metadata in prompt_metadata.items():
            path = CONFIG_DIR / "prompts" / metadata["file"]
            content = path.read_text(encoding="utf-8")
            prompts.append(PromptTemplate(
                name=name, content=content,
                variables=list(dict.fromkeys(re.findall(r"\{(\w+)\}", content))),
                description=metadata.get("description", ""),
                kind=metadata["kind"], role_scope=metadata["role_scope"],
                version=metadata.get("version", "1.0.0"),
            ))
        demo_fixtures = json.loads((CONFIG_DIR / "demo_curated_fixtures.json").read_text(encoding="utf-8"))
        if not isinstance(demo_fixtures, list):
            raise ValueError("demo_curated_fixtures.json must contain a list")
    except Exception as exc:
        errors.append(str(exc))
        scenarios = personas = stages = objectives = constraints = prompts = demo_fixtures = []
    if errors:
        raise ValueError("Seed validation failed: " + "; ".join(errors))
    return SeedContent(scenarios, personas, stages, objectives, constraints, prompts, demo_fixtures)


def _write_or_count(db, kind: str, item, getter, upserter, dry_run: bool, counts: dict[str, dict[str, int]]) -> None:
    existing = getter(db, item.id if hasattr(item, "id") else item.name)
    if existing is None:
        counts[kind]["inserted"] += 1
        if not dry_run:
            upserter(db, item)
    elif existing.model_dump(mode="json") == item.model_dump(mode="json"):
        counts[kind]["unchanged"] += 1
    else:
        model_by_kind = {
            "scenarios": ContentScenario, "personas": ContentPersona, "stages": ContentStage,
            "objectives": ContentObjective, "constraints": ContentConstraint,
        }
        row = db.get(model_by_kind[kind], item.id) if kind in model_by_kind else None
        if row is not None and isinstance(row.data, dict) and row.data.get("_admin_authored"):
            counts[kind]["unchanged"] += 1
        else:
            counts[kind]["updated"] += 1
            if not dry_run:
                upserter(db, item)


def _validate_seed_references(content: SeedContent) -> None:
    personas = {item.id for item in content.personas}
    stages = {item.id for item in content.stages}
    objectives = {item.id for item in content.objectives}
    constraints = {item.id for item in content.constraints}
    prompts = {item.name: item for item in content.prompts}
    errors: list[str] = []
    required_prompts = {
        "simulation_initiator_system": ("system", "initiator"),
        "simulation_respondent_system": ("system", "respondent"),
        "single_pass_authoring_system": ("system", "authoring"),
        "initiator_realistic_dialogue": ("dialogue", "initiator"),
        "respondent_natural_dialogue": ("dialogue", "respondent"),
        "oversharing_decision_authoring": ("single_pass", "authoring"),
    }
    for name, (kind, role_scope) in required_prompts.items():
        prompt = prompts.get(name)
        if prompt is None or prompt.kind != kind or prompt.role_scope != role_scope:
            errors.append(f"required prompt '{name}' must be a {role_scope} {kind} prompt")
    for scenario in content.scenarios:
        if scenario.starting_stage not in stages:
            errors.append(f"{scenario.id}: starting_stage '{scenario.starting_stage}' is missing")
        bindings = (("authoring", scenario.authoring),) if scenario.authoring else (("initiator", scenario.initiator), ("respondent", scenario.respondent))
        for role, binding in bindings:
            if binding is None or binding.persona_id not in personas:
                errors.append(f"{scenario.id}: {role} persona is missing")
                continue
            prompt = prompts.get(binding.dialogue_prompt_id)
            if prompt is None:
                errors.append(f"{scenario.id}: {role} prompt '{binding.dialogue_prompt_id}' is missing")
            elif prompt.kind != ("single_pass" if role == "authoring" else "dialogue") or prompt.role_scope not in {role, "either"}:
                errors.append(f"{scenario.id}: {role} prompt is not role-compatible")
        for step in scenario.stage_sequence:
            if step.stage not in stages:
                errors.append(f"{scenario.id}: stage '{step.stage}' is missing")
            errors.extend(f"{scenario.id}: objective '{item}' is missing" for item in step.mandatory_objectives + step.optional_objectives if item not in objectives)
            errors.extend(f"{scenario.id}: constraint '{item}' is missing" for item in step.constraints if item not in constraints)
    scenario_ids = {scenario.id for scenario in content.scenarios}
    for fixture in content.demo_fixtures:
        fixture_id = fixture.get("id", "<unknown>")
        if fixture.get("source_scenario_id") not in scenario_ids:
            errors.append(f"fixture '{fixture_id}' references an unknown scenario")
        if not fixture.get("messages"):
            errors.append(f"fixture '{fixture_id}' must include messages")
    if errors:
        raise ValueError("; ".join(errors))



def _seed_demo_fixtures(db, fixtures: list[dict], *, dry_run: bool, publish: bool) -> dict[str, int]:
    """Upsert reviewed development fixtures without publishing them by default."""
    from datetime import datetime

    counts = {"inserted": 0, "updated": 0, "unchanged": 0}
    reviewer = db.query(User).filter(User.role == "admin").order_by(User.id).first()
    for fixture in fixtures:
        fixture_id = fixture["id"]
        transcript = next((item for item in db.query(CuratedTranscript).all()
                           if (item.public_metadata_snapshot or {}).get("demo_fixture_id") == fixture_id), None)
        if transcript is None:
            counts["inserted"] += 1
            if dry_run:
                continue
            if reviewer is None:
                raise ValueError("Demo fixtures require an existing admin reviewer; set ADMIN_EMAIL/ADMIN_PASSWORD before seeding")
            source = ConversationSession(scenario_id=fixture["source_scenario_id"], difficulty=fixture["difficulty"], state={"demo_fixture_id": fixture_id, "human_reviewed": True})
            db.add(source); db.flush()
            transcript = CuratedTranscript(
                source_session_id=source.id, source_scenario_id=fixture["source_scenario_id"],
                is_concerning_example=True, difficulty=fixture["difficulty"], tactic_tags=fixture.get("tactic_tags", []),
                reviewed_by=reviewer.id, reviewed_at=datetime.fromisoformat(fixture["reviewed_at"].replace("Z", "+00:00")),
                is_published=publish, category=fixture["category"], render_skin=fixture["render_skin"],
                public_metadata_snapshot={**fixture["public_metadata"], "demo_fixture_id": fixture_id},
            )
            db.add(transcript); db.flush()
        else:
            snapshot = {**fixture["public_metadata"], "demo_fixture_id": fixture_id}
            unchanged = transcript.source_scenario_id == fixture["source_scenario_id"] and transcript.public_metadata_snapshot == snapshot
            counts["unchanged" if unchanged else "updated"] += 1
            if dry_run or (unchanged and transcript.is_published == publish):
                continue
            transcript.source_scenario_id = fixture["source_scenario_id"]
            transcript.category, transcript.render_skin = fixture["category"], fixture["render_skin"]
            transcript.difficulty, transcript.tactic_tags = fixture["difficulty"], fixture.get("tactic_tags", [])
            transcript.public_metadata_snapshot = snapshot
            transcript.is_published = publish
        if not dry_run:
            db.query(ConversationMessage).filter(ConversationMessage.session_id == transcript.source_session_id).delete()
            db.query(CuratedMessage).filter(CuratedMessage.transcript_id == transcript.id).delete()
            db.query(RedFlagSpan).filter(RedFlagSpan.transcript_id == transcript.id).delete()
            for message in fixture["messages"]:
                metadata = {"is_checkpoint": message.get("is_checkpoint", False)}
                db.add(ConversationMessage(session_id=transcript.source_session_id, sequence=message["sequence"], sender=message["speaker_label"], content=message["content"], metadata_json=metadata))
                db.add(CuratedMessage(transcript_id=transcript.id, sequence=message["sequence"], speaker_label=message["speaker_label"], content=message["content"], pace=message.get("pace", "normal"), is_checkpoint=message.get("is_checkpoint", False), checkpoint_prompt=message.get("checkpoint_prompt")))
            for span in fixture.get("red_flag_spans", []):
                db.add(RedFlagSpan(transcript_id=transcript.id, message_sequence=span["message_sequence"], tactic_tag=span["tactic_tag"], source="human_reviewed"))
    return counts


def seed(dry_run: bool = False, publish_demo_fixtures: bool = False) -> dict[str, dict[str, int]]:
    if publish_demo_fixtures and os.getenv("SAFE_QUEST_ENV", "development").lower() != "development":
        raise ValueError("--publish-demo-fixtures is allowed only when SAFE_QUEST_ENV=development")
    content = load_seed_content()
    _validate_seed_references(content)
    counts = {kind: {"inserted": 0, "updated": 0, "unchanged": 0} for kind in (
        "scenarios", "personas", "stages", "objectives", "constraints", "prompts"
    )}
    db = SessionLocal()
    try:
        # Reference validation is intentionally performed only after all source
        # models are parsed; later seed phases can add canonical prompt/persona
        # definitions without changing this command.
        for item, getter, upserter, kind in (
            (content.personas, content_repo.get_persona, content_repo.upsert_persona, "personas"),
            (content.stages, content_repo.get_stage, content_repo.upsert_stage, "stages"),
            (content.objectives, content_repo.get_objective, content_repo.upsert_objective, "objectives"),
            (content.constraints, content_repo.get_constraint, content_repo.upsert_constraint, "constraints"),
            (content.prompts, content_repo.get_prompt, content_repo.upsert_prompt, "prompts"),
        ):
            for definition in item:
                _write_or_count(db, kind, definition, getter, upserter, dry_run, counts)
        for scenario in content.scenarios:
            if not dry_run:
                try:
                    content_repo.validate_scenario_references(db, scenario)
                except ValueError as exc:
                    raise ValueError(f"Scenario {scenario.id}: {exc}") from exc
            _write_or_count(db, "scenarios", scenario, content_repo.get_scenario, content_repo.upsert_scenario, dry_run, counts)
        counts["demo_fixtures"] = _seed_demo_fixtures(db, content.demo_fixtures, dry_run=dry_run, publish=publish_demo_fixtures)
        if dry_run:
            db.rollback()
        else:
            db.commit()
        return counts
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


def main() -> int:
    parser = argparse.ArgumentParser(description="Validate and idempotently seed Safe Quest content")
    parser.add_argument("--dry-run", action="store_true", help="validate all content without writing")
    parser.add_argument("--publish-demo-fixtures", action="store_true", help="publish demo fixtures only in SAFE_QUEST_ENV=development")
    args = parser.parse_args()
    try:
        counts = seed(dry_run=args.dry_run, publish_demo_fixtures=args.publish_demo_fixtures)
    except ValueError as exc:
        print(f"Seed validation failed: {exc}", file=sys.stderr)
        return 2
    for kind, result in counts.items():
        print(f"{kind}: inserted={result['inserted']} updated={result['updated']} unchanged={result['unchanged']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
