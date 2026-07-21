"""
ScenarioLoader — loads, validates, caches, and hot-reloads all JSON config files.

Responsibilities:
  - Scan config directories on startup.
  - Validate each file against its Pydantic model.
  - Provide fast in-memory lookups by ID.
  - Support hot-reload when files change (via watchfiles).

Design: Singleton-style loader; instantiated once in main.py and injected
into routers via FastAPI dependency injection.
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from app.models.content_schemas import (
    ConstraintDefinition,
    ObjectiveDefinition,
    PersonaDefinition,
    PromptTemplate,
    ScenarioDefinition,
    StageDefinition,
)

logger = logging.getLogger(__name__)


class ScenarioLoader:
    """
    Loads all JSON config content into memory and exposes typed accessors.
    Call `load_all()` on startup. Call `reload()` to refresh from disk.
    """

    def __init__(self, config_dir: Path) -> None:
        self._config_dir = config_dir

        # In-memory caches — keyed by ID
        self._stages: dict[str, StageDefinition] = {}
        self._objectives: dict[str, ObjectiveDefinition] = {}
        self._personas: dict[str, PersonaDefinition] = {}
        self._constraints: dict[str, ConstraintDefinition] = {}
        self._scenarios: dict[str, ScenarioDefinition] = {}
        self._prompt_templates: dict[str, PromptTemplate] = {}

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def load_all(self) -> None:
        """Load (or reload) all config files from disk."""
        self._load_stages()
        self._load_objectives()
        self._load_personas()
        self._load_constraints()
        self._load_scenarios()
        self._load_prompt_templates()
        logger.info(
            "ScenarioLoader: loaded %d stages, %d objectives, %d personas, "
            "%d constraints, %d scenarios, %d prompt templates",
            len(self._stages),
            len(self._objectives),
            len(self._personas),
            len(self._constraints),
            len(self._scenarios),
            len(self._prompt_templates),
        )

    def reload(self) -> None:
        """Hot-reload — clears caches and re-reads from disk."""
        logger.info("ScenarioLoader: hot-reloading config files")
        self._stages.clear()
        self._objectives.clear()
        self._personas.clear()
        self._constraints.clear()
        self._scenarios.clear()
        self._prompt_templates.clear()
        self.load_all()

    # ------------------------------------------------------------------
    # Getters — raise KeyError with friendly message on miss
    # ------------------------------------------------------------------

    def get_stage(self, stage_id: str) -> StageDefinition:
        if stage_id not in self._stages:
            raise KeyError(f"Stage '{stage_id}' not found. Available: {list(self._stages)}")
        return self._stages[stage_id]

    def get_objective(self, objective_id: str) -> ObjectiveDefinition:
        if objective_id not in self._objectives:
            raise KeyError(f"Objective '{objective_id}' not found.")
        return self._objectives[objective_id]

    def get_persona(self, persona_id: str) -> PersonaDefinition:
        if persona_id not in self._personas:
            raise KeyError(f"Persona '{persona_id}' not found.")
        return self._personas[persona_id]

    def get_constraint(self, constraint_id: str) -> ConstraintDefinition:
        if constraint_id not in self._constraints:
            raise KeyError(f"Constraint '{constraint_id}' not found.")
        return self._constraints[constraint_id]

    def get_scenario(self, scenario_id: str) -> ScenarioDefinition:
        if scenario_id not in self._scenarios:
            raise KeyError(f"Scenario '{scenario_id}' not found.")
        return self._scenarios[scenario_id]

    def get_prompt_template(self, name: str) -> PromptTemplate:
        if name not in self._prompt_templates:
            raise KeyError(f"Prompt template '{name}' not found.")
        return self._prompt_templates[name]

    # ------------------------------------------------------------------
    # Collection accessors
    # ------------------------------------------------------------------

    def all_stages(self) -> dict[str, StageDefinition]:
        return dict(self._stages)

    def all_objectives(self) -> dict[str, ObjectiveDefinition]:
        return dict(self._objectives)

    def all_personas(self) -> dict[str, PersonaDefinition]:
        return dict(self._personas)

    def all_constraints(self) -> dict[str, ConstraintDefinition]:
        return dict(self._constraints)

    def all_scenarios(self) -> dict[str, ScenarioDefinition]:
        return dict(self._scenarios)

    def all_prompt_templates(self) -> dict[str, PromptTemplate]:
        return dict(self._prompt_templates)

    # ------------------------------------------------------------------
    # Write helpers — used by authoring API to persist changes
    # ------------------------------------------------------------------

    def save_scenario(self, scenario: ScenarioDefinition) -> None:
        """Persist a scenario to disk and update cache."""
        path = self._config_dir / "scenarios" / f"{scenario.id}.json"
        path.write_text(scenario.model_dump_json(indent=2), encoding="utf-8")
        self._scenarios[scenario.id] = scenario
        logger.info("Saved scenario: %s", scenario.id)

    def delete_scenario(self, scenario_id: str) -> None:
        """Delete a scenario JSON file and remove from cache."""
        path = self._config_dir / "scenarios" / f"{scenario_id}.json"
        if path.exists():
            path.unlink()
        self._scenarios.pop(scenario_id, None)
        logger.info("Deleted scenario: %s", scenario_id)

    def save_persona(self, persona: PersonaDefinition) -> None:
        self._save_to_registry("personas.json", persona.id, persona.model_dump())
        self._personas[persona.id] = persona

    def delete_persona(self, persona_id: str) -> None:
        self._delete_from_registry("personas.json", persona_id)
        self._personas.pop(persona_id, None)

    def save_stage(self, stage: StageDefinition) -> None:
        self._save_to_registry("stages.json", stage.id, stage.model_dump())
        self._stages[stage.id] = stage

    def delete_stage(self, stage_id: str) -> None:
        self._delete_from_registry("stages.json", stage_id)
        self._stages.pop(stage_id, None)

    def save_objective(self, objective: ObjectiveDefinition) -> None:
        self._save_to_registry("objectives.json", objective.id, objective.model_dump())
        self._objectives[objective.id] = objective

    def delete_objective(self, objective_id: str) -> None:
        self._delete_from_registry("objectives.json", objective_id)
        self._objectives.pop(objective_id, None)

    def save_constraint(self, constraint: ConstraintDefinition) -> None:
        self._save_to_registry("constraints.json", constraint.id, constraint.model_dump())
        self._constraints[constraint.id] = constraint

    def delete_constraint(self, constraint_id: str) -> None:
        self._delete_from_registry("constraints.json", constraint_id)
        self._constraints.pop(constraint_id, None)

    def save_prompt_template(self, template: PromptTemplate) -> None:
        path = self._config_dir / "prompts" / f"{template.name}.txt"
        path.write_text(template.content, encoding="utf-8")
        self._prompt_templates[template.name] = template
        logger.info("Saved prompt template: %s", template.name)

    def delete_prompt_template(self, name: str) -> None:
        path = self._config_dir / "prompts" / f"{name}.txt"
        if path.exists():
            path.unlink()
        self._prompt_templates.pop(name, None)

    # ------------------------------------------------------------------
    # Private loaders
    # ------------------------------------------------------------------

    def _load_stages(self) -> None:
        path = self._config_dir / "stages.json"
        data = self._read_json(path)
        for stage_id, stage_data in data.items():
            stage_data.setdefault("id", stage_id)
            try:
                self._stages[stage_id] = StageDefinition.model_validate(stage_data)
            except Exception as exc:  # noqa: BLE001
                logger.error("Failed to load stage '%s': %s", stage_id, exc)

    def _load_objectives(self) -> None:
        path = self._config_dir / "objectives.json"
        data = self._read_json(path)
        for obj_id, obj_data in data.items():
            obj_data.setdefault("id", obj_id)
            try:
                self._objectives[obj_id] = ObjectiveDefinition.model_validate(obj_data)
            except Exception as exc:
                logger.error("Failed to load objective '%s': %s", obj_id, exc)

    def _load_personas(self) -> None:
        path = self._config_dir / "personas.json"
        data = self._read_json(path)
        for persona_id, persona_data in data.items():
            persona_data.setdefault("id", persona_id)
            try:
                self._personas[persona_id] = PersonaDefinition.model_validate(persona_data)
            except Exception as exc:
                logger.error("Failed to load persona '%s': %s", persona_id, exc)

    def _load_constraints(self) -> None:
        path = self._config_dir / "constraints.json"
        data = self._read_json(path)
        for c_id, c_data in data.items():
            c_data.setdefault("id", c_id)
            try:
                self._constraints[c_id] = ConstraintDefinition.model_validate(c_data)
            except Exception as exc:
                logger.error("Failed to load constraint '%s': %s", c_id, exc)

    def _load_scenarios(self) -> None:
        scenarios_dir = self._config_dir / "scenarios"
        if not scenarios_dir.exists():
            logger.warning("Scenarios directory not found: %s", scenarios_dir)
            return
        for scenario_file in scenarios_dir.glob("*.json"):
            data = self._read_json(scenario_file)
            data.setdefault("id", scenario_file.stem)
            try:
                scenario = ScenarioDefinition.model_validate(data)
                self._scenarios[scenario.id] = scenario
            except Exception as exc:
                logger.error("Failed to load scenario '%s': %s", scenario_file.name, exc)

    def _load_prompt_templates(self) -> None:
        prompts_dir = self._config_dir / "prompts"
        if not prompts_dir.exists():
            logger.warning("Prompts directory not found: %s", prompts_dir)
            return
        for template_file in prompts_dir.glob("*.txt"):
            name = template_file.stem
            content = template_file.read_text(encoding="utf-8")
            # Extract variable names from {{variable}} patterns
            import re
            variables = re.findall(r"\{\{(\w+)\}\}", content)
            self._prompt_templates[name] = PromptTemplate(
                name=name,
                content=content,
                variables=list(set(variables)),
                description=f"Prompt template loaded from {template_file.name}",
            )

    # ------------------------------------------------------------------
    # Registry file helpers (for single-file registries like personas.json)
    # ------------------------------------------------------------------

    def _save_to_registry(self, filename: str, entry_id: str, data: dict[str, Any]) -> None:
        path = self._config_dir / filename
        registry = self._read_json(path)
        registry[entry_id] = data
        path.write_text(json.dumps(registry, indent=2), encoding="utf-8")

    def _delete_from_registry(self, filename: str, entry_id: str) -> None:
        path = self._config_dir / filename
        registry = self._read_json(path)
        registry.pop(entry_id, None)
        path.write_text(json.dumps(registry, indent=2), encoding="utf-8")

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        if not path.exists():
            logger.warning("Config file not found: %s", path)
            return {}
        try:
            return json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            logger.error("Invalid JSON in %s: %s", path, exc)
            return {}
