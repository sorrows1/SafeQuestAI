"""
API request/response schemas and the structured LLM output schema.
"""

from __future__ import annotations

from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator


# ---------------------------------------------------------------------------
# Scenario foundations
# ---------------------------------------------------------------------------

class Difficulty(str, Enum):
    EASY = "Easy"
    MEDIUM = "Medium"
    HARD = "Hard"


class ScenarioCategory(str, Enum):
    GROOMING = "grooming"
    CYBERBULLYING = "cyberbullying"
    SCAM = "scam"
    IMAGE_REQUEST = "image_request"
    OVERSHARING = "oversharing"


class RenderSkin(str, Enum):
    CHAT = "chat"
    EMAIL = "email"
    SOCIAL_FEED = "social_feed"
    GAME_CHAT = "game_chat"
    FORUM = "forum"
    MARKETPLACE = "marketplace"


class GenerationMode(str, Enum):
    DUAL_AGENT = "dual_agent"
    SINGLE_PASS = "single_pass"


class ParticipantRole(str, Enum):
    CHILD = "child"
    PARENT = "parent"
    AI_COMPANION = "ai_companion"


# These values are deliberately separate from ``User.role``. Platform roles
# decide authorization; family roles describe a relationship or a session.
class FamilyRole(str, Enum):
    LEARNER = "learner"
    CAREGIVER = "caregiver"


class FamilySessionState(str, Enum):
    WAITING_FOR_PARTICIPANTS = "waiting_for_participants"
    IN_PROGRESS = "in_progress"
    CHECKPOINT = "checkpoint"
    COMPLETION_REVIEW = "completion_review"
    HELP_AND_RESOURCES = "help_and_resources"
    COMPLETED = "completed"
    PAUSED_FOR_SUPPORT = "paused_for_support"
    ABANDONED = "abandoned"
    EXPIRED = "expired"


class FamilySessionCommandType(str, Enum):
    START = "start"
    REVEAL_NEXT = "reveal_next"
    CONTINUE_CHECKPOINT = "continue_checkpoint"
    ENTER_COMPLETION_REVIEW = "enter_completion_review"
    ACKNOWLEDGE_COMPLETION = "acknowledge_completion"
    OPEN_HELP = "open_help"
    COMPLETE = "complete"
    RESET = "reset"


class ParticipantPresenceStatus(str, Enum):
    ONLINE = "online"
    OFFLINE = "offline"
    LEFT = "left"


class FamilySessionEventType(str, Enum):
    PARTICIPANT_JOINED = "participant_joined"
    PARTICIPANT_LEFT = "participant_left"
    PARTICIPANT_PRESENCE = "participant_presence"
    STATE_CHANGED = "state_changed"
    REVEAL = "reveal"
    SELECTION_FOCUS = "selection_focus"
    ATTEMPT_SUBMITTED = "attempt_submitted"
    FINDING_VALIDATED = "finding_validated"
    CHECKPOINT_RESPONSE = "checkpoint_response"
    COMPANION_SHARED_FEEDBACK = "companion_shared_feedback"
    CAREGIVER_COMMENT = "caregiver_comment"
    COMPLETED = "completed"
    GUIDE_READY = "guide_ready"


class ElementType(str, Enum):
    CONVERSATION = "conversation"
    MESSAGE = "message"
    EMAIL_THREAD = "email_thread"
    EMAIL_MESSAGE = "email_message"
    EMAIL_HEADER = "email_header"
    POST = "post"
    FEED = "feed"
    PROFILE = "profile"
    PROFILE_FIELD = "profile_field"
    ATTACHMENT = "attachment"
    LINK_PREVIEW = "link_preview"
    GAME_PROFILE = "game_profile"
    GAME_STAT = "game_stat"
    GAME_BADGE = "game_badge"
    SERVER = "server"
    CHANNEL = "channel"
    MEMBER = "member"
    LISTING = "listing"
    SELLER = "seller"
    PRICE = "price"
    FORUM_THREAD = "forum_thread"
    FORUM_POST = "forum_post"
    SITE_SECTION = "site_section"
    LISTING_FIELD = "listing_field"
    COMMENT = "comment"
    SYSTEM_EVENT = "system_event"
    ACTION = "action"
    # Persisted Phase 1 value retained for a non-breaking fixture migration.
    EMAIL = "email"


# The Phase 1 public name remains available to API consumers.
SceneElementType = ElementType


class ElementRelationship(str, Enum):
    ROOT = "root"
    PARENT_CHILD = "parent_child"
    REFERENCE = "reference"


class TimestampSemantic(str, Enum):
    EXACT = "exact"
    RELATIVE = "relative"
    NONE = "none"


class FindingVisibility(str, Enum):
    PRIVATE = "private"
    SHARED = "shared"


