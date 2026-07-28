// TypeScript interfaces for all backend content types
// Mirrors app/models/content_schemas.py

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type ViolationSeverity = 'low' | 'medium' | 'high' | 'critical';
export type MessageLength = 'very_short' | 'short' | 'medium' | 'long';
export type HumourStyle = 'dry' | 'playful' | 'sarcastic' | 'none';
export type ResponseStyle = 'reactive' | 'proactive';
export type EscalationSpeed = 'slow' | 'medium' | 'fast';

// ── Stage ──────────────────────────────────────────────────────────────────

export interface StageDefinition {
  id: string;
  display_name: string;
  description: string;
  allowed_next: string[];
  default_constraints: string[];
  min_turns: number;
  max_turns: number;
  preferred_style: string;
}

// ── Objective — modelled as a hidden intent ────────────────────────────────

export interface ObjectiveDefinition {
  id: string;
  display_name: string;
  description: string; // admin display only
  hidden_intent: string; // what the LLM sees — background desire, not task
  natural_triggers: string[];
  priority: number;
  patience: number;
  success_signals: string[];
}

// ── Persona ────────────────────────────────────────────────────────────────

export interface ConversationStyle {
  uses_lowercase: boolean;
  omits_end_punctuation: boolean;
  emoji_frequency: number; // 0.0–1.0
  average_message_length: MessageLength;
  double_texts: boolean;
  initiates_topic_changes: boolean;
  uses_slang: boolean;
  humour: HumourStyle;
  response_style: ResponseStyle;
}

export interface PersonaDefinition {
  id: string;
  display_name: string;
  description: string; // admin display only
  cover_story: string;
  claimed_age: number;
  claimed_location: string;
  claimed_interests: string[];
  manipulation_style: string;
  escalation_speed: EscalationSpeed;
  conversation_style: ConversationStyle;
  tone: string[];
}

// ── Constraint ─────────────────────────────────────────────────────────────

export interface ConstraintDefinition {
  id: string;
  description: string;
  forbidden_actions: string[];
  forbidden_phrases: string[];
  forbidden_topics: string[];
  required_behaviours: string[];
  violation_severity: ViolationSeverity;
  recovery_suggestion: string;
}

// ── Scenario ───────────────────────────────────────────────────────────────

export interface DifficultyModifier {
  trust_delta_multiplier: number;
  escalation_speed: 'slow' | 'medium' | 'fast';
  red_flag_visibility: 'low' | 'medium' | 'high';
  trust_context_balance: number;
  min_safe_message_ratio: number;
  max_suspicious_targets: number;
  min_distinct_tactics: number;
  target_pacing_message_count: number;
}

export interface StageStep {
  stage: string;
  mandatory_objectives: string[];
  optional_objectives: string[];
  constraints: string[];
}

export interface ScenarioDefinition {
  id: string;
  display_name: string;
  description: string;
  difficulty: Difficulty;
  starting_stage: string;
  version: string;
  created_at?: string;
  tags: string[];
  learning_objectives: string[];
  stage_sequence: StageStep[];
  difficulty_modifiers: Record<Difficulty, DifficultyModifier>;
  category: ScenarioCategory;
  render_skin: RenderSkin;
  generation_mode: GenerationMode;
  initiator?: ScenarioActorBinding | null;
  respondent?: ScenarioActorBinding | null;
  authoring?: ScenarioActorBinding | null;
}

export type ScenarioCategory = 'grooming' | 'cyberbullying' | 'scam' | 'image_request' | 'oversharing';
export type GenerationMode = 'dual_agent' | 'single_pass';

export interface ScenarioActorBinding {
  persona_id: string;
  dialogue_prompt_id: string;
}

export interface PromptTemplate {
  name: string;
  content: string;
  variables: string[];
  description: string;
  kind: 'system' | 'dialogue' | 'single_pass';
  role_scope: 'initiator' | 'respondent' | 'either' | 'authoring' | 'system';
  version: string;
}

