import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/store';
import type {
  ScenarioDefinition, PersonaDefinition, StageDefinition,
  ObjectiveDefinition, ConstraintDefinition, PromptTemplate,
  SimulatorStartRequest, SimulatorStartResponse,
  SimulatorChatRequest, SimulatorChatResponse,
  ValidationReport, ConfigSummary,
  PublishedFamilyScenario, FamilySession, FamilyMessage, CheckpointResponse,
  ConversationGuide, ParticipantRole, CompanionCheckpointResult, SupportResource,
} from '@/types';

// ── Public/auth types ────────────────────────────────────────────────────────
export interface AuthTokens { access_token: string; refresh_token: string; token_type: string; }
export interface UserOut { id: number; email: string; display_name: string; avatar_url: string | null; role: string; google_id: string | null; }
export interface UserAdminOut { id: number; email: string; display_name: string; role: string; is_active: boolean; google_id: string | null; }

export const safeQuestApi = createApi({
  reducerPath: 'safeQuestApi',
  baseQuery: fetchBaseQuery({
    baseUrl: '/api',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.accessToken;
      if (token) headers.set('Authorization', `Bearer ${token}`);
      return headers;
    },
  }),
  tagTypes: ['Scenario', 'Persona', 'Stage', 'Objective', 'Constraint', 'Prompt', 'User', 'GenerationReview', 'FamilySession'],

  endpoints: (build) => ({

    // ── Auth ────────────────────────────────────────────────────────────────
    register: build.mutation<AuthTokens, { email: string; password: string; display_name: string }>({
      query: (body) => ({ url: '/auth/register', method: 'POST', body }),
    }),
    login: build.mutation<AuthTokens, { email: string; password: string }>({
      query: (body) => ({ url: '/auth/login', method: 'POST', body }),
    }),
    getMe: build.query<UserOut, void>({
      query: () => '/auth/me',
    }),

    // ── Family scenario player (curated content only; no generator access) ──
    getFamilyScenarios: build.query<PublishedFamilyScenario[], void>({
      query: () => "/family/scenarios",
    }),
    createFamilySession: build.mutation<FamilySession, { transcriptId: number; parent_user_id?: number; detective_mode: boolean }>({
      query: ({ transcriptId, ...body }) => ({ url: "/family/scenarios/" + transcriptId + "/sessions", method: "POST", body }),
      invalidatesTags: ["FamilySession"],
    }),
    getFamilyMessages: build.query<FamilyMessage[], { sessionId: number; upTo: number }>({
      query: ({ sessionId, upTo }) => "/family/sessions/" + sessionId + "/messages?up_to=" + upTo,
    }),
    submitCheckpointResponse: build.mutation<CheckpointResponse, {
      sessionId: number; checkpoint_message_id: number; responder_role: ParticipantRole;
      response_text: string; flagged_message_ids: number[]; tactic_tag_guess?: string | null;
    }>({
      query: ({ sessionId, ...body }) => ({ url: "/family/sessions/" + sessionId + "/checkpoint-responses", method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    submitCompanionCheckpoint: build.mutation<CompanionCheckpointResult, {
      sessionId: number; checkpoint_message_id: number; child_response_text: string;
      flagged_message_ids: number[]; tactic_tag_guess?: string | null;
    }>({
      query: ({ sessionId, ...body }) => ({ url: "/companion/sessions/" + sessionId + "/checkpoint", method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    explainWithCompanion: build.mutation<{ response_text: string; disclosure_triggered: boolean; support_resources: SupportResource[] }, { sessionId: number; message: string }>({
      query: ({ sessionId, ...body }) => ({ url: "/companion/sessions/" + sessionId + "/explain", method: "POST", body }),
    }),
    completeFamilySession: build.mutation<ConversationGuide, number>({
      query: (sessionId) => ({ url: "/family/sessions/" + sessionId + "/complete", method: "POST" }),
      invalidatesTags: (_result, _error, sessionId) => [{ type: "FamilySession", id: sessionId }],
    }),
    getConversationGuide: build.query<ConversationGuide, number>({
      query: (sessionId) => "/family/sessions/" + sessionId + "/conversation-guide",
      providesTags: (_result, _error, sessionId) => [{ type: "FamilySession", id: sessionId }],
    }),

    // ── Admin Config Summary ────────────────────────────────────────────────
    getSummary: build.query<ConfigSummary, void>({
      query: () => '/admin/config/summary',
    }),

    // ── Admin generation / review ─────────────────────────────────────────
    startGenerationRun: build.mutation<GenerationRunOut, GenerationRunConfig>({ query: (body) => ({ url: '/admin/generation/runs', method: 'POST', body }) }),
    pauseGenerationRun: build.mutation<GenerationRunOut, number>({ query: (runId) => ({ url: '/admin/generation/runs/' + runId + '/pause', method: 'POST' }) }),
    resumeGenerationRun: build.mutation<GenerationRunOut, number>({ query: (runId) => ({ url: '/admin/generation/runs/' + runId + '/resume', method: 'POST' }) }),
    regenerateGenerationRun: build.mutation<GenerationRunOut, number>({ query: (runId) => ({ url: '/admin/generation/runs/' + runId + '/regenerate-last-turn', method: 'POST' }) }),
    getGenerationReviewQueue: build.query<GenerationReviewItem[], void>({ query: () => '/admin/generation/review-queue', providesTags: ['GenerationReview'] }),
    getGenerationReviewItem: build.query<GenerationReviewDetail, number>({ query: (runId) => `/admin/generation/review-queue/${runId}`, providesTags: (_r, _e, runId) => [{ type: "GenerationReview", id: runId }] }),
    decideGenerationRun: build.mutation<GenerationRunOut, { runId: number; decision: ReviewDecision }>({ query: ({ runId, decision }) => ({ url: '/admin/generation/runs/' + runId + '/decision', method: 'POST', body: decision }), invalidatesTags: ['GenerationReview'] }),

    // ── Admin Scenarios ─────────────────────────────────────────────────────
    listScenarios: build.query<ScenarioDefinition[], void>({
      query: () => '/admin/scenarios/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Scenario' as const, id })), { type: 'Scenario', id: 'LIST' }]
          : [{ type: 'Scenario', id: 'LIST' }],
    }),
    getScenario: build.query<ScenarioDefinition, string>({
      query: (id) => `/admin/scenarios/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Scenario', id }],
    }),
    createScenario: build.mutation<ScenarioDefinition, ScenarioDefinition>({
      query: (body) => ({ url: '/admin/scenarios/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),
    updateScenario: build.mutation<ScenarioDefinition, { id: string; body: ScenarioDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/scenarios/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Scenario', id }, { type: 'Scenario', id: 'LIST' }],
    }),
    deleteScenario: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/scenarios/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Scenario', id }, { type: 'Scenario', id: 'LIST' }],
    }),
    duplicateScenario: build.mutation<ScenarioDefinition, string>({
      query: (id) => ({ url: `/admin/scenarios/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),

    // ── Admin Personas ──────────────────────────────────────────────────────
    listPersonas: build.query<PersonaDefinition[], void>({
      query: () => '/admin/personas/',
      providesTags: (result) =>
        result ? [...result.map(({ id }) => ({ type: 'Persona' as const, id })), { type: 'Persona', id: 'LIST' }]
               : [{ type: 'Persona', id: 'LIST' }],
    }),
    createPersona: build.mutation<PersonaDefinition, PersonaDefinition>({
      query: (body) => ({ url: '/admin/personas/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Persona', id: 'LIST' }],
    }),
    updatePersona: build.mutation<PersonaDefinition, { id: string; body: PersonaDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/personas/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Persona', id }, { type: 'Persona', id: 'LIST' }],
    }),
    deletePersona: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/personas/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Persona', id }, { type: 'Persona', id: 'LIST' }],
    }),

    // ── Admin Stages ────────────────────────────────────────────────────────
    listStages: build.query<StageDefinition[], void>({
      query: () => '/admin/stages/',
      providesTags: (result) =>
        result ? [...result.map(({ id }) => ({ type: 'Stage' as const, id })), { type: 'Stage', id: 'LIST' }]
               : [{ type: 'Stage', id: 'LIST' }],
    }),
    createStage: build.mutation<StageDefinition, StageDefinition>({
      query: (body) => ({ url: '/admin/stages/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Stage', id: 'LIST' }],
    }),
    updateStage: build.mutation<StageDefinition, { id: string; body: StageDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/stages/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Stage', id }, { type: 'Stage', id: 'LIST' }],
    }),
    deleteStage: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/stages/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Stage', id }, { type: 'Stage', id: 'LIST' }],
    }),

    // ── Admin Objectives ────────────────────────────────────────────────────
    listObjectives: build.query<ObjectiveDefinition[], void>({
      query: () => '/admin/objectives/',
      providesTags: (result) =>
        result ? [...result.map(({ id }) => ({ type: 'Objective' as const, id })), { type: 'Objective', id: 'LIST' }]
               : [{ type: 'Objective', id: 'LIST' }],
    }),
    createObjective: build.mutation<ObjectiveDefinition, ObjectiveDefinition>({
      query: (body) => ({ url: '/admin/objectives/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Objective', id: 'LIST' }],
    }),
    updateObjective: build.mutation<ObjectiveDefinition, { id: string; body: ObjectiveDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/objectives/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Objective', id }, { type: 'Objective', id: 'LIST' }],
    }),
    deleteObjective: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/objectives/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Objective', id }, { type: 'Objective', id: 'LIST' }],
    }),

    // ── Admin Constraints ───────────────────────────────────────────────────
    listConstraints: build.query<ConstraintDefinition[], void>({
      query: () => '/admin/constraints/',
      providesTags: (result) =>
        result ? [...result.map(({ id }) => ({ type: 'Constraint' as const, id })), { type: 'Constraint', id: 'LIST' }]
               : [{ type: 'Constraint', id: 'LIST' }],
    }),
    createConstraint: build.mutation<ConstraintDefinition, ConstraintDefinition>({
      query: (body) => ({ url: '/admin/constraints/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Constraint', id: 'LIST' }],
    }),
    updateConstraint: build.mutation<ConstraintDefinition, { id: string; body: ConstraintDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/constraints/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Constraint', id }, { type: 'Constraint', id: 'LIST' }],
    }),
    deleteConstraint: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/constraints/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Constraint', id }, { type: 'Constraint', id: 'LIST' }],
    }),

    // ── Admin Prompts ───────────────────────────────────────────────────────
    listPrompts: build.query<PromptTemplate[], void>({
      query: () => '/admin/prompts/',
      providesTags: (result) =>
        result ? [...result.map(({ name }) => ({ type: 'Prompt' as const, id: name })), { type: 'Prompt', id: 'LIST' }]
               : [{ type: 'Prompt', id: 'LIST' }],
    }),
    createPrompt: build.mutation<PromptTemplate, PromptTemplate>({
      query: (body) => ({ url: '/admin/prompts/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Prompt', id: 'LIST' }],
    }),
    updatePrompt: build.mutation<PromptTemplate, { name: string; body: PromptTemplate }>({
      query: ({ name, body }) => ({ url: `/admin/prompts/${name}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { name }) => [{ type: 'Prompt', id: name }, { type: 'Prompt', id: 'LIST' }],
    }),
    deletePrompt: build.mutation<void, string>({
      query: (name) => ({ url: `/admin/prompts/${name}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, name) => [{ type: 'Prompt', id: name }, { type: 'Prompt', id: 'LIST' }],
    }),
    previewPrompt: build.mutation<{ rendered: string }, { name: string; vars: Record<string, string> }>({
      query: ({ name, vars }) => ({ url: `/admin/prompts/${name}/preview`, method: 'POST', body: vars }),
    }),

    // ── Admin Simulator ─────────────────────────────────────────────────────
    startSession: build.mutation<SimulatorStartResponse, SimulatorStartRequest>({
      query: (body) => ({ url: '/admin/simulator/start', method: 'POST', body }),
    }),
    chatMessage: build.mutation<SimulatorChatResponse, { req: SimulatorChatRequest; debug?: boolean }>({
      query: ({ req, debug = false }) => ({ url: `/admin/simulator/chat?debug=${debug}`, method: 'POST', body: req }),
    }),

    // ── Admin Validation ────────────────────────────────────────────────────
    validateAll: build.query<ValidationReport, void>({
      query: () => '/admin/validation/',
    }),
    validateScenario: build.query<ValidationReport, string>({
      query: (id) => `/admin/validation/scenario/${id}`,
    }),

    // ── Admin Users ─────────────────────────────────────────────────────────
    listUsers: build.query<UserAdminOut[], void>({
      query: () => '/admin/users/',
      providesTags: ['User'],
    }),
    patchUser: build.mutation<UserAdminOut, { id: number; role?: string; is_active?: boolean }>({
      query: ({ id, ...body }) => ({ url: `/admin/users/${id}`, method: 'PATCH', body }),
      invalidatesTags: ['User'],
    }),
  }),
});