class FlagValidationResult(str, Enum):
    PENDING = "pending"
    VALIDATED = "validated"
    NOT_A_FLAG = "not_a_flag"
    NEEDS_SUPPORT = "needs_support"


class EscalationSpeed(str, Enum):
    SLOW = "slow"
    MEDIUM = "medium"
    FAST = "fast"


class RedFlagVisibility(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class DifficultyModifier(BaseModel):
    """Bounded authoring controls; keys are canonical Difficulty values."""

    trust_delta_multiplier: float = Field(default=1.0, ge=0.25, le=2.0, multiple_of=0.05)
    escalation_speed: EscalationSpeed = EscalationSpeed.MEDIUM
    red_flag_visibility: RedFlagVisibility = RedFlagVisibility.MEDIUM


def default_difficulty_modifiers() -> dict[Difficulty, DifficultyModifier]:
    """Explicit, safe starting values for each authoring difficulty."""
    return {
        Difficulty.EASY: DifficultyModifier(trust_delta_multiplier=0.6, escalation_speed=EscalationSpeed.SLOW, red_flag_visibility=RedFlagVisibility.HIGH),
        Difficulty.MEDIUM: DifficultyModifier(),
        Difficulty.HARD: DifficultyModifier(trust_delta_multiplier=1.2, escalation_speed=EscalationSpeed.MEDIUM, red_flag_visibility=RedFlagVisibility.LOW),
    }


class StageStep(BaseModel):
    stage: str
    mandatory_objectives: list[str] = Field(default_factory=list)
    optional_objectives: list[str] = Field(default_factory=list)
    constraints: list[str] = Field(default_factory=list)


class ScenarioActorBinding(BaseModel):
    """The persona and dialogue prompt used by one scenario actor."""

    persona_id: str = Field(min_length=1)
    dialogue_prompt_id: str = Field(min_length=1)


class ScenarioDefinition(BaseModel):
    """Scenario configuration shared by content authoring and generation."""

    id: str
    display_name: str
    description: str
    difficulty: Difficulty = Difficulty.MEDIUM
    starting_stage: str
    version: str = "1.0.0"
    created_at: str | None = None
    tags: list[str] = Field(default_factory=list)
    learning_objectives: list[str] = Field(default_factory=list)
    stage_sequence: list[StageStep] = Field(default_factory=list)
    difficulty_modifiers: dict[Difficulty, DifficultyModifier] = Field(default_factory=default_difficulty_modifiers)
    category: ScenarioCategory = ScenarioCategory.GROOMING
    render_skin: RenderSkin = RenderSkin.CHAT
    generation_mode: GenerationMode = GenerationMode.DUAL_AGENT
    initiator: ScenarioActorBinding | None = None
    respondent: ScenarioActorBinding | None = None
    authoring: ScenarioActorBinding | None = None

    @model_validator(mode="after")
    def validate_actor_bindings_and_mode(self) -> "ScenarioDefinition":
        """Require canonical role bindings; repository checks resolve their IDs."""
        self.difficulty_modifiers = {**default_difficulty_modifiers(), **self.difficulty_modifiers}
        if self.category is ScenarioCategory.OVERSHARING:
            if self.generation_mode is not GenerationMode.SINGLE_PASS:
                raise ValueError("oversharing scenarios must use generation_mode 'single_pass'")
            if self.initiator or self.respondent:
                raise ValueError("oversharing scenarios may only define the authoring actor binding")
            if self.authoring is None:
                raise ValueError("oversharing scenarios require authoring.persona_id")
            return self

        if self.generation_mode is not GenerationMode.DUAL_AGENT:
            raise ValueError("non-oversharing scenarios must use generation_mode 'dual_agent'")
        if self.authoring:
            raise ValueError("dual_agent scenarios may not define an authoring actor binding")
        if self.initiator is None:
            raise ValueError("dual_agent scenarios require initiator.persona_id")
        if self.respondent is None:
            raise ValueError("dual_agent scenarios require respondent.persona_id")
        return self


# ---------------------------------------------------------------------------
# LLM Output Schema
# ---------------------------------------------------------------------------

class LLMOutputSchema(BaseModel):
    """Exact structure that the LLM must return."""
    reply: str
    current_stage: str
    next_stage: str
    current_objective: str
    objective_completed: bool
    trust_delta: float = Field(default=0.0, ge=-0.3, le=0.3)
    suspicion_delta: float = Field(default=0.0, ge=-0.3, le=0.3)
    flags: list[str] = Field(default_factory=list)
    reasoning: str = ""
    confidence: float = Field(default=0.8, ge=0.0, le=1.0)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

class ValidationError(BaseModel):
    severity: str  # "error" | "warning" | "info"
    code: str
    message: str
    location: str  # e.g. "scenarios/helpful_stranger.json > stage_sequence[0]"
    suggestion: str | None = None


class ValidationReport(BaseModel):
    valid: bool
    errors: list[ValidationError] = Field(default_factory=list)
    warnings: list[ValidationError] = Field(default_factory=list)
    info: list[ValidationError] = Field(default_factory=list)
    total_scenarios: int = 0
    total_personas: int = 0
    total_stages: int = 0
    total_objectives: int = 0
    total_constraints: int = 0


# ---------------------------------------------------------------------------
# Family scenario player API (no scoring fields by design)
# ---------------------------------------------------------------------------

class PublishedScenarioOut(BaseModel):
    id: int
    title: str
    summary: str
    category: ScenarioCategory
    render_skin: RenderSkin
    difficulty: str
    tags: list[str]
    learning_objectives: list[str]
    message_count: int
    checkpoint_count: int
    published_at: str
    supported_participation_modes: list[str]


class PublishedScenarioPageOut(BaseModel):
    """A deliberately small, family-safe page of reviewed scenarios."""

    items: list[PublishedScenarioOut]
    total: int
    page: int
    limit: int


class CreateFamilySessionRequest(BaseModel):
    # A caregiver is selected only through an accepted opaque relationship ref.
    relationship_ref: str | None = Field(default=None, min_length=12, max_length=64)
    detective_mode: bool = False


class FamilySessionOut(BaseModel):
    id: int
    public_id: str | None = None
    session_ref: str | None = None
    owner_ref: str | None = None
    transcript_id: int
    parent_user_id: int | None = None
    # Opaque references are authoritative for new collaboration clients.
    caregiver_ref: str | None = None
    turn_owner_ref: str | None = None
    previous_session_ref: str | None = None
    companion_mode: bool
    detective_mode: bool
    started_at: str
    completed_at: str | None
    state: FamilySessionState = FamilySessionState.IN_PROGRESS
    state_version: int = Field(default=1, ge=1)
    revealed_up_to: int = Field(default=0, ge=0)
    active_checkpoint_element_key: str | None = None
    participation_turn_user_id: int | None = None
    completion_acknowledged_at: str | None = None
    attempt_number: int = Field(default=1, ge=1)
    previous_session_id: int | None = None
    updated_at: str | None = None


class FamilyMessageOut(BaseModel):
    id: int
    sequence: int
    speaker_label: str
    content: str
    pace: str
    is_checkpoint: bool
    checkpoint_prompt: str | None


class CheckpointResponseRequest(BaseModel):
    checkpoint_message_id: int
    responder_role: ParticipantRole
    response_text: str = Field(min_length=1, max_length=10_000)
    flagged_message_ids: list[int] = Field(default_factory=list)
    tactic_tag_guess: str | None = Field(default=None, max_length=100)
    share_with_caregiver: bool = False
    expected_state_version: int | None = Field(default=None, ge=1)
    client_command_id: str | None = Field(default=None, min_length=8, max_length=128)


class CheckpointResponseOut(BaseModel):
    id: int
    checkpoint_message_id: int
    responder_role: ParticipantRole
    response_text: str
    flagged_message_ids: list[int]
    tactic_tag_guess: str | None
    created_at: str
    visibility: FindingVisibility = FindingVisibility.PRIVATE


class ConversationGuideOut(BaseModel):
    id: int
    family_session_id: int
    scenario_summary: str
    child_reasoning_excerpt: dict[str, Any]
    discussion_prompts: list[str]
    completed_together: bool
    generated_at: str


# ---------------------------------------------------------------------------
# Versioned family session, scene, and discovery contracts
# ---------------------------------------------------------------------------

SCENE_SCHEMA_VERSION = 1
SKIN_CONTRACT_VERSION = "1.0"


class PresentationToken(BaseModel):
    """Bounded, non-executable appearance hints for a semantic scene element."""

    model_config = ConfigDict(extra="forbid")

    alignment: Literal["start", "end", "center"] | None = None
    emphasis: Literal["normal", "muted", "strong"] | None = None
    tone: Literal["neutral", "info", "caution", "success"] | None = None
    display_label: str | None = Field(default=None, max_length=160)
    timestamp_label: str | None = Field(default=None, max_length=100)
    alt_text: str | None = Field(default=None, max_length=500)
    local_media_id: str | None = Field(default=None, pattern=r"[a-zA-Z0-9_-]{1,128}")
    href: str | None = Field(default=None, max_length=512)
    # Bounded display-only metadata keeps surface identity explicit and inert.
    app_name: str = Field(default="SafeQuest", min_length=1, max_length=80)
    surface_label: str = Field(default="Scenario", min_length=1, max_length=120)
    channel_name: str | None = Field(default=None, max_length=120)
    member_summary: str | None = Field(default=None, max_length=240)
    presence_summary: str | None = Field(default=None, max_length=160)
    sender_address: str | None = Field(default=None, max_length=254)
    recipient_summary: str | None = Field(default=None, max_length=254)
    subject: str | None = Field(default=None, max_length=240)
    security_notice: str | None = Field(default=None, max_length=300)
    audience_label: str | None = Field(default=None, max_length=120)
    location_label: str | None = Field(default=None, max_length=160)
    routine_label: str | None = Field(default=None, max_length=160)
    profile_handle: str | None = Field(default=None, max_length=100)
    account_age_label: str | None = Field(default=None, max_length=120)
    trade_link_label: str | None = Field(default=None, max_length=160)
    badges: list[str] = Field(default_factory=list, max_length=12)
    stats: list[str] = Field(default_factory=list, max_length=12)
    bio: str | None = Field(default=None, max_length=500)
    panel_kind: Literal["profile", "attachment", "linked_site", "listing", "thread"] | None = None

    @model_validator(mode="after")
    def reject_unsafe_href(self) -> "PresentationToken":
        if self.href and (not self.href.startswith("/") or self.href.startswith("//")):
            raise ValueError("presentation href must be an inert application-relative path")
        if any(not value.strip() or len(value) > 160 for value in self.badges + self.stats):
            raise ValueError("presentation badges and stats must be non-empty bounded labels")
        return self


class SceneActor(BaseModel):
    model_config = ConfigDict(extra="forbid")

    actor_key: str = Field(min_length=1, max_length=100, pattern=r"[a-zA-Z0-9_-]+")
    display_name: str = Field(min_length=1, max_length=160)
    avatar_label: str | None = Field(default=None, max_length=160)


class ElementRelationshipOut(BaseModel):
    relationship: ElementRelationship = ElementRelationship.REFERENCE
    target_element_key: str = Field(min_length=1, max_length=255, pattern=r"[a-zA-Z0-9_-]+")


class SceneElement(BaseModel):
    """Skin-neutral, inspectable content. It deliberately contains no answer key."""

    model_config = ConfigDict(extra="forbid")

    element_key: str = Field(min_length=1, max_length=255, pattern=r"[a-zA-Z0-9_-]+")
    element_type: ElementType
    parent_element_key: str | None = Field(default=None, max_length=255, pattern=r"[a-zA-Z0-9_-]+")
    source_message_id: int | None = Field(default=None, ge=1)
    sequence: int = Field(ge=0)
    content: str | None = Field(default=None, max_length=20_000)
    actor_key: str | None = Field(default=None, max_length=100, pattern=r"[a-zA-Z0-9_-]+")
    timestamp_semantics: TimestampSemantic = TimestampSemantic.NONE
    timestamp: str | None = Field(default=None, max_length=100)
    relationships: list[ElementRelationshipOut] = Field(default_factory=list)
    presentation: PresentationToken = Field(default_factory=PresentationToken)
    selectable: bool = True
    accessible_label: str = Field(min_length=1, max_length=500)
    semantic_role: str = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def require_timestamp_when_described(self) -> "SceneElement":
        if self.timestamp_semantics is not TimestampSemantic.NONE and not self.timestamp:
            raise ValueError("timestamp is required when timestamp_semantics is set")
        return self


SceneElementOut = SceneElement


class SceneDefinition(BaseModel):
    """Versioned scene contract shared by player, previews, fixtures, and validation."""

    model_config = ConfigDict(extra="forbid")

    scene_schema_version: Literal[SCENE_SCHEMA_VERSION] = SCENE_SCHEMA_VERSION
    skin_version: str = Field(default=SKIN_CONTRACT_VERSION, pattern=r"\d+\.\d+")
    render_skin: RenderSkin
    layout_mode: Literal["default", "compact"] = "default"
    actors: list[SceneActor] = Field(default_factory=list)
    elements: list[SceneElement] = Field(default_factory=list)
    supported_actions: list[Literal["select", "request_hint"]] = Field(default_factory=lambda: ["select"])

    @model_validator(mode="after")
    def validate_structure(self) -> "SceneDefinition":
        keys = {element.element_key for element in self.elements}
        if len(keys) != len(self.elements):
            raise ValueError("scene element keys must be unique")
        actor_keys = {actor.actor_key for actor in self.actors}
        if len(actor_keys) != len(self.actors):
            raise ValueError("scene actor keys must be unique")
        for element in self.elements:
            if element.parent_element_key == element.element_key:
                raise ValueError("scene element cannot be its own parent")
            if element.parent_element_key and element.parent_element_key not in keys:
                raise ValueError("scene element parent must exist in the same scene")
            if element.actor_key and actor_keys and element.actor_key not in actor_keys:
                raise ValueError("scene element actor_key must identify a scene actor")
            if any(link.target_element_key not in keys for link in element.relationships):
                raise ValueError("scene relationship target must exist in the same scene")
        return self


SKIN_CAPABILITIES: dict[RenderSkin, frozenset[ElementType]] = {
    RenderSkin.CHAT: frozenset({ElementType.CONVERSATION, ElementType.MESSAGE, ElementType.PROFILE, ElementType.PROFILE_FIELD, ElementType.ATTACHMENT, ElementType.LINK_PREVIEW, ElementType.SYSTEM_EVENT, ElementType.ACTION}),
    RenderSkin.EMAIL: frozenset({ElementType.CONVERSATION, ElementType.MESSAGE, ElementType.EMAIL, ElementType.EMAIL_THREAD, ElementType.EMAIL_MESSAGE, ElementType.EMAIL_HEADER, ElementType.PROFILE, ElementType.PROFILE_FIELD, ElementType.ATTACHMENT, ElementType.LINK_PREVIEW, ElementType.SYSTEM_EVENT, ElementType.ACTION}),
    RenderSkin.SOCIAL_FEED: frozenset({ElementType.CONVERSATION, ElementType.MESSAGE, ElementType.FEED, ElementType.POST, ElementType.COMMENT, ElementType.PROFILE, ElementType.PROFILE_FIELD, ElementType.ATTACHMENT, ElementType.LINK_PREVIEW, ElementType.SYSTEM_EVENT, ElementType.ACTION}),
    RenderSkin.GAME_CHAT: frozenset({ElementType.CONVERSATION, ElementType.MESSAGE, ElementType.PROFILE, ElementType.PROFILE_FIELD, ElementType.ATTACHMENT, ElementType.LINK_PREVIEW, ElementType.SYSTEM_EVENT, ElementType.ACTION, ElementType.GAME_PROFILE, ElementType.GAME_STAT, ElementType.GAME_BADGE, ElementType.SERVER, ElementType.CHANNEL, ElementType.MEMBER}),
    RenderSkin.FORUM: frozenset({ElementType.CONVERSATION, ElementType.MESSAGE, ElementType.PROFILE, ElementType.PROFILE_FIELD, ElementType.ATTACHMENT, ElementType.LINK_PREVIEW, ElementType.SYSTEM_EVENT, ElementType.ACTION, ElementType.FORUM_THREAD, ElementType.FORUM_POST, ElementType.COMMENT, ElementType.SITE_SECTION}),
    RenderSkin.MARKETPLACE: frozenset({ElementType.CONVERSATION, ElementType.MESSAGE, ElementType.PROFILE, ElementType.PROFILE_FIELD, ElementType.ATTACHMENT, ElementType.LINK_PREVIEW, ElementType.SYSTEM_EVENT, ElementType.ACTION, ElementType.LISTING, ElementType.SELLER, ElementType.PRICE, ElementType.LISTING_FIELD}),
}


def validate_scene_for_skin(scene: SceneDefinition, *, require_selectable: bool = False) -> SceneDefinition:
    if scene.skin_version != SKIN_CONTRACT_VERSION:
        raise ValueError(f"scene uses unsupported skin version {scene.skin_version!r}; expected {SKIN_CONTRACT_VERSION}")
    unsupported = [element.element_type.value for element in scene.elements if element.element_type not in SKIN_CAPABILITIES[scene.render_skin]]
    if unsupported:
        raise ValueError("scene uses element types unsupported by its skin: " + ", ".join(unsupported))
    if require_selectable and not any(element.selectable for element in scene.elements):
        raise ValueError("scene requires at least one selectable element")
    return scene


class SceneAnnotationDraft(BaseModel):
    """Admin-only ground-truth annotation; never included in player scene payloads."""

    model_config = ConfigDict(extra="forbid")

    element_key: str = Field(min_length=1, max_length=255, pattern=r"[a-zA-Z0-9_-]+")
    tactic_tag: str = Field(min_length=1, max_length=100)
    start_offset: int | None = Field(default=None, ge=0)
    end_offset: int | None = Field(default=None, ge=0)
    explanation: str | None = Field(default=None, max_length=2_000)
    tiered_hints: list[str] = Field(default_factory=list, max_length=3)

    @model_validator(mode="after")
    def validate_range(self) -> "SceneAnnotationDraft":
        if (self.start_offset is None) != (self.end_offset is None):
            raise ValueError("annotation start_offset and end_offset must be supplied together")
        if self.start_offset is not None and self.end_offset is not None and self.end_offset <= self.start_offset:
            raise ValueError("annotation end_offset must be greater than start_offset")
        if any(not hint.strip() or len(hint) > 500 for hint in self.tiered_hints):
            raise ValueError("tiered hints must be non-empty and no longer than 500 characters")
        return self


class AdminSceneDraft(BaseModel):
    """Validated, inspectable scene input used by admin preview and publication review."""

    model_config = ConfigDict(extra="forbid")

    category: ScenarioCategory
    scene: SceneDefinition
    annotations: list[SceneAnnotationDraft] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_inspectable_content(self) -> "AdminSceneDraft":
        from app.generation.taxonomy import TACTIC_TAGS_BY_CATEGORY

        validate_scene_for_skin(self.scene)
        elements = {element.element_key: element for element in self.scene.elements}
        allowed_tags = set(TACTIC_TAGS_BY_CATEGORY[self.category])
        for annotation in self.annotations:
            element = elements.get(annotation.element_key)
            if element is None:
                raise ValueError(f"annotation target {annotation.element_key!r} does not exist in the scene")
            if not element.selectable:
                raise ValueError(f"annotation target {annotation.element_key!r} must be selectable")
            if annotation.tactic_tag not in allowed_tags:
                raise ValueError(f"annotation tactic tag {annotation.tactic_tag!r} is not allowed for {self.category.value}")
            if annotation.start_offset is not None:
                if annotation.end_offset is None or annotation.end_offset > len(element.content or ""):
                    raise ValueError(f"annotation range for {annotation.element_key!r} is outside its public content")
        return self


def validate_scene_draft_for_publication(draft: AdminSceneDraft) -> AdminSceneDraft:
    validate_scene_for_skin(draft.scene, require_selectable=True)
    if not draft.annotations:
        raise ValueError("publication requires at least one reviewed red-flag annotation")
    return draft


class FamilySceneOut(SceneDefinition):
    # Temporary compatibility payload. New skins use ``elements``.
    messages: list[FamilyMessageOut] = Field(default_factory=list)


class SessionProgressOut(BaseModel):
    reviewed_element_count: int = Field(default=0, ge=0)
    validated_finding_count: int = Field(default=0, ge=0)
    eligible_target_count: int = Field(default=0, ge=0)
    required_finding_count: int = Field(default=0, ge=0)
    checkpoint_progress: int = Field(default=0, ge=0)
    content_progress: int = Field(default=0, ge=0)
    completion_ready: bool = False


class FamilySessionParticipantOut(BaseModel):
    member_ref: str
    display_name: str
    avatar_url: str | None = None
    role: FamilyRole
    joined_at: str
    last_seen_at: str | None = None
    left_at: str | None = None
    presence_status: ParticipantPresenceStatus = ParticipantPresenceStatus.OFFLINE
    presence_expires_at: str | None = None


class FamilySessionCapabilitiesOut(BaseModel):
    can_reveal_next: bool = False
    can_continue_checkpoint: bool = False
    can_enter_completion_review: bool = False
    can_acknowledge_completion: bool = False
    can_open_help: bool = False
    can_complete: bool = False
    can_reset: bool = True
    can_submit_flag_attempt: bool = False
    can_request_hint: bool = False
    can_use_private_companion: bool = False
    can_join_or_observe: bool = False
    can_contribute_shared_prompts: bool = False
    can_review_shared_results: bool = False
    can_invite_before_start: bool = False
    can_remove_before_start: bool = False
    can_leave: bool = False
    can_heartbeat: bool = False
    can_publish_selection_focus: bool = False
    can_submit_shared_reflection: bool = False
    can_add_caregiver_comment: bool = False
    can_edit_own_caregiver_comment: bool = False
    can_request_shared_companion_feedback: bool = False


class FamilySessionDetailOut(BaseModel):
    session_schema_version: int = 3
    session: FamilySessionOut
    scene: FamilySceneOut
    progress: SessionProgressOut
    participants: list[FamilySessionParticipantOut] = Field(default_factory=list)
    participant_role: FamilyRole = FamilyRole.LEARNER
    capabilities: FamilySessionCapabilitiesOut = Field(default_factory=FamilySessionCapabilitiesOut)
    findings: list["ValidatedFindingOut"] = Field(default_factory=list)
    caregiver_comments: list["FamilyCaregiverCommentOut"] = Field(default_factory=list)


class FamilySessionCommandRequest(BaseModel):
    command: FamilySessionCommandType
    expected_state_version: int = Field(ge=1)
    client_command_id: str = Field(min_length=8, max_length=128)


class FlagAttemptRequest(BaseModel):
    element_key: str = Field(min_length=1, max_length=255)
    reasoning: str = Field(min_length=1, max_length=10_000)
    claim: Literal["red_flag", "not_red_flag", "unsure"]
    client_command_id: str = Field(min_length=8, max_length=128)
    share_reasoning_with_caregiver: bool = False

    @model_validator(mode="before")
    def accept_legacy_claim(cls, data: Any) -> Any:
        if isinstance(data, dict):
            data = dict(data)
            if "claim" not in data and "claimed_red_flag" in data:
                data["claim"] = "red_flag" if data["claimed_red_flag"] else "not_red_flag"
            data.setdefault("client_command_id", "legacy-command")
        return data


class HintRequest(BaseModel):
    element_key: str = Field(min_length=1, max_length=255)
    client_command_id: str = Field(min_length=8, max_length=128)


class ValidatedFindingOut(BaseModel):
    element_key: str
    annotation_id: int
    tactic_tag: str
    explanation: str | None = None
    discovered_at: str
    visibility: FindingVisibility


class FlagAttemptOut(BaseModel):
    id: int
    element_key: str
    claim: Literal["red_flag", "not_red_flag", "unsure"]
    validation_result: FlagValidationResult
    feedback: dict[str, Any] = Field(default_factory=dict)
    disclosure_triggered: bool = False
    created_at: str
    findings: list[ValidatedFindingOut] = Field(default_factory=list)
    progress: SessionProgressOut


class HintOut(BaseModel):
    element_key: str
    hint_level: int = Field(ge=1)
    hint: str


class FamilySessionEventOut(BaseModel):
    id: int
    sequence: int
    event_type: FamilySessionEventType
    actor_ref: str | None = None
    payload: dict[str, Any] = Field(default_factory=dict)
    is_ephemeral: bool = False
    created_at: str


class FamilyPresenceHeartbeatRequest(BaseModel):
    client_event_id: str = Field(min_length=8, max_length=128)
    status: Literal["online", "offline"] = "online"


class FamilySelectionFocusRequest(BaseModel):
    element_key: str = Field(min_length=1, max_length=255)
    client_event_id: str = Field(min_length=8, max_length=128)


class FamilyCaregiverCommentCreateRequest(BaseModel):
    element_key: str | None = Field(default=None, min_length=1, max_length=255)
    annotation_id: int | None = Field(default=None, ge=1)
    text: str = Field(min_length=1, max_length=2_000)
    client_command_id: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def require_single_anchor(self) -> "FamilyCaregiverCommentCreateRequest":
        if (self.element_key is None) == (self.annotation_id is None):
            raise ValueError("A caregiver comment needs exactly one scene element or finding anchor")
        return self


class FamilyCaregiverCommentUpdateRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2_000)


