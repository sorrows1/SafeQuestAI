from datetime import datetime, timezone

import pytest
from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect, text
from pydantic import ValidationError

from app.models.schemas import GenerationMode, ScenarioCategory, ScenarioDefinition
from app.repositories.content_repo import validate_scenario_references


def test_dual_agent_scenarios_require_canonical_bindings() -> None:
    with pytest.raises(ValidationError, match="initiator.persona_id"):
        ScenarioDefinition(id="incomplete", display_name="Incomplete", description="", starting_stage="opening")
    scenario = ScenarioDefinition(
        id="canonical", display_name="Canonical", description="", starting_stage="opening",
        initiator={"persona_id": "initiator", "dialogue_prompt_id": "initiator_dialogue"},
        respondent={"persona_id": "respondent", "dialogue_prompt_id": "respondent_dialogue"},
    )
    assert scenario.initiator.persona_id == "initiator"
    assert scenario.respondent.persona_id == "respondent"


def test_oversharing_requires_single_pass_mode() -> None:
    with pytest.raises(ValidationError, match="single_pass"):
        ScenarioDefinition(
            id="oversharing", display_name="Oversharing", description="", starting_stage="opening", category=ScenarioCategory.OVERSHARING,
        )


def test_reference_validation_reports_actor_and_stage_problems() -> None:
    class EmptyDatabase:
        def get(self, model, key):
            return None

    scenario = ScenarioDefinition(
        id="broken", display_name="Broken", description="", starting_stage="missing", initiator={"persona_id": "missing", "dialogue_prompt_id": "initiator"}, respondent={"persona_id": "missing", "dialogue_prompt_id": "respondent"}
    )
    with pytest.raises(ValueError, match="initiator.persona_id.*does not exist"):
        validate_scenario_references(EmptyDatabase(), scenario)


from app.models.orm import CuratedSceneElement, FamilyRelationship, FamilyRelationshipInvitation, FamilySessionParticipant, FlagAttempt, SessionProgress, ValidatedFinding, FamilySession, RedFlagSpan
from app.models.schemas import (
    FamilySceneOut, FamilySessionDetailOut, FamilySessionOut, FamilySessionState,
    FlagAttemptRequest, RenderSkin, SceneElementOut, SceneElementType, SessionProgressOut,
)


def test_phase_one_persisted_contract_tables_exist() -> None:
    required = {CuratedSceneElement, FamilyRelationshipInvitation, FamilyRelationship, FamilySessionParticipant, SessionProgress, FlagAttempt, ValidatedFinding}
    assert all(model.__tablename__ in model.metadata.tables for model in required)
    assert {"state", "state_version", "active_checkpoint_element_key"}.issubset(FamilySession.__table__.columns.keys())
    assert {"scene_element_id", "child_safe_explanation", "tiered_hints"}.issubset(RedFlagSpan.__table__.columns.keys())


def test_scene_contract_is_versioned_and_cannot_carry_answer_key_fields() -> None:
    scene = FamilySceneOut(render_skin=RenderSkin.CHAT, elements=[SceneElementOut(element_key="message-1", element_type=SceneElementType.MESSAGE, sequence=1, content="Please keep this private.", accessible_label="Message from Nova", semantic_role="article")])
    payload = scene.model_dump()
    assert payload["scene_schema_version"] == 1
    assert "tactic_tag" not in str(payload)
    assert "is_red_flag" not in str(payload)


def test_session_detail_uses_server_state_not_client_message_exhaustion() -> None:
    detail = FamilySessionDetailOut(session=FamilySessionOut(id=1, transcript_id=2, companion_mode=True, detective_mode=True, started_at="now", completed_at=None, state=FamilySessionState.COMPLETION_REVIEW), scene=FamilySceneOut(render_skin=RenderSkin.CHAT), progress=SessionProgressOut(completion_ready=False))
    assert detail.session.state is FamilySessionState.COMPLETION_REVIEW
    assert detail.progress.completion_ready is False


def test_detection_attempt_uses_stable_element_key() -> None:
    attempt = FlagAttemptRequest(element_key="profile-field-location", reasoning="It reveals where they go after school.", claimed_red_flag=True)
    assert attempt.element_key == "profile-field-location"



def test_scene_contract_rejects_unsafe_presentation_and_unsupported_skin() -> None:
    from app.models.schemas import PresentationToken, SceneDefinition, SceneElement, validate_scene_for_skin

    with pytest.raises(ValidationError, match="application-relative"):
        PresentationToken(href="https://example.test")
    scene = SceneDefinition(render_skin=RenderSkin.CHAT, elements=[
        SceneElement(element_key="email-1", element_type=SceneElementType.EMAIL_MESSAGE, sequence=0, accessible_label="Email", semantic_role="article")
    ])
    with pytest.raises(ValueError, match="unsupported"):
        validate_scene_for_skin(scene)


