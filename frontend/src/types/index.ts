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
  description: string;       // admin display only
  hidden_intent: string;     // what the LLM sees — background desire, not task
  natural_triggers: string[];
  priority: number;
  patience: number;
  success_signals: string[];
}

// ── Persona ────────────────────────────────────────────────────────────────

export interface ConversationStyle {
  uses_lowercase: boolean;
  omits_end_punctuation: boolean;
  emoji_frequency: number;              // 0.0–1.0
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
  description: string;           // admin display only
  cover_story: string;
  claimed_age: number;
  claimed_location: string;
  claimed_interests: string[];
  manipulation_style: string;
  escalation_speed: EscalationSpeed;
  conversation_style: ConversationStyle;
  // Legacy — kept for admin UI display
  background: string;
  tone: string[];
  interests: string[];
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
  persona: string;
  starting_stage: string;
  prompt_template: string;
  version: string;
  created_at?: string;
  tags: string[];
  learning_objectives: string[];
  stage_sequence: StageStep[];
  difficulty_modifiers: Record<string, DifficultyModifier>;
}

export interface PromptTemplate {
  name: string;
  content: string;
  variables: string[];
  description: string;
}

// ── Simulator / Runtime types ──────────────────────────────────────────────

export interface SimulatorStartRequest {
  scenario_id: string;
  difficulty: string;
}

export interface SimulatorStartResponse {
  session_id: number;
  scenario_id: string;
  initial_message: string;
  state: ConversationStateSnapshot;
}

export interface SimulatorChatRequest {
  session_id: number;
  message: string;
}

export interface SimulatorChatResponse {
  reply: string;
  current_stage: string;
  next_stage: string;
  current_objective: string;
  objective_completed: boolean;
  trust: number;
  suspicion: number;
  flags: string[];
  reasoning: string;
  confidence: number;
  built_prompt?: string;
}

export interface ConversationStateSnapshot {
  session_id: number;
  scenario_id: string;
  difficulty: string;
  current_stage: string;
  current_objective: string;
  completed_objectives: string[];
  trust: number;
  suspicion: number;
  flags: string[];
  history: HistoryEntry[];
  // New inertia tracking fields
  current_topic: string;
  turns_on_topic: number;
  turns_in_stage: number;
}

export interface HistoryEntry {
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
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

