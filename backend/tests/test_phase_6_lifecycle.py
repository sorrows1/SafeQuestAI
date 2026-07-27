from datetime import datetime, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from fastapi import HTTPException, Response

from app.api import family_sessions
from app.api.family_sessions import _catalog_lifecycle_by_transcript
from app.models.orm import Base, FamilySession
from app.models.schemas import (
    CreateFamilySessionRequest,
    ScenarioLifecycle,
    TERMINAL_FAMILY_SESSION_STATES,
    catalog_lifecycle_for_states,
    is_non_terminal_family_session_state,
    is_terminal_family_session_state,
)


def _attempt(*, transcript_id: int, child_user_id: int, state: str, public_id: str, parent_user_id: int | None = None) -> FamilySession:
    return FamilySession(
        transcript_id=transcript_id,
        child_user_id=child_user_id,
        owner_user_id=child_user_id,
        parent_user_id=parent_user_id,
        public_id=public_id,
        state=state,
        companion_mode=parent_user_id is None,
        state_version=1,
        revealed_up_to=-1,
        attempt_number=1,
        started_at=datetime.now(timezone.utc),
    )


def test_terminal_state_classifier_is_canonical_and_exhaustive() -> None:
    assert TERMINAL_FAMILY_SESSION_STATES == {"completed", "abandoned", "expired"}
    assert is_terminal_family_session_state("completed")
    assert not is_terminal_family_session_state("paused_for_support")
    assert is_non_terminal_family_session_state("waiting_for_participants")
    assert catalog_lifecycle_for_states([]) == ScenarioLifecycle.NOT_STARTED.value
    assert catalog_lifecycle_for_states(["completed"]) == ScenarioLifecycle.COMPLETED.value
    assert catalog_lifecycle_for_states(["completed", "checkpoint"]) == ScenarioLifecycle.ACTIVE.value


def test_catalog_lifecycle_is_learner_scoped_and_covers_solo_shared_and_completed() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        db.add_all([
            _attempt(transcript_id=1, child_user_id=10, state="in_progress", public_id="fs_solo_active"),
            _attempt(transcript_id=2, child_user_id=10, parent_user_id=77, state="waiting_for_participants", public_id="fs_shared_active"),
            _attempt(transcript_id=3, child_user_id=10, state="completed", public_id="fs_completed"),
            _attempt(transcript_id=1, child_user_id=11, state="completed", public_id="fs_other_learner"),
        ])
        db.commit()
        learner = type("Learner", (), {"id": 10})()
        lifecycle = _catalog_lifecycle_by_transcript([1, 2, 3, 4], learner, db)

    assert lifecycle == {
        1: (ScenarioLifecycle.ACTIVE, "fs_solo_active"),
        2: (ScenarioLifecycle.ACTIVE, "fs_shared_active"),
        3: (ScenarioLifecycle.COMPLETED, "fs_completed"),
        4: (ScenarioLifecycle.NOT_STARTED, None),
    }


def test_database_rejects_duplicate_non_terminal_attempts_and_allows_restart_lineage() -> None:
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        first = _attempt(transcript_id=20, child_user_id=9, state="in_progress", public_id="fs_first")
        db.add(first)
        db.commit()

        db.add(_attempt(transcript_id=20, child_user_id=9, state="checkpoint", public_id="fs_duplicate"))
        with pytest.raises(IntegrityError):
            db.commit()
        db.rollback()

        first = db.get(FamilySession, first.id)
        first.state = "completed"
        first.completed_at = datetime.now(timezone.utc)
        db.commit()
        restarted = _attempt(transcript_id=20, child_user_id=9, state="in_progress", public_id="fs_restart")
        restarted.previous_session_id = first.id
        restarted.attempt_number = first.attempt_number + 1
        db.add(restarted)
        db.commit()

        assert restarted.previous_session_id == first.id
        assert restarted.attempt_number == 2


class _TranscriptQuery:
    def __init__(self, transcript: object):
        self.transcript = transcript

    def filter(self, *_args: object) -> "_TranscriptQuery":
        return self

    def first(self) -> object:
        return self.transcript


class _CreateDb:
    def __init__(self, transcript: object):
        self.transcript = transcript

    def query(self, _model: object) -> _TranscriptQuery:
        return _TranscriptQuery(self.transcript)


def test_duplicate_create_idempotently_returns_the_current_attempt(monkeypatch: pytest.MonkeyPatch) -> None:
    transcript = type("Transcript", (), {"id": 30, "is_published": True})()
    active = _attempt(transcript_id=30, child_user_id=4, state="in_progress", public_id="fs_current")
    active.id = 8
    active.event_sequence = 0
    user = type("Learner", (), {"id": 4})()
    monkeypatch.setattr(family_sessions, "_active_learner_session", lambda *_args: active)

    response = Response()
    out = family_sessions.create_session(30, CreateFamilySessionRequest(), response, _CreateDb(transcript), user)

    assert response.status_code == 200
    assert out.session_ref == "fs_current"


def test_completed_create_requires_the_explicit_restart_action(monkeypatch: pytest.MonkeyPatch) -> None:
    transcript = type("Transcript", (), {"id": 31, "is_published": True})()
    completed = _attempt(transcript_id=31, child_user_id=4, state="completed", public_id="fs_finished")
    user = type("Learner", (), {"id": 4})()
    monkeypatch.setattr(family_sessions, "_active_learner_session", lambda *_args: None)
    monkeypatch.setattr(family_sessions, "_latest_terminal_learner_session", lambda *_args: completed)

    with pytest.raises(HTTPException) as error:
        family_sessions.create_session(31, CreateFamilySessionRequest(), Response(), _CreateDb(transcript), user)

    assert error.value.status_code == 409
    assert error.value.detail == {"code": "restart_required", "session_ref": "fs_finished"}
