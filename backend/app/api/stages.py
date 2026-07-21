"""Stages API — CRUD for the stages.json registry."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import StageDefinition

router = APIRouter(prefix="/api/stages", tags=["Stages"])


def get_loader() -> ScenarioLoader:
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="List all stages")
def list_stages(loader: ScenarioLoader = Depends(get_loader)):
    return list(loader.all_stages().values())


@router.get("/{stage_id}", summary="Get a single stage")
def get_stage(stage_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        return loader.get_stage(stage_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a stage")
def create_stage(stage: StageDefinition, loader: ScenarioLoader = Depends(get_loader)):
    if stage.id in loader.all_stages():
        raise HTTPException(status_code=409, detail=f"Stage '{stage.id}' already exists.")
    loader.save_stage(stage)
    return stage


@router.put("/{stage_id}", summary="Update a stage")
def update_stage(
    stage_id: str,
    stage: StageDefinition,
    loader: ScenarioLoader = Depends(get_loader),
):
    if stage.id != stage_id:
        raise HTTPException(status_code=400, detail="ID mismatch between path and body.")
    loader.save_stage(stage)
    return stage


@router.delete("/{stage_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a stage")
def delete_stage(stage_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        loader.get_stage(stage_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Stage '{stage_id}' not found.")
    loader.delete_stage(stage_id)