class FamilyCaregiverCommentOut(BaseModel):
    comment_ref: str
    author_ref: str
    author_display_name: str
    element_key: str | None = None
    annotation_id: int | None = None
    text: str
    child_visible_label: str
    created_at: str
    updated_at: str


class SharedCompanionFeedbackRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)
    element_key: str | None = Field(default=None, min_length=1, max_length=255)
    client_command_id: str = Field(min_length=8, max_length=128)


class SharedCompanionFeedbackOut(BaseModel):
    response_text: str
    element_key: str | None = None
    shared: bool
    support_resources: list["SupportResourceOut"] = Field(default_factory=list)


FamilySessionDetailOut.model_rebuild()


class FamilyRelationshipInvitationCreateRequest(BaseModel):
    learner_email: str = Field(min_length=3, max_length=255)
    delivery_label: str | None = Field(default=None, max_length=120)


class FamilyRelationshipInvitationOut(BaseModel):
    invitation_ref: str
    status: str
    expires_at: str
    created_at: str
    delivery_label: str | None = None
    token: str | None = None
    short_code: str | None = None


class FamilyRelationshipInvitationAcceptRequest(BaseModel):
    secret: str = Field(min_length=6, max_length=512)


class FamilyRelationshipOut(BaseModel):
    relationship_ref: str
    role: FamilyRole
    member_ref: str
    member_display_name: str
    member_avatar_url: str | None = None
    accepted_at: str
    status: str
    historical_sessions_remain_available: bool = True


