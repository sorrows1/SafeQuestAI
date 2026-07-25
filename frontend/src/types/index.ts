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
  escalation_speed: string;
  red_flag_visibility: string;
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
  difficulty_modifiers: Record<string, DifficultyModifier>;
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
export type SimulationStatus = 'running' | 'paused' | 'awaiting_admin' | 'ready_for_review' | 'approved' | 'rejected' | 'failed' | 'limit_reached';
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
  usage: Record<string, unknown>;
  progress: Record<string, unknown>;
  worker_status?: Record<string, unknown>;
  diagnostics?: { objectives: string[]; progression: Record<string, unknown>; flags: string[] };
  personas?: Record<string, unknown>;
  prompts?: Record<string, unknown>;
  messages?: SimulationMessage[];
  revisions?: SimulationRevision[];
}

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
}

// ── Family scenario player ────────────────────────────────────────────────

export type RenderSkin = 'chat' | 'email' | 'social_feed';
export type ParticipantRole = 'child' | 'parent' | 'ai_companion';

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
  transcript_id: number;
  parent_user_id: number | null;
  companion_mode: boolean;
  detective_mode: boolean;
  started_at: string;
  completed_at: string | null;
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

export interface CheckpointResponse {
  id: number;
  checkpoint_message_id: number;
  responder_role: ParticipantRole;
  response_text: string;
  flagged_message_ids: number[];
  tactic_tag_guess: string | null;
  created_at: string;
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
