"""Objectives API — CRUD for the objectives.json registry."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import ObjectiveDefinition

router = APIRouter(prefix="/api/objectives", tags=["Objectives"])


def get_loader() -> ScenarioLoader:
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="List all objectives")
def list_objectives(loader: ScenarioLoader = Depends(get_loader)):
    return list(loader.all_objectives().values())


@router.get("/{objective_id}", summary="Get a single objective")
def get_objective(objective_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        return loader.get_objective(objective_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create an objective")
def create_objective(objective: ObjectiveDefinition, loader: ScenarioLoader = Depends(get_loader)):
    if objective.id in loader.all_objectives():
        raise HTTPException(status_code=409, detail=f"Objective '{objective.id}' already exists.")
    loader.save_objective(objective)
    return objective


@router.put("/{objective_id}", summary="Update an objective")
def update_objective(
    objective_id: str,
    objective: ObjectiveDefinition,
    loader: ScenarioLoader = Depends(get_loader),
):
    if objective.id != objective_id:
        raise HTTPException(status_code=400, detail="ID mismatch between path and body.")
    loader.save_objective(objective)
    return objective


@router.delete("/{objective_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete an objective")
def delete_objective(objective_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        loader.get_objective(objective_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Objective '{objective_id}' not found.")
    loader.delete_objective(objective_id)
