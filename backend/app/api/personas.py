"""Personas API — CRUD for the personas.json registry."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.engine.scenario_loader import ScenarioLoader
from app.models.content_schemas import PersonaDefinition

router = APIRouter(prefix="/api/personas", tags=["Personas"])


def get_loader() -> ScenarioLoader:
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="List all personas")
def list_personas(loader: ScenarioLoader = Depends(get_loader)):
    return list(loader.all_personas().values())


@router.get("/{persona_id}", summary="Get a single persona")
def get_persona(persona_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        return loader.get_persona(persona_id)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a persona")
def create_persona(persona: PersonaDefinition, loader: ScenarioLoader = Depends(get_loader)):
    if persona.id in loader.all_personas():
        raise HTTPException(status_code=409, detail=f"Persona '{persona.id}' already exists.")
    loader.save_persona(persona)
    return persona


@router.put("/{persona_id}", summary="Update a persona")
def update_persona(
    persona_id: str,
    persona: PersonaDefinition,
    loader: ScenarioLoader = Depends(get_loader),
):
    if persona.id != persona_id:
        raise HTTPException(status_code=400, detail="ID mismatch between path and body.")
    loader.save_persona(persona)
    return persona


@router.delete("/{persona_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a persona")
def delete_persona(persona_id: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        loader.get_persona(persona_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Persona '{persona_id}' not found.")
    loader.delete_persona(persona_id)