def test_scene_contract_requires_valid_nested_targets_and_selectable_fixture() -> None:
    from app.models.schemas import SceneDefinition, SceneElement, validate_scene_for_skin

    with pytest.raises(ValidationError, match="parent"):
        SceneDefinition(render_skin=RenderSkin.CHAT, elements=[
            SceneElement(element_key="message-1", element_type=SceneElementType.MESSAGE, parent_element_key="missing", sequence=0, accessible_label="Message", semantic_role="article")
        ])
    scene = SceneDefinition(render_skin=RenderSkin.CHAT, elements=[
        SceneElement(element_key="message-1", element_type=SceneElementType.MESSAGE, sequence=0, selectable=False, accessible_label="Message", semantic_role="article")
    ])
    with pytest.raises(ValueError, match="selectable"):
        validate_scene_for_skin(scene, require_selectable=True)


def test_phase_6_presentation_metadata_is_bounded_and_inert():
    from pydantic import ValidationError
    from app.models.schemas import PresentationToken

    token = PresentationToken(profile_handle="@nova", badges=["Season starter"], stats=["12 trades"])
    assert token.app_name == "SafeQuest" and token.surface_label == "Scenario"
    try:
        PresentationToken(href="https://outside.example")
    except ValidationError:
        pass
    else:
        raise AssertionError("remote URLs must remain rejected")
    try:
        PresentationToken(badges=[" "])
    except ValidationError:
        pass
    else:
        raise AssertionError("blank metadata labels must remain rejected")



def test_phase_one_migration_backfills_legacy_content_and_is_reversible(tmp_path) -> None:
    database = tmp_path / "phase_one.sqlite"
    engine = create_engine(f"sqlite:///{database}")
    config = Config("alembic.ini")
    connection = engine.connect()
    config.attributes["connection"] = connection
    try:
        command.upgrade(config, "20260725_baseline_current")
        now = datetime.now(timezone.utc)
        connection.execute(text(
            "INSERT INTO users (id, email, hashed_password, display_name, avatar_url, role, google_id, is_active, created_at, updated_at) "
            "VALUES (1, 'reviewer@example.test', NULL, 'Reviewer', NULL, 'admin', NULL, 1, :now, :now), "
            "(2, 'learner@example.test', NULL, 'Learner', NULL, 'user', NULL, 1, :now, :now), "
            "(3, 'caregiver@example.test', NULL, 'Caregiver', NULL, 'user', NULL, 1, :now, :now)"
        ), {"now": now})
        connection.execute(text(
            "INSERT INTO conversation_sessions (id, scenario_id, difficulty, created_at, updated_at, state) "
            "VALUES (1, 'legacy', 'Medium', :now, :now, '{}')"
        ), {"now": now})
        connection.execute(text(
            "INSERT INTO curated_transcripts (id, source_session_id, is_concerning_example, difficulty, tactic_tags, reviewed_by, reviewed_at, is_published, category, render_skin, public_metadata_snapshot) "
            "VALUES (1, 1, 1, 'Medium', '[]', 1, :now, 0, 'scam', 'chat', '{}')"
        ), {"now": now})
        connection.execute(text(
            "INSERT INTO curated_messages (id, transcript_id, sequence, speaker_label, content, pace, is_checkpoint) "
            "VALUES (1, 1, 1, 'Nova', 'Keep this private.', 'normal', 0)"
        ))
        connection.execute(text(
            "INSERT INTO red_flag_spans (id, transcript_id, message_sequence, start_offset, end_offset, tactic_tag, source) "
            "VALUES (1, 1, 1, 0, 4, 'secrecy_request', 'human_reviewed')"
        ))
        connection.execute(text(
            "INSERT INTO family_sessions (id, transcript_id, child_user_id, parent_user_id, companion_mode, detective_mode, disclosure_flagged, revealed_up_to, started_at, completed_at) "
            "VALUES (1, 1, 2, 3, 0, 0, 0, 0, :now, NULL)"
        ), {"now": now})
        connection.commit()

        command.upgrade(config, "20260725_phase1_contracts")
        assert {"curated_scene_elements", "session_progress", "flag_attempts", "validated_findings", "family_relationships"}.issubset(inspect(connection).get_table_names())
        assert connection.execute(text("SELECT element_key FROM curated_scene_elements WHERE source_message_id = 1")).scalar_one() == "message-1"
        assert connection.execute(text("SELECT scene_element_id FROM red_flag_spans WHERE id = 1")).scalar_one() is not None

        command.downgrade(config, "20260725_baseline_current")
        command.upgrade(config, "20260725_phase1_contracts")
        assert inspect(connection).has_table("validated_findings")
    finally:
        connection.close()
        engine.dispose()