class FamilyRelationshipPreviewOut(BaseModel):
    invitation_ref: str
    inviter_display_name: str
    intended_role: FamilyRole = FamilyRole.LEARNER
    expires_at: str
    sharing_summary: str


class FamilyRelationshipUpdateRequest(BaseModel):
    action: Literal["unlink", "block"]


class FamilyAuthorizedSessionOut(BaseModel):
    session_ref: str
    transcript_id: int
    state: FamilySessionState
    role: FamilyRole
    owner_ref: str
    started_at: str
    completed_at: str | None = None


# ---------------------------------------------------------------------------
# Typed, permission-gated admin diagnostics
# ---------------------------------------------------------------------------

class DiagnosticWarningOut(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "error"] = "info"
    source: str = "runtime"


class SimulationOverviewOut(BaseModel):
    id: int
    scenario_id: str | None
    mode: str
    status: str
    created_at: str
    stop_reason: str | None = None


class SimulationProgressionOut(BaseModel):
    current_stage: str | None = None
    next_stage: str | None = None
    current_objective: str | None = None
    completed_objectives: list[str] = Field(default_factory=list)


class SimulationObjectiveStateOut(BaseModel):
    current: str | None = None
    completed: list[str] = Field(default_factory=list)
    pending: list[str] = Field(default_factory=list)


