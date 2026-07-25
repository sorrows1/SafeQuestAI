import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/store';
import type {
  ScenarioDefinition,
  PersonaDefinition,
  StageDefinition,
  ObjectiveDefinition,
  ConstraintDefinition,
  PromptTemplate,
  ValidationReport,
  ConfigSummary,
  PublishedFamilyScenario,
  PublishedFamilyScenarioPage,
  FamilyScenarioQuery,
  FamilySession,
  FamilyMessage,
  CheckpointResponse,
  ConversationGuide,
  ParticipantRole,
  CompanionCheckpointResult,
  SupportResource,
  SimulationRun,
  SimulationMode,
} from '@/types';

// ── Public/auth types ────────────────────────────────────────────────────────
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}
export interface UserOut {
  id: number;
  email: string;
  display_name: string;
  avatar_url: string | null;
  role: string;
  google_id: string | null;
}
export interface UserAdminOut {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  google_id: string | null;
}

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
  tagTypes: ['Scenario', 'Persona', 'Stage', 'Objective', 'Constraint', 'Prompt', 'User', 'Simulation', 'FamilySession'],

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
    getFamilyScenarios: build.query<PublishedFamilyScenarioPage, FamilyScenarioQuery>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters.search) params.set('search', filters.search);
        filters.category?.forEach((value) => params.append('category', value));
        filters.difficulty?.forEach((value) => params.append('difficulty', value));
        filters.render_skin?.forEach((value) => params.append('render_skin', value));
        if (filters.sort) params.set('sort', filters.sort);
        if (filters.page) params.set('page', String(filters.page));
        if (filters.limit) params.set('limit', String(filters.limit));
        return '/family/scenarios?' + params.toString();
      },
    }),
    getFamilyScenario: build.query<PublishedFamilyScenario, number>({
      query: (transcriptId) => '/family/scenarios/' + transcriptId,
    }),
    createFamilySession: build.mutation<FamilySession, { transcriptId: number; parent_user_id?: number; detective_mode: boolean }>({
      query: ({ transcriptId, ...body }) => ({ url: '/family/scenarios/' + transcriptId + '/sessions', method: 'POST', body }),
      invalidatesTags: ['FamilySession'],
    }),
    getFamilyMessages: build.query<FamilyMessage[], { sessionId: number; upTo: number }>({
      query: ({ sessionId, upTo }) => '/family/sessions/' + sessionId + '/messages?up_to=' + upTo,
    }),
    submitCheckpointResponse: build.mutation<
      CheckpointResponse,
      {
        sessionId: number;
        checkpoint_message_id: number;
        responder_role: ParticipantRole;
        response_text: string;
        flagged_message_ids: number[];
        tactic_tag_guess?: string | null;
      }
    >({
      query: ({ sessionId, ...body }) => ({ url: '/family/sessions/' + sessionId + '/checkpoint-responses', method: 'POST', body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: 'FamilySession', id: sessionId }],
    }),
    submitCompanionCheckpoint: build.mutation<
      CompanionCheckpointResult,
      {
        sessionId: number;
        checkpoint_message_id: number;
        child_response_text: string;
        flagged_message_ids: number[];
        tactic_tag_guess?: string | null;
      }
    >({
      query: ({ sessionId, ...body }) => ({ url: '/companion/sessions/' + sessionId + '/checkpoint', method: 'POST', body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: 'FamilySession', id: sessionId }],
    }),
    explainWithCompanion: build.mutation<
      { response_text: string; disclosure_triggered: boolean; support_resources: SupportResource[] },
      { sessionId: number; message: string }
    >({
      query: ({ sessionId, ...body }) => ({ url: '/companion/sessions/' + sessionId + '/explain', method: 'POST', body }),
    }),
    completeFamilySession: build.mutation<ConversationGuide, number>({
      query: (sessionId) => ({ url: '/family/sessions/' + sessionId + '/complete', method: 'POST' }),
      invalidatesTags: (_result, _error, sessionId) => [{ type: 'FamilySession', id: sessionId }],
    }),
    getConversationGuide: build.query<ConversationGuide, number>({
      query: (sessionId) => '/family/sessions/' + sessionId + '/conversation-guide',
      providesTags: (_result, _error, sessionId) => [{ type: 'FamilySession', id: sessionId }],
    }),

    // ── Admin Config Summary ────────────────────────────────────────────────
    getSummary: build.query<ConfigSummary, void>({
      query: () => '/admin/config/summary',
    }),

    // ── Durable admin simulations ───────────────────────────────────────────
    createSimulation: build.mutation<
      Pick<SimulationRun, 'id' | 'status' | 'mode'>,
      { scenario_id: string; mode: SimulationMode; is_negative_example?: boolean }
    >({ query: (body) => ({ url: '/admin/simulations', method: 'POST', body }), invalidatesTags: ['Simulation'] }),
    listSimulations: build.query<SimulationRun[], void>({ query: () => '/admin/simulations', providesTags: ['Simulation'] }),
    getSimulation: build.query<SimulationRun, { runId: number; debug?: boolean }>({
      query: ({ runId, debug = true }) => `/admin/simulations/${runId}?debug_detail=${debug}`,
      providesTags: (_result, _error, { runId }) => [{ type: 'Simulation', id: runId }],
    }),
    pauseSimulation: build.mutation<Pick<SimulationRun, 'id' | 'status'>, number>({
      query: (runId) => ({ url: `/admin/simulations/${runId}/pause`, method: 'POST' }),
    }),
    resumeSimulation: build.mutation<Pick<SimulationRun, 'id' | 'status'>, { runId: number; extend_limits?: boolean }>({
      query: ({ runId, extend_limits = false }) => ({ url: `/admin/simulations/${runId}/resume`, method: 'POST', body: { extend_limits } }),
    }),
    stopSimulation: build.mutation<Pick<SimulationRun, 'id' | 'status'>, number>({
      query: (runId) => ({ url: `/admin/simulations/${runId}/stop`, method: 'POST' }),
    }),
    respondToSimulation: build.mutation<Pick<SimulationRun, 'id' | 'status'>, { runId: number; content: string }>({
      query: ({ runId, content }) => ({ url: `/admin/simulations/${runId}/respond`, method: 'POST', body: { content } }),
    }),
    editSimulationMessage: build.mutation<SimulationRun, { runId: number; messageId: number; content: string; reason?: string }>({
      query: ({ runId, messageId, ...body }) => ({ url: `/admin/simulations/${runId}/messages/${messageId}`, method: 'PATCH', body }),
    }),
    regenerateSimulationLastTurn: build.mutation<Pick<SimulationRun, 'id' | 'status'>, number>({
      query: (runId) => ({ url: `/admin/simulations/${runId}/regenerate-last-turn`, method: 'POST' }),
    }),
    decideSimulation: build.mutation<
      { id: number; status: SimulationRun['status']; curated_transcript_id: number | null },
      { runId: number; status: 'approved' | 'rejected'; reviewer_notes?: string }
    >({ query: ({ runId, ...body }) => ({ url: `/admin/simulations/${runId}/decision`, method: 'POST', body }), invalidatesTags: ['Simulation'] }),
    getSimulationReviewQueue: build.query<SimulationRun[], void>({ query: () => '/admin/review-queue', providesTags: ['Simulation'] }),
    publishCuratedTranscript: build.mutation<{ id: number; is_published: boolean }, number>({
      query: (id) => ({ url: `/admin/curated-transcripts/${id}/publish`, method: 'POST' }),
    }),

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
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Scenario', id },
        { type: 'Scenario', id: 'LIST' },
      ],
    }),
    deleteScenario: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/scenarios/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Scenario', id },
        { type: 'Scenario', id: 'LIST' },
      ],
    }),
    duplicateScenario: build.mutation<ScenarioDefinition, string>({
      query: (id) => ({ url: `/admin/scenarios/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),

    // ── Admin Personas ──────────────────────────────────────────────────────
    listPersonas: build.query<PersonaDefinition[], void>({
      query: () => '/admin/personas/',
      providesTags: (result) =>
        result ? [...result.map(({ id }) => ({ type: 'Persona' as const, id })), { type: 'Persona', id: 'LIST' }] : [{ type: 'Persona', id: 'LIST' }],
    }),
    createPersona: build.mutation<PersonaDefinition, PersonaDefinition>({
      query: (body) => ({ url: '/admin/personas/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Persona', id: 'LIST' }],
    }),
    updatePersona: build.mutation<PersonaDefinition, { id: string; body: PersonaDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/personas/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Persona', id },
        { type: 'Persona', id: 'LIST' },
      ],
    }),
    deletePersona: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/personas/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Persona', id },
        { type: 'Persona', id: 'LIST' },
      ],
    }),

    // ── Admin Stages ────────────────────────────────────────────────────────
    listStages: build.query<StageDefinition[], void>({
      query: () => '/admin/stages/',
      providesTags: (result) =>
        result ? [...result.map(({ id }) => ({ type: 'Stage' as const, id })), { type: 'Stage', id: 'LIST' }] : [{ type: 'Stage', id: 'LIST' }],
    }),
    createStage: build.mutation<StageDefinition, StageDefinition>({
      query: (body) => ({ url: '/admin/stages/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Stage', id: 'LIST' }],
    }),
    updateStage: build.mutation<StageDefinition, { id: string; body: StageDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/stages/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Stage', id },
        { type: 'Stage', id: 'LIST' },
      ],
    }),
    deleteStage: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/stages/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Stage', id },
        { type: 'Stage', id: 'LIST' },
      ],
    }),

    // ── Admin Objectives ────────────────────────────────────────────────────
    listObjectives: build.query<ObjectiveDefinition[], void>({
      query: () => '/admin/objectives/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Objective' as const, id })), { type: 'Objective', id: 'LIST' }]
          : [{ type: 'Objective', id: 'LIST' }],
    }),
    createObjective: build.mutation<ObjectiveDefinition, ObjectiveDefinition>({
      query: (body) => ({ url: '/admin/objectives/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Objective', id: 'LIST' }],
    }),
    updateObjective: build.mutation<ObjectiveDefinition, { id: string; body: ObjectiveDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/objectives/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Objective', id },
        { type: 'Objective', id: 'LIST' },
      ],
    }),
    deleteObjective: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/objectives/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Objective', id },
        { type: 'Objective', id: 'LIST' },
      ],
    }),

    // ── Admin Constraints ───────────────────────────────────────────────────
    listConstraints: build.query<ConstraintDefinition[], void>({
      query: () => '/admin/constraints/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Constraint' as const, id })), { type: 'Constraint', id: 'LIST' }]
          : [{ type: 'Constraint', id: 'LIST' }],
    }),
    createConstraint: build.mutation<ConstraintDefinition, ConstraintDefinition>({
      query: (body) => ({ url: '/admin/constraints/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Constraint', id: 'LIST' }],
    }),
    updateConstraint: build.mutation<ConstraintDefinition, { id: string; body: ConstraintDefinition }>({
      query: ({ id, body }) => ({ url: `/admin/constraints/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [
        { type: 'Constraint', id },
        { type: 'Constraint', id: 'LIST' },
      ],
    }),
    deleteConstraint: build.mutation<void, string>({
      query: (id) => ({ url: `/admin/constraints/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [
        { type: 'Constraint', id },
        { type: 'Constraint', id: 'LIST' },
      ],
    }),

    // ── Admin Prompts ───────────────────────────────────────────────────────
    listPrompts: build.query<PromptTemplate[], void>({
      query: () => '/admin/prompts/',
      providesTags: (result) =>
        result
          ? [...result.map(({ name }) => ({ type: 'Prompt' as const, id: name })), { type: 'Prompt', id: 'LIST' }]
          : [{ type: 'Prompt', id: 'LIST' }],
    }),
    createPrompt: build.mutation<PromptTemplate, PromptTemplate>({
      query: (body) => ({ url: '/admin/prompts/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Prompt', id: 'LIST' }],
    }),
    updatePrompt: build.mutation<PromptTemplate, { name: string; body: PromptTemplate }>({
      query: ({ name, body }) => ({ url: `/admin/prompts/${name}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { name }) => [
        { type: 'Prompt', id: name },
        { type: 'Prompt', id: 'LIST' },
      ],
    }),
    deletePrompt: build.mutation<void, string>({
      query: (name) => ({ url: `/admin/prompts/${name}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, name) => [
        { type: 'Prompt', id: name },
        { type: 'Prompt', id: 'LIST' },
      ],
    }),
    previewPrompt: build.mutation<{ rendered: string }, { name: string; vars: Record<string, string> }>({
      query: ({ name, vars }) => ({ url: `/admin/prompts/${name}/preview`, method: 'POST', body: vars }),
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
  useRegisterMutation,
  useLoginMutation,
  useGetMeQuery,
  useGetFamilyScenariosQuery,
  useGetFamilyScenarioQuery,
  useCreateFamilySessionMutation,
  useGetFamilyMessagesQuery,
  useSubmitCheckpointResponseMutation,
  useSubmitCompanionCheckpointMutation,
  useExplainWithCompanionMutation,
  useCompleteFamilySessionMutation,
  useGetConversationGuideQuery,
  useGetSummaryQuery,
  useCreateSimulationMutation,
  useListSimulationsQuery,
  useGetSimulationQuery,
  usePauseSimulationMutation,
  useResumeSimulationMutation,
  useStopSimulationMutation,
  useRespondToSimulationMutation,
  useEditSimulationMessageMutation,
  useRegenerateSimulationLastTurnMutation,
  useDecideSimulationMutation,
  useGetSimulationReviewQueueQuery,
  usePublishCuratedTranscriptMutation,
  useListScenariosQuery,
  useGetScenarioQuery,
  useCreateScenarioMutation,
  useUpdateScenarioMutation,
  useDeleteScenarioMutation,
  useDuplicateScenarioMutation,
  useListPersonasQuery,
  useCreatePersonaMutation,
  useUpdatePersonaMutation,
  useDeletePersonaMutation,
  useListStagesQuery,
  useCreateStageMutation,
  useUpdateStageMutation,
  useDeleteStageMutation,
  useListObjectivesQuery,
  useCreateObjectiveMutation,
  useUpdateObjectiveMutation,
  useDeleteObjectiveMutation,
  useListConstraintsQuery,
  useCreateConstraintMutation,
  useUpdateConstraintMutation,
  useDeleteConstraintMutation,
  useListPromptsQuery,
  useCreatePromptMutation,
  useUpdatePromptMutation,
  useDeletePromptMutation,
  usePreviewPromptMutation,
  useLazyValidateAllQuery,
  useLazyValidateScenarioQuery,
  useListUsersQuery,
  usePatchUserMutation,
} = safeQuestApi;