export const {
  useRegisterMutation, useLoginMutation, useGetMeQuery,
  useGetFamilyScenariosQuery, useCreateFamilySessionMutation, useGetFamilyMessagesQuery,
  useSubmitCheckpointResponseMutation, useSubmitCompanionCheckpointMutation, useExplainWithCompanionMutation, useCompleteFamilySessionMutation, useGetConversationGuideQuery,
  useGetSummaryQuery,
  useStartGenerationRunMutation, usePauseGenerationRunMutation, useResumeGenerationRunMutation,
  useRegenerateGenerationRunMutation, useGetGenerationReviewQueueQuery,
  useGetGenerationReviewItemQuery, useDecideGenerationRunMutation,
  useListScenariosQuery, useGetScenarioQuery,
  useCreateScenarioMutation, useUpdateScenarioMutation, useDeleteScenarioMutation, useDuplicateScenarioMutation,
  useListPersonasQuery, useCreatePersonaMutation, useUpdatePersonaMutation, useDeletePersonaMutation,
  useListStagesQuery, useCreateStageMutation, useUpdateStageMutation, useDeleteStageMutation,
  useListObjectivesQuery, useCreateObjectiveMutation, useUpdateObjectiveMutation, useDeleteObjectiveMutation,
  useListConstraintsQuery, useCreateConstraintMutation, useUpdateConstraintMutation, useDeleteConstraintMutation,
  useListPromptsQuery, useCreatePromptMutation, useUpdatePromptMutation, useDeletePromptMutation, usePreviewPromptMutation,
  useStartSessionMutation, useChatMessageMutation,
  useLazyValidateAllQuery, useLazyValidateScenarioQuery,
  useListUsersQuery, usePatchUserMutation,
} = safeQuestApi;

export interface GenerationRunConfig { scenario_id: string; difficulty?: string; is_positive_example?: boolean; max_rounds?: number; }
export interface GenerationRunOut { run_id: number; status: string; }
export interface GenerationTranscriptMessage { id: number; sender: string; content: string; metadata: Record<string, unknown>; }
export interface GenerationReviewItem { id: number; scenario_id: string; difficulty: string; status: string; category: string | null; is_positive_example: boolean; created_at: string; }
export interface GenerationReviewDetail extends GenerationReviewItem { transcript: GenerationTranscriptMessage[]; auto_scores: { tactic_tags: string[]; coverage: number; is_negative_example: boolean }; }
export interface ReviewDecision { status: "approved" | "rejected"; reviewer_notes?: string; }