class SimulationSafetyFindingOut(BaseModel):
    code: str
    message: str
    severity: Literal["info", "warning", "error"] = "warning"
    source: str = "llm_evaluation"


class PromptProvenanceOut(BaseModel):
    id: str
    name: str
    role: str
    version: str | None = None
    hash: str | None = None
    role_scope: str | None = None


class ResourceUsageOut(BaseModel):
    messages: int = Field(default=0, ge=0)
    message_limit: int = Field(default=0, ge=0)
    message_percent: int = Field(default=0, ge=0, le=100)
    running_seconds: int = Field(default=0, ge=0)
    minute_limit: int = Field(default=0, ge=0)
    time_percent: int = Field(default=0, ge=0, le=100)
    llm_calls: int = Field(default=0, ge=0)
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)


class WorkerLeaseOut(BaseModel):
    worker_id: str | None = None
    leased_until: str | None = None
    state: str | None = None
    healthy: bool = False


class SimulationRevisionOut(BaseModel):
    id: int
    message_id: int
    number: int
    created_at: str


class SimulationBranchSummaryOut(BaseModel):
    active_branch: str = "main"
    branch_count: int = Field(default=1, ge=1)
    revision_count: int = Field(default=0, ge=0)
    latest_revision_id: int | None = None


class SimulationEventOut(BaseModel):
    id: int
    sequence: int
    event_type: str
    category: Literal["lifecycle", "transcript", "revision", "resources", "safety", "system"]
    severity: Literal["info", "warning", "error"] = "info"
    label: str
    created_at: str
    payload: dict[str, Any] = Field(default_factory=dict)
    raw_payload: dict[str, Any] | None = None


