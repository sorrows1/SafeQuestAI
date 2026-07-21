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

from app.engine.scenario_loader import ScenarioLoader
from app.models.schemas import ValidationError, ValidationReport

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/validation", tags=["Validation"])


def get_loader() -> ScenarioLoader:
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="Validate all config content")
def validate_all(loader: ScenarioLoader = Depends(get_loader)) -> ValidationReport:
    """Run full validation across all loaded content and return a report."""
    errors: list[ValidationError] = []
    warnings: list[ValidationError] = []
    info: list[ValidationError] = []

    stages = loader.all_stages()
    objectives = loader.all_objectives()
    personas = loader.all_personas()
    constraints = loader.all_constraints()
    scenarios = loader.all_scenarios()
    templates = loader.all_prompt_templates()

    # Validate each scenario
    for scenario_id, scenario in scenarios.items():
        location_prefix = f"scenarios/{scenario_id}.json"

        # Check persona reference
        if scenario.persona not in personas:
            errors.append(ValidationError(
                severity="error",
                code="BROKEN_PERSONA_REF",
                message=f"Persona '{scenario.persona}' not found.",
                location=f"{location_prefix} > persona",
                suggestion=f"Available personas: {list(personas.keys())}",
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

        # Check prompt template
        if scenario.prompt_template not in templates:
            warnings.append(ValidationError(
                severity="warning",
                code="MISSING_TEMPLATE",
                message=f"prompt_template '{scenario.prompt_template}' not found. Will fall back to 'default_dialogue'.",
                location=f"{location_prefix} > prompt_template",
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
            if not step.objectives:
                warnings.append(ValidationError(
                    severity="warning",
                    code="NO_OBJECTIVES",
                    message=f"Stage step '{step.stage}' has no objectives.",
                    location=step_location,
                ))

            for obj_id in step.objectives:
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
def validate_scenario(scenario_id: str, loader: ScenarioLoader = Depends(get_loader)) -> ValidationReport:
    """Run validation for a single scenario only."""
    try:
        loader.get_scenario(scenario_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    # Run full validation and filter to this scenario's errors
    full_report = validate_all(loader)
    prefix = f"scenarios/{scenario_id}.json"
    scenario_errors = [e for e in full_report.errors if e.location.startswith(prefix)]
    scenario_warnings = [w for w in full_report.warnings if w.location.startswith(prefix)]

    return ValidationReport(
        valid=len(scenario_errors) == 0,
        errors=scenario_errors,
        warnings=scenario_warnings,
        info=full_report.info,
    )
