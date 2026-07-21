"""Prompts API — CRUD for prompt template .txt files."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status

from app.engine.scenario_loader import ScenarioLoader
from app.engine.prompt_builder import PromptBuilder
from app.models.content_schemas import PromptTemplate

router = APIRouter(prefix="/api/prompts", tags=["Prompt Templates"])


def get_loader() -> ScenarioLoader:
    from app.main import scenario_loader
    return scenario_loader


@router.get("/", summary="List all prompt templates")
def list_templates(loader: ScenarioLoader = Depends(get_loader)):
    return list(loader.all_prompt_templates().values())


@router.get("/{name}", summary="Get a single prompt template")
def get_template(name: str, loader: ScenarioLoader = Depends(get_loader)):
    try:
        return loader.get_prompt_template(name)
    except KeyError as exc:
        raise HTTPException(status_code=404, detail=str(exc))


@router.post("/", status_code=status.HTTP_201_CREATED, summary="Create a prompt template")
def create_template(template: PromptTemplate, loader: ScenarioLoader = Depends(get_loader)):
    if template.name in loader.all_prompt_templates():
        raise HTTPException(status_code=409, detail=f"Template '{template.name}' already exists.")
    # Auto-extract variables
    template.variables = PromptBuilder.extract_variables(template.content)
    loader.save_prompt_template(template)
    return template


@router.put("/{name}", summary="Update a prompt template")
def update_template(
    name: str,
    template: PromptTemplate,
    loader: ScenarioLoader = Depends(get_loader),
):
    if template.name != name:
        raise HTTPException(status_code=400, detail="Name mismatch between path and body.")
    template.variables = PromptBuilder.extract_variables(template.content)
    loader.save_prompt_template(template)
    return template


@router.delete("/{name}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete a prompt template")
def delete_template(name: str, loader: ScenarioLoader = Depends(get_loader)):
    if name == "default_dialogue":
        raise HTTPException(status_code=400, detail="Cannot delete the default prompt template.")
    try:
        loader.get_prompt_template(name)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Template '{name}' not found.")
    loader.delete_prompt_template(name)


@router.post("/{name}/preview", summary="Preview a prompt template with example variables")
def preview_template(
    name: str,
    variables: dict[str, str],
    loader: ScenarioLoader = Depends(get_loader),
):
    """Interpolate a template with provided variable values for preview."""
    builder = PromptBuilder(loader)
    try:
        result = builder.build(name, variables)
        return {"rendered": result}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))
