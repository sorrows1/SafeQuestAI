"""Constraints API — CRUD for the constraints.json registry."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import ConstraintDefinition

router = APIRouter(prefix="/api/constraints", tags=["Constraints"])


def get_loader() -> ScenarioLoader:
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="List all constraints")
def list_constraints(loader: ScenarioLoader = Depends(get_loader)):
    return list(loader.all_constraints().values())


@router.get("/{constraint_id}", summary="Get a single constraint")
def get_constraint(constraint_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        return loader.get_constraint(constraint_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a constraint")
def create_constraint(constraint: ConstraintDefinition, loader: ScenarioLoader = Depends(get_loader)):
    if constraint.id in loader.all_constraints():
        raise HTTPException(status_code=409, detail=f"Constraint '{constraint.id}' already exists.")
    loader.save_constraint(constraint)
    return constraint


@router.put("/{constraint_id}", summary="Update a constraint")
def update_constraint(
    constraint_id: str,
    constraint: ConstraintDefinition,
    loader: ScenarioLoader = Depends(get_loader),
):
    if constraint.id != constraint_id:
        raise HTTPException(status_code=400, detail="ID mismatch between path and body.")
    loader.save_constraint(constraint)
    return constraint


@router.delete("/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a constraint")
def delete_constraint(constraint_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        loader.get_constraint(constraint_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Constraint '{constraint_id}' not found.")
    loader.delete_constraint(constraint_id)
