from pathlib import Path

from app.family.guide_builder import build_conversation_guide
from app.models.orm import (
    CheckpointResponse,
    FamilyCaregiverComment,
    FamilySession,
    FamilySessionEvent,
    FamilySessionParticipant,
    FlagAttempt,
    RedFlagSpan,
    ValidatedFinding,
)
from app.models.schemas import (
    FamilyCaregiverCommentCreateRequest,
    FamilySessionEventOut,
    FamilySessionEventType,
    FamilySessionParticipantOut,
    ParticipantPresenceStatus,
)


def test_phase_eight_persists_ordered_events_presence_and_caregiver_comments() -> None:
    assert {"event_sequence"}.issubset(FamilySession.__table__.columns.keys())
    assert {"presence_status", "last_heartbeat_at", "presence_expires_at"}.issubset(
        FamilySessionParticipant.__table__.columns.keys()
    )
    assert {"family_session_id", "sequence", "event_type", "payload", "is_ephemeral"}.issubset(
        FamilySessionEvent.__table__.columns.keys()
    )
    assert {"public_id", "scene_element_id", "validated_finding_id", "child_visible_label"}.issubset(
        FamilyCaregiverComment.__table__.columns.keys()
    )
    event = FamilySessionEventOut(
        id=3, sequence=2, event_type=FamilySessionEventType.REVEAL,
        payload={"revealed_up_to": 4}, created_at="now",
    )
    assert event.event_type is FamilySessionEventType.REVEAL
    participant = FamilySessionParticipantOut(
        member_ref="member_example", display_name="Learner", role="learner", joined_at="now",
        presence_status=ParticipantPresenceStatus.ONLINE,
    )
    assert participant.presence_status is ParticipantPresenceStatus.ONLINE


def test_caregiver_comment_requires_one_safe_anchor() -> None:
    valid = FamilyCaregiverCommentCreateRequest(element_key="message-1", text="Let’s pause here.", client_command_id="comment-123")
    assert valid.element_key == "message-1"
    try:
        FamilyCaregiverCommentCreateRequest(text="No anchor", client_command_id="comment-124")
    except ValueError:
        pass
    else:
        raise AssertionError("comment anchor must be required")


def test_guide_uses_only_explicitly_shared_collaboration_data() -> None:
    session = FamilySession(id=1, transcript_id=1, child_user_id=2, parent_user_id=3)
    span = RedFlagSpan(id=7, message_sequence=2, tactic_tag="fake_prize_or_reward", child_safe_explanation="A prize can be used to rush someone.")
    shared_response = CheckpointResponse(checkpoint_message_id=4, responder_role="child", response_text="I would ask someone I trust.", visibility="shared")
    private_response = CheckpointResponse(checkpoint_message_id=5, responder_role="child", response_text="PRIVATE DISCLOSURE TEXT", visibility="private")
    shared_attempt = FlagAttempt(claim="red_flag", sanitized_reasoning="It asks me to hurry.", visibility="shared")
    private_attempt = FlagAttempt(claim="unsure", sanitized_reasoning="PRIVATE ATTEMPT TEXT", visibility="private")
    finding = ValidatedFinding(red_flag_span_id=7)
    comment = FamilyCaregiverComment(text="You can always take time before replying.", child_visible_label="Caregiver note")
    guide = build_conversation_guide(
        session, "scam", [span], [shared_response, private_response],
        shared_attempts=[shared_attempt, private_attempt], validated_findings=[finding], caregiver_comments=[comment],
    )
    rendered = str(guide)
    assert "PRIVATE DISCLOSURE TEXT" not in rendered
    assert "PRIVATE ATTEMPT TEXT" not in rendered
    assert "Caregiver note" in rendered
    assert "validated_findings" in guide["child_reasoning_excerpt"]


def test_shared_session_companion_and_sse_contracts_do_not_restore_mode_gate() -> None:
    companion_source = Path("app/api/companion.py").read_text(encoding="utf-8")
    family_source = Path("app/api/family_sessions.py").read_text(encoding="utf-8")
    assert "Companion checkpoint responses require companion mode" not in companion_source
    assert '"/sessions/{session_id}/events"' in family_source
    assert "Last-Event-ID" in family_source
    assert '"/sessions/{session_id}/selection-focus"' in family_source