// ── Durable admin simulation runtime (admin-only API) ──────────────────────
export type SimulationMode = 'ai_vs_ai' | 'admin_as_respondent' | 'single_pass';
export type SimulationStatus = 'running' | 'paused' | 'awaiting_admin' | 'ready_for_review' | 'approved' | 'rejected' | 'failed' | 'failed_retryable' | 'failed_terminal' | 'limit_reached';
export interface SimulationMessage {
  id: number;
  sequence: number;
  branch_id: string;
  sender: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at?: string;
}
export interface SimulationRevision {
  id: number;
  message_id: number;
  number: number;
  content: string;
  metadata: Record<string, unknown>;
  supersedes_revision_id: number | null;
  created_at?: string;
}
export interface SimulationRun {
  id: number;
  scenario_id: string | null;
  mode: SimulationMode;
  status: SimulationStatus;
  created_at: string;
  stop_reason?: string | null;
  overview?: SimulationOverview;
  diagnostics?: SimulationDiagnostics;
  resource_usage?: ResourceUsage;
  worker_lease?: WorkerLease;
  branch_summary?: SimulationBranchSummary;
  events?: SimulationEvent[];
  raw_diagnostics?: Record<string, unknown>;
  // Legacy compact fields retained while the workbench moves to typed diagnostics.
  usage?: Record<string, unknown>;
  progress?: Record<string, unknown>;
  worker_status?: Record<string, unknown>;
  personas?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  messages?: SimulationMessage[];
  revisions?: SimulationRevision[];
  config_snapshot?: Record<string, any>;
}

export interface SimulationOverview { id: number; scenario_id: string | null; mode: SimulationMode; status: SimulationStatus; created_at: string; stop_reason: string | null; }
export interface DiagnosticWarning { code: string; message: string; severity: "info" | "warning" | "error"; source: string; }
export interface SimulationProgression { current_stage: string | null; next_stage: string | null; current_objective: string | null; completed_objectives: string[]; }
export interface SimulationObjectiveState { current: string | null; completed: string[]; pending: string[]; }
export interface SimulationSafetyFinding { code: string; message: string; severity: "info" | "warning" | "error"; source: string; }
export interface PromptProvenance { id: string; name: string; role: string; version: string | null; hash: string | null; role_scope: string | null; }
export interface ResourceUsage { messages: number; message_limit: number; message_percent: number; running_seconds: number; minute_limit: number; time_percent: number; llm_calls: number; prompt_tokens: number; completion_tokens: number; }
export interface WorkerLease { worker_id: string | null; leased_until: string | null; state: string | null; healthy: boolean; }
export interface SimulationBranchSummary { active_branch: string; branch_count: number; revision_count: number; latest_revision_id: number | null; }
export interface SimulationEvent { id: number; sequence: number; event_type: string; category: "lifecycle" | "transcript" | "revision" | "resources" | "safety" | "system"; severity: "info" | "warning" | "error"; label: string; created_at: string; payload: Record<string, unknown>; raw_payload?: Record<string, unknown>; }
export interface SimulationDiagnostics { progression: SimulationProgression; objectives: SimulationObjectiveState; warnings: DiagnosticWarning[]; safety_findings: SimulationSafetyFinding[]; tactic_tags: string[]; prompt_provenance: PromptProvenance[]; flags?: string[]; }
export interface SimulationHistoryPage { items: SimulationRun[]; page: number; page_size: number; total: number; }
export interface SimulationEventHistoryPage { items: SimulationEvent[]; page: number; page_size: number; total: number; }


// ── Validation types ───────────────────────────────────────────────────────

export interface ValidationError {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  location: string;
  suggestion?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  total_scenarios: number;
  total_personas: number;
  total_stages: number;
  total_objectives: number;
  total_constraints: number;
}

// ── Dashboard ──────────────────────────────────────────────────────────────

export interface ConfigSummary {
  scenarios: Array<{ id: string; display_name: string; difficulty: Difficulty }>;
  personas: string[];
  stages: string[];
  objectives: string[];
  constraints: string[];
  prompt_templates: string[];
  observability: {
    review_ready_count: number;
    unpublished_approved_transcript_count: number;
    active_run_count: number;
    failed_run_count: number;
    limited_run_count: number;
    validation_blocker_count: number;
    recently_published: Array<{ id: number; scenario_id: string | null; category: string; published_at: string | null }>;
    system_health: { database: "available" | "unavailable"; llm: "available" | "unavailable" };
  };
}

// ── Family scenario player ────────────────────────────────────────────────

export type RenderSkin = 'chat' | 'email' | 'social_feed' | 'game_chat' | 'forum' | 'marketplace';
export type ParticipantRole = 'child' | 'parent' | 'ai_companion';