class SimulationDiagnosticsOut(BaseModel):
    progression: SimulationProgressionOut = Field(default_factory=SimulationProgressionOut)
    objectives: SimulationObjectiveStateOut = Field(default_factory=SimulationObjectiveStateOut)
    warnings: list[DiagnosticWarningOut] = Field(default_factory=list)
    safety_findings: list[SimulationSafetyFindingOut] = Field(default_factory=list)
    tactic_tags: list[str] = Field(default_factory=list)
    prompt_provenance: list[PromptProvenanceOut] = Field(default_factory=list)


class SimulationDetailOut(BaseModel):
    overview: SimulationOverviewOut
    diagnostics: SimulationDiagnosticsOut = Field(default_factory=SimulationDiagnosticsOut)
    resource_usage: ResourceUsageOut = Field(default_factory=ResourceUsageOut)
    worker_lease: WorkerLeaseOut = Field(default_factory=WorkerLeaseOut)
    branch_summary: SimulationBranchSummaryOut = Field(default_factory=SimulationBranchSummaryOut)
    revisions: list[SimulationRevisionOut] = Field(default_factory=list)
    events: list[SimulationEventOut] = Field(default_factory=list)
    raw_diagnostics: dict[str, Any] | None = None


# ---------------------------------------------------------------------------
# Companion AI (separate from content-generation personas)
# ---------------------------------------------------------------------------
class SupportResourceOut(BaseModel):
    label: str
    href: str

class CompanionCheckpointRequest(BaseModel):
    checkpoint_message_id: int
    child_response_text: str = Field(min_length=1, max_length=10_000)
    flagged_message_ids: list[int] = Field(default_factory=list)
    tactic_tag_guess: str | None = Field(default=None, max_length=100)
    client_command_id: str | None = Field(default=None, min_length=8, max_length=128)

class CompanionCheckpointOut(BaseModel):
    response_text: str
    child_response: CheckpointResponseOut
    checkpoint_response: CheckpointResponseOut
    disclosure_triggered: bool
    support_resources: list[SupportResourceOut] = Field(default_factory=list)

class CompanionExplainRequest(BaseModel):
    message: str = Field(min_length=1, max_length=10_000)

class CompanionExplainOut(BaseModel):
    response_text: str
    disclosure_triggered: bool
    support_resources: list[SupportResourceOut] = Field(default_factory=list)


SharedCompanionFeedbackOut.model_rebuild()
