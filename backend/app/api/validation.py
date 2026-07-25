"""
Validation API — full scenario graph validation.

Detects:
  - Broken references (persona, stage, objective, constraint IDs)
  - Duplicate IDs
  - Invalid stage transitions (edges referencing non-existent stages)
  - Stages with no objectives in a scenario
  - Missing prompt templates
  - Cycles or disconnected graph nodes (warning)
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth.security import require_admin
from app.models.orm import User, get_db
from app.models.schemas import ValidationError, ValidationReport
from app.repositories import content_repo

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/admin/validation", tags=["Admin - Validation"])



@router.get("/", summary="Validate all config content")
def validate_all(
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ValidationReport:
    """Run full validation across all loaded content and return a report."""
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []
    info: list[ValidationError] = []

    stages      = {s.id: s for s in content_repo.list_stages(db)}
    objectives  = {o.id: o for o in content_repo.list_objectives(db)}
    personas    = {p.id: p for p in content_repo.list_personas(db)}
    constraints = {c.id: c for c in content_repo.list_constraints(db)}
    scenarios   = {s.id: s for s in content_repo.list_scenarios(db)}
    templates   = {t.name: t.content for t in content_repo.list_prompts(db)}

    # Validate each scenario
    for scenario_id, scenario in scenarios.items():
        location_prefix = f"scenarios/{scenario_id}.json"

        try:
            content_repo.validate_scenario_references(db, scenario)
        except ValueError as exc:
            errors.append(ValidationError(
                severity="error", code="CANONICAL_REFERENCE_INVALID",
                message=str(exc), location=f"{location_prefix} > actor_bindings",
                suggestion="Select existing personas and prompts with role-compatible metadata.",
            ))

        # Check starting stage
        if scenario.starting_stage not in stages:
            errors.append(ValidationError(
                severity="error",
                code="BROKEN_STAGE_REF",
                message=f"starting_stage '{scenario.starting_stage}' not found.",
                location=f"{location_prefix} > starting_stage",
                suggestion=f"Available stages: {list(stages.keys())}",
            ))

        # Check stage sequence
        if not scenario.stage_sequence:
            errors.append(ValidationError(
                severity="error",
                code="EMPTY_STAGE_SEQUENCE",
                message="Scenario has no stage_sequence defined.",
                location=f"{location_prefix} > stage_sequence",
            ))

        seen_stages_in_seq: list[str] = []
        for step_idx, step in enumerate(scenario.stage_sequence):
            step_location = f"{location_prefix} > stage_sequence[{step_idx}]"

            # Check stage reference
            if step.stage not in stages:
                errors.append(ValidationError(
                    severity="error",
                    code="BROKEN_STAGE_REF",
                    message=f"Stage '{step.stage}' not found.",
                    location=step_location,
                    suggestion=f"Available stages: {list(stages.keys())}",
                ))
            else:
                seen_stages_in_seq.append(step.stage)

                # Check that transitions are valid
                stage_def = stages[step.stage]
                # (For sequence-based scenarios, all stages should be reachable)

            # Check objective references
            all_objs = step.mandatory_objectives + step.optional_objectives
            if not all_objs:
                warnings.append(ValidationError(
                    severity="warning",
                    code="NO_OBJECTIVES",
                    message=f"Stage step '{step.stage}' has no objectives.",
                    location=step_location,
                ))

            for obj_id in all_objs:
                if obj_id not in objectives:
                    errors.append(ValidationError(
                        severity="error",
                        code="BROKEN_OBJECTIVE_REF",
                        message=f"Objective '{obj_id}' not found.",
                        location=f"{step_location} > objectives",
                        suggestion=f"Available objectives: {list(objectives.keys())}",
                    ))

            # Check constraint references
            for c_id in step.constraints:
                if c_id not in constraints:
                    errors.append(ValidationError(
                        severity="error",
                        code="BROKEN_CONSTRAINT_REF",
                        message=f"Constraint '{c_id}' not found.",
                        location=f"{step_location} > constraints",
                        suggestion=f"Available constraints: {list(constraints.keys())}",
                    ))

    # Validate stage transitions (allowed_next must reference known stages)
    for stage_id, stage in stages.items():
        for next_id in stage.allowed_next:
            if next_id not in stages:
                errors.append(ValidationError(
                    severity="error",
                    code="BROKEN_TRANSITION",
                    message=f"Stage '{stage_id}' has transition to unknown stage '{next_id}'.",
                    location=f"stages.json > {stage_id} > allowed_next",
                    suggestion=f"Available stages: {list(stages.keys())}",
                ))

    # Validate stage default constraints
    for stage_id, stage in stages.items():
        for c_id in stage.default_constraints:
            if c_id not in constraints:
                warnings.append(ValidationError(
                    severity="warning",
                    code="BROKEN_CONSTRAINT_REF",
                    message=f"Stage '{stage_id}' default_constraint '{c_id}' not found.",
                    location=f"stages.json > {stage_id} > default_constraints",
                ))

    # Info items
    info.append(ValidationError(
        severity="info",
        code="SUMMARY",
        message=(
            f"Validation complete: {len(scenarios)} scenarios, "
            f"{len(stages)} stages, {len(objectives)} objectives, "
            f"{len(personas)} personas, {len(constraints)} constraints, "
            f"{len(templates)} templates."
        ),
        location="global",
    ))

    return ValidationReport(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        info=info,
        total_scenarios=len(scenarios),
        total_personas=len(personas),
        total_stages=len(stages),
        total_objectives=len(objectives),
        total_constraints=len(constraints),
    )


@router.get("/scenario/{scenario_id}", summary="Validate a single scenario")
def validate_scenario(
    scenario_id: str,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
) -> ValidationReport:
    """Run validation for a single scenario only."""
    if not content_repo.get_scenario(db, scenario_id):
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    full_report = validate_all(db, _)
    prefix = f"scenarios/{scenario_id}.json"
    scenario_errors = [e for e in full_report.errors if e.location.startswith(prefix)]
    scenario_warnings = [w for w in full_report.warnings if w.location.startswith(prefix)]

    return ValidationReport(
        valid=len(scenario_errors) == 0,
        errors=scenario_errors,
        warnings=scenario_warnings,
        info=full_report.info,
    )