export type FamilySessionState = "waiting_for_participants" | "in_progress" | "checkpoint" | "completion_review" | "help_and_resources" | "completed" | "paused_for_support" | "abandoned" | "expired";
export type FamilySessionCommandType = "start" | "reveal_next" | "continue_checkpoint" | "enter_completion_review" | "acknowledge_completion" | "open_help" | "complete" | "reset";
export type FamilyRole = "learner" | "caregiver";
export type ScenarioLifecycle = "not_started" | "active" | "completed";
export type ParticipantPresenceStatus = "online" | "offline" | "left";
export type FamilySessionEventType = "participant_joined" | "participant_left" | "participant_presence" | "state_changed" | "reveal" | "selection_focus" | "attempt_submitted" | "finding_validated" | "checkpoint_response" | "companion_shared_feedback" | "caregiver_comment" | "completed" | "guide_ready";
export type ElementType = "conversation" | "message" | "email" | "email_thread" | "email_message" | "email_header" | "feed" | "post" | "comment" | "profile" | "profile_field" | "attachment" | "link_preview" | "game_profile" | "game_stat" | "game_badge" | "server" | "channel" | "member" | "listing" | "seller" | "price" | "forum_thread" | "forum_post" | "site_section" | "listing_field" | "system_event" | "action";
export type SceneElementType = ElementType;
export type ElementRelationship = "root" | "parent_child" | "reference";
export type TimestampSemantic = "exact" | "relative" | "none";
export interface PresentationToken {
  alignment?: "start" | "end" | "center";
  emphasis?: "normal" | "muted" | "strong";
  tone?: "neutral" | "info" | "caution" | "success";
  display_label?: string; timestamp_label?: string; alt_text?: string; local_media_id?: string;
  /** Always inert and application-relative; never use for browser navigation. */
  href?: string;
  app_name?: string; surface_label?: string; channel_name?: string; member_summary?: string; presence_summary?: string;
  sender_address?: string; recipient_summary?: string; subject?: string; security_notice?: string;
  audience_label?: string; location_label?: string; routine_label?: string; profile_handle?: string;
  account_age_label?: string; trade_link_label?: string; badges?: string[]; stats?: string[]; bio?: string;
  panel_kind?: "profile" | "attachment" | "linked_site" | "listing" | "thread";
}
export interface SceneActor { actor_key: string; display_name: string; avatar_label?: string | null; role?: 'initiator' | 'respondent' | 'learner' | 'caregiver' | 'ai_companion' | 'simulated_character' | null; }
export interface ElementRelationshipTarget { relationship: ElementRelationship; target_element_key: string; }
export type FlagValidationResult = "pending" | "validated" | "not_a_flag" | "needs_support";
export type FindingVisibility = "private" | "shared";

export interface SceneElement {
  element_key: string;
  element_type: SceneElementType;
  parent_element_key: string | null;
  source_message_id: number | null;
  sequence: number;
  content: string | null;
  actor_key?: string | null;
  timestamp_semantics?: TimestampSemantic;
  timestamp?: string | null;
  relationships?: ElementRelationshipTarget[];
  presentation: PresentationToken;
  selectable: boolean;
  accessible_label: string;
  semantic_role: string;
}

export interface SessionProgress {
  reviewed_element_count: number;
  validated_finding_count: number;
  eligible_target_count: number;
  required_finding_count: number;
  checkpoint_progress: number;
  checkpoint_total?: number;
  content_progress: number;
  content_total?: number;
  completion_ready: boolean;
}

export interface FamilySessionParticipant {
  member_ref: string;
  display_name: string;
  avatar_url: string | null;
  role: FamilyRole;
  joined_at: string;
  last_seen_at: string | null;
  left_at?: string | null;
  presence_status?: ParticipantPresenceStatus;
  presence_expires_at?: string | null;
}

export interface FamilyRelationshipInvitation {
  invitation_ref: string;
  status: 'pending' | 'accepted' | 'declined' | 'revoked' | 'expired';
  expires_at: string;
  created_at: string;
  delivery_label?: string | null;
  token?: string | null;
  short_code?: string | null;
  inviter_role?: FamilyRole;
  intended_role?: FamilyRole;
  direction?: 'sent' | 'received' | null;
}

export interface FamilyRelationship {
  relationship_ref: string;
  role: FamilyRole;
  viewer_role?: FamilyRole | null;
  member_role?: FamilyRole | null;
  member_ref: string;
  member_display_name: string;
  member_avatar_url?: string | null;
  accepted_at: string;
  status: 'active' | 'revoked' | 'blocked';
  historical_sessions_remain_available: boolean;
}

