"""
Scenarios API — CRUD operations for scenario JSON files.
All reads/writes go directly to the filesystem via ScenarioLoader.
"""

from __future__ import annotations

import copy
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse

from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import ScenarioDefinition

router = APIRouter(prefix="/api/scenarios", tags=["Scenarios"])


def get_loader() -> ScenarioLoader:
    """Dependency — returns the singleton loader from app state."""
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="List all scenarios")
def list_scenarios(loader: ScenarioLoader = Depends(get_loader)):
    return list(loader.all_scenarios().values())


@router.get("/{scenario_id}", summary="Get a single scenario")
def get_scenario(scenario_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        return loader.get_scenario(scenario_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a new scenario")
def create_scenario(scenario: ScenarioDefinition, loader: ScenarioLoader = Depends(get_loader)):
    existing = loader.all_scenarios()
    if scenario.id in existing:
        raise HTTPException(
            status_code=409, detail=f"Scenario '{scenario.id}' already exists."
        )
    loader.save_scenario(scenario)
    return scenario


@router.put("/{scenario_id}", summary="Update a scenario")
def update_scenario(
    scenario_id: str,
    scenario: ScenarioDefinition,
    loader: ScenarioLoader = Depends(get_loader),
):
    # Ensure ID in path and body match
    if scenario.id != scenario_id:
        raise HTTPException(
            status_code=400,
            detail=f"ID mismatch: path='{scenario_id}' body='{scenario.id}'",
        )
    loader.save_scenario(scenario)
    return scenario


@router.delete("/{scenario_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a scenario")
def delete_scenario(scenario_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        loader.get_scenario(scenario_id)  # Confirm it exists
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")
    loader.delete_scenario(scenario_id)


@router.post("/{scenario_id}/duplicate", summary="Duplicate a scenario")
def duplicate_scenario(
    scenario_id: str,
    loader: ScenarioLoader = Depends(get_loader),
):
    try:
        original = loader.get_scenario(scenario_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Scenario '{scenario_id}' not found.")

    # Create copy with a new ID
    new_id = f"{scenario_id}_copy"
    data = original.model_dump()
    data["id"] = new_id
    data["display_name"] = f"{original.display_name} (Copy)"

    new_scenario = ScenarioDefinition.model_validate(data)
    loader.save_scenario(new_scenario)
    return new_scenario


@router.post("/reload", summary="Reload all scenarios from disk")
def reload_scenarios(loader: ScenarioLoader = Depends(get_loader)):
    loader.reload()
    return {"message": "Reloaded", "count": len(loader.all_scenarios())}
