import axios from 'axios';
import type {
  ScenarioDefinition, PersonaDefinition, StageDefinition,
  ObjectiveDefinition, ConstraintDefinition, PromptTemplate,
  SimulatorStartRequest, SimulatorStartResponse,
  SimulatorChatRequest, SimulatorChatResponse,
  ValidationReport, ConfigSummary,
} from '@/types';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// ── Scenarios ──────────────────────────────────────────────────────────────
export const scenariosApi = {
  list:      ()                                => api.get<ScenarioDefinition[]>('/scenarios/'),
  get:       (id: string)                      => api.get<ScenarioDefinition>(`/scenarios/${id}`),
  create:    (s: ScenarioDefinition)           => api.post<ScenarioDefinition>('/scenarios/', s),
  update:    (id: string, s: ScenarioDefinition) => api.put<ScenarioDefinition>(`/scenarios/${id}`, s),
  delete:    (id: string)                      => api.delete(`/scenarios/${id}`),
  duplicate: (id: string)                      => api.post<ScenarioDefinition>(`/scenarios/${id}/duplicate`),
  reload:    ()                                => api.post('/scenarios/reload'),
};

// ── Personas ───────────────────────────────────────────────────────────────
export const personasApi = {
  list:   ()                                 => api.get<PersonaDefinition[]>('/personas/'),
  get:    (id: string)                       => api.get<PersonaDefinition>(`/personas/${id}`),
  create: (p: PersonaDefinition)             => api.post<PersonaDefinition>('/personas/', p),
  update: (id: string, p: PersonaDefinition) => api.put<PersonaDefinition>(`/personas/${id}`, p),
  delete: (id: string)                       => api.delete(`/personas/${id}`),
};

// ── Stages ─────────────────────────────────────────────────────────────────
export const stagesApi = {
  list:   ()                               => api.get<StageDefinition[]>('/stages/'),
  get:    (id: string)                     => api.get<StageDefinition>(`/stages/${id}`),
  create: (s: StageDefinition)             => api.post<StageDefinition>('/stages/', s),
  update: (id: string, s: StageDefinition) => api.put<StageDefinition>(`/stages/${id}`, s),
  delete: (id: string)                     => api.delete(`/stages/${id}`),
};

// ── Objectives ─────────────────────────────────────────────────────────────
export const objectivesApi = {
  list:   ()                                    => api.get<ObjectiveDefinition[]>('/objectives/'),
  get:    (id: string)                          => api.get<ObjectiveDefinition>(`/objectives/${id}`),
  create: (o: ObjectiveDefinition)              => api.post<ObjectiveDefinition>('/objectives/', o),
  update: (id: string, o: ObjectiveDefinition)  => api.put<ObjectiveDefinition>(`/objectives/${id}`, o),
  delete: (id: string)                          => api.delete(`/objectives/${id}`),
};

// ── Constraints ────────────────────────────────────────────────────────────
export const constraintsApi = {
  list:   ()                                      => api.get<ConstraintDefinition[]>('/constraints/'),
  get:    (id: string)                            => api.get<ConstraintDefinition>(`/constraints/${id}`),
  create: (c: ConstraintDefinition)               => api.post<ConstraintDefinition>('/constraints/', c),
  update: (id: string, c: ConstraintDefinition)   => api.put<ConstraintDefinition>(`/constraints/${id}`, c),
  delete: (id: string)                            => api.delete(`/constraints/${id}`),
};

// ── Prompt Templates ───────────────────────────────────────────────────────
export const promptsApi = {
  list:    ()                                  => api.get<PromptTemplate[]>('/prompts/'),
  get:     (name: string)                      => api.get<PromptTemplate>(`/prompts/${name}`),
  create:  (t: PromptTemplate)                 => api.post<PromptTemplate>('/prompts/', t),
  update:  (name: string, t: PromptTemplate)   => api.put<PromptTemplate>(`/prompts/${name}`, t),
  delete:  (name: string)                      => api.delete(`/prompts/${name}`),
  preview: (name: string, vars: Record<string, string>) =>
    api.post<{ rendered: string }>(`/prompts/${name}/preview`, vars),
};

// ── Simulator ──────────────────────────────────────────────────────────────
export const simulatorApi = {
  start:      (req: SimulatorStartRequest)   => api.post<SimulatorStartResponse>('/simulator/start', req),
  chat:       (req: SimulatorChatRequest, debug = false) =>
    api.post<SimulatorChatResponse>(`/simulator/chat?debug=${debug}`, req),
  getSession: (sessionId: number)            => api.get('/simulator/session/' + sessionId),
  getHistory: (sessionId: number)            => api.get('/simulator/session/' + sessionId + '/history'),
};

// ── Validation ────────────────────────────────────────────────────────────
export const validationApi = {
  validateAll:      ()            => api.get<ValidationReport>('/validation/'),
  validateScenario: (id: string)  => api.get<ValidationReport>(`/validation/scenario/${id}`),
};

// ── Health ─────────────────────────────────────────────────────────────────
export const healthApi = {
  check:   () => api.get('/health'),
  summary: () => api.get<ConfigSummary>('/config/summary'),
};

export default api;