export interface FamilyAuthorizedSession {
  session_ref: string;
  transcript_id: number;
  state: FamilySessionState;
  role: FamilyRole;
  owner_ref: string;
  started_at: string;
  completed_at: string | null;
  lifecycle: ScenarioLifecycle;
}

export interface PublishedFamilyScenario {
  id: number;
  title: string;
  summary: string;
  category: string;
  render_skin: RenderSkin;
  difficulty: string;
  tags: string[];
  learning_objectives: string[];
  message_count: number;
  checkpoint_count: number;
  published_at: string;
  supported_participation_modes: string[];
  lifecycle: ScenarioLifecycle;
  session_ref: string | null;
}

export interface PublishedFamilyScenarioPage {
  items: PublishedFamilyScenario[];
  total: number;
  page: number;
  limit: number;
}

export interface FamilyScenarioQuery {
  search?: string;
  category?: string[];
  difficulty?: string[];
  render_skin?: RenderSkin[];
  sort?: 'newest' | 'title' | 'difficulty' | 'shortest';
  page?: number;
  limit?: number;
}

export interface FamilySession {
  id: number;
  public_id?: string | null;
  session_ref?: string | null;
  owner_ref?: string | null;
  caregiver_ref?: string | null;
  turn_owner_ref?: string | null;
  previous_session_ref?: string | null;
  transcript_id: number;
  companion_mode: boolean;
  detective_mode: boolean;
  started_at: string;
  completed_at: string | null;
  state?: FamilySessionState;
  state_version?: number;
  revealed_up_to?: number;
  active_checkpoint_element_key?: string | null;
  completion_acknowledged_at?: string | null;
  attempt_number?: number;
  previous_session_id?: number | null;
  updated_at?: string | null;
}

export interface FamilyMessage {
  id: number;
  sequence: number;
  speaker_label: string;
  content: string;
  pace: string;
  is_checkpoint: boolean;
  checkpoint_prompt: string | null;
}

export interface SceneDefinition {
  scene_schema_version: 1;
  skin_version: string;
  render_skin: RenderSkin;
  layout_mode?: "default" | "compact";
  actors?: SceneActor[];
  elements: SceneElement[];
  supported_actions?: Array<"select" | "request_hint">;
}

export interface FamilyScene extends SceneDefinition {
  messages: FamilyMessage[];
}

/** Admin-only ground truth, intentionally separate from player scene payloads. */
export interface SceneAnnotationDraft {
  element_key: string;
  tactic_tag: string;
  start_offset?: number | null;
  end_offset?: number | null;
  explanation?: string | null;
  tiered_hints: string[];
  repeat_justification?: string | null;
}

export interface AdminSceneDraft {
  category: ScenarioCategory;
  scene: SceneDefinition;
  annotations: SceneAnnotationDraft[];
}

export interface AdminReviewQueueItem {
  kind: 'simulation' | 'content_review';
  id: number;
  scenario_id: string | null;
  mode: SimulationMode | null;
  status: string;
  created_at: string;
}

export interface SkinCapabilityManifest {
  skin_contract_version: string;
  tactic_tags_by_category: Record<ScenarioCategory, string[]>;
  skins: Array<{
    id: RenderSkin;
    version: string;
    supported_element_types: ElementType[];
    responsive_modes: Array<'default' | 'compact'>;
  }>;
}

export interface FamilySessionCapabilities {
  can_start: boolean;
  can_reveal_next: boolean;
  can_continue_checkpoint: boolean;
  can_enter_completion_review: boolean;
  can_acknowledge_completion: boolean;
  can_open_help: boolean;
  can_complete: boolean;
  can_reset: boolean;
  can_submit_flag_attempt: boolean;
  can_request_hint: boolean;
  can_use_private_companion: boolean;
  can_join_or_observe: boolean;
  can_contribute_shared_prompts: boolean;
  can_review_shared_results: boolean;
  can_invite_before_start: boolean;
  can_remove_before_start: boolean;
  can_leave: boolean;
  can_heartbeat: boolean;
  can_publish_selection_focus: boolean;
  can_submit_shared_reflection: boolean;
  can_add_caregiver_comment: boolean;
  can_edit_own_caregiver_comment: boolean;
  can_request_shared_companion_feedback: boolean;
}

export interface FamilySessionCommandRequest {
  command: FamilySessionCommandType;
  expected_state_version: number;
  client_command_id: string;
}

export interface FamilySessionDetail {
  session_schema_version: 3;
  session: FamilySession & {
    state: FamilySessionState;
    state_version: number;
    revealed_up_to: number;
    active_checkpoint_element_key: string | null;
    updated_at: string | null;
  };
  scene: FamilyScene;
  progress: SessionProgress;
  participants: FamilySessionParticipant[];
  participant_role: FamilyRole;
  capabilities: FamilySessionCapabilities;
  findings: ValidatedFinding[];
  caregiver_comments: FamilyCaregiverComment[];
}

export interface FlagAttemptRequest {
  element_key: string;
  reasoning: string;
  claim: "red_flag" | "not_red_flag" | "unsure";
  client_command_id: string;
  share_reasoning_with_caregiver?: boolean;
}

export interface ValidatedFinding {
  /** Stable key for a curator-grounded, merged safety insight. */
  insight_key?: string;
  element_key: string;
  annotation_id: number;
  tactic_tag: string;
  explanation: string | null;
  element_keys?: string[];
  annotation_ids?: number[];
  discovered_at: string;
  visibility: FindingVisibility;
}

export interface FlagAttempt {
  id: number;
  element_key: string;
  claim: "red_flag" | "not_red_flag" | "unsure";
  validation_result: FlagValidationResult;
  feedback: Record<string, unknown>;
  disclosure_triggered: boolean;
  created_at: string;
  findings: ValidatedFinding[];
  progress: SessionProgress;
}

export interface HintResponse { element_key: string | null; hint_level: number; hint: string | null; no_hint: boolean; message: string | null; }


export interface FamilySessionEvent {
  id: number;
  sequence: number;
  event_type: FamilySessionEventType;
  actor_ref: string | null;
  payload: Record<string, unknown>;
  is_ephemeral: boolean;
  created_at: string;
}

export interface FamilyCaregiverComment {
  comment_ref: string;
  author_ref: string;
  author_display_name: string;
  element_key: string | null;
  annotation_id: number | null;
  text: string;
  child_visible_label: string;
  created_at: string;
  updated_at: string;
}

export interface FamilyPresenceHeartbeatRequest {
  client_event_id: string;
  status?: "online" | "offline";
}

export interface FamilyCaregiverCommentCreateRequest {
  element_key?: string;
  annotation_id?: number;
  text: string;
  client_command_id: string;
}

export interface SharedCompanionFeedback {
  response_text: string;
  element_key: string | null;
  shared: boolean;
  support_resources: SupportResource[];
}
export interface CheckpointResponse {
  id: number;
  checkpoint_message_id: number;
  responder_role: ParticipantRole;
  response_text: string;
  flagged_message_ids: number[];
  tactic_tag_guess: string | null;
  created_at: string;
  visibility?: FindingVisibility;
}

export interface ConversationGuide {
  id: number;
  family_session_id: number;
  scenario_summary: string;
  child_reasoning_excerpt: Record<string, unknown>;
  discussion_prompts: string[];
  completed_together: boolean;
  generated_at: string;
}

export interface FamilyReviewConcern { element_key: string; annotation_ids: number[]; tactic_tag: string; text: string; explanation: string | null; identified: boolean; selected_for_revisit: boolean; shared_reasoning: string | null; }
export interface FamilyReviewAttempt { element_key: string; claim: "red_flag" | "not_red_flag" | "unsure"; disposition: "identified" | "revisit" | "safe_selection"; reasoning: string | null; shared: boolean; }
export interface FamilyReviewDiscussion { responder_role: string; text: string; element_key?: string | null; checkpoint_message_id?: number | null; }
export interface FamilyReview { session_ref: string; total_annotated_concerns: number; identified_concerns: number; unresolved_concerns: number; attempts: FamilyReviewAttempt[]; concerns: FamilyReviewConcern[]; non_concerning_selections: FamilyReviewAttempt[]; completed_checkpoints: FamilyReviewDiscussion[]; shared_discussion: FamilyReviewDiscussion[]; suggested_next_steps: string[]; practice_areas: string[]; }

export interface SupportResource {
  label: string;
  href: string;
}
export interface CompanionCheckpointResult {
  response_text: string;
  child_response: CheckpointResponse;
  checkpoint_response: CheckpointResponse;
  disclosure_triggered: boolean;
  support_resources: SupportResource[];
}
