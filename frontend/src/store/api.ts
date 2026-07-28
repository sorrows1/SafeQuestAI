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
  FamilySessionDetail,
  FamilySessionCommandRequest,
  FamilyRelationshipInvitation,
  FamilyRelationship,
  FamilyAuthorizedSession,
  FamilyRole,
  FamilyMessage,
  CheckpointResponse,
  ConversationGuide,
  FamilyReview,
  ParticipantRole,
  CompanionCheckpointResult,
  SupportResource,
  FlagAttempt,
  FlagAttemptRequest,
  HintResponse,
  FamilySessionParticipant,
  FamilyPresenceHeartbeatRequest,
  FamilyCaregiverComment,
  FamilyCaregiverCommentCreateRequest,
  SharedCompanionFeedback,
  SimulationRun,
  SimulationMode,
  SimulationHistoryPage,
  SimulationEventHistoryPage,
  AdminSceneDraft,
  AdminReviewQueueItem,
  SkinCapabilityManifest,
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
  age_band?: string | null;
  age_adaptation_consent_at?: string | null;
}
export interface UserAdminOut {
  id: number;
  email: string;
  display_name: string;
  role: string;
  is_active: boolean;
  google_id: string | null;
  age_band?: string | null;
  age_adaptation_consent_at?: string | null;
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
  tagTypes: ['Scenario', 'Persona', 'Stage', 'Objective', 'Constraint', 'Prompt', 'User', 'Simulation', 'FamilySession', 'FamilyLink', 'FamilyCatalog'],

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
      providesTags: ['FamilyCatalog'],
    }),
    getFamilyScenario: build.query<PublishedFamilyScenario, number>({
      query: (transcriptId) => '/family/scenarios/' + transcriptId,
      providesTags: (_result, _error, transcriptId) => [{ type: 'FamilyCatalog', id: transcriptId }],
    }),
    createFamilySession: build.mutation<FamilySession, { transcriptId: number; relationship_ref?: string }>({
      query: ({ transcriptId, ...body }) => ({ url: '/family/scenarios/' + transcriptId + '/sessions', method: 'POST', body }),
      invalidatesTags: ['FamilySession', 'FamilyLink', 'FamilyCatalog'],
    }),
    restartFamilySession: build.mutation<FamilySession, { transcriptId: number; prior_session_ref: string }>({
      query: ({ transcriptId, ...body }) => ({ url: '/family/scenarios/' + transcriptId + '/sessions/restart', method: 'POST', body }),
      invalidatesTags: ['FamilySession', 'FamilyCatalog'],
    }),
    createFamilyInvitation: build.mutation<FamilyRelationshipInvitation, { learner_email: string; family_role: FamilyRole; delivery_label?: string }>({ query: (body) => ({ url: '/family/invitations', method: 'POST', body }), invalidatesTags: ['FamilyLink'] }),
    getFamilyInvitations: build.query<FamilyRelationshipInvitation[], void>({ query: () => '/family/invitations', providesTags: ['FamilyLink'], keepUnusedDataFor: 30 }),
    previewFamilyInvitation: build.query<{ invitation_ref: string; inviter_display_name: string; intended_role: 'learner'; expires_at: string; sharing_summary: string }, string>({ query: (secret) => '/family/invitations/preview?secret=' + encodeURIComponent(secret) }),
    acceptFamilyInvitation: build.mutation<FamilyRelationship, { secret: string }>({ query: (body) => ({ url: '/family/invitations/accept', method: 'POST', body }), invalidatesTags: ['FamilyLink'] }),
    declineFamilyInvitation: build.mutation<void, { secret: string }>({ query: (body) => ({ url: '/family/invitations/decline', method: 'POST', body }), invalidatesTags: ['FamilyLink'] }),
    revokeFamilyInvitation: build.mutation<void, string>({ query: (ref) => ({ url: '/family/invitations/' + ref + '/revoke', method: 'POST' }), invalidatesTags: ['FamilyLink'] }),
    acceptFamilyInvitationAsRecipient: build.mutation<FamilyRelationship, { invitation_ref: string }>({
      query: ({ invitation_ref }) => ({ url: '/family/invitations/' + invitation_ref + '/accept-as-recipient', method: 'POST' }), invalidatesTags: ['FamilyLink'],
    }),
    declineFamilyInvitationAsRecipient: build.mutation<void, { invitation_ref: string }>({
      query: ({ invitation_ref }) => ({ url: '/family/invitations/' + invitation_ref + '/decline-as-recipient', method: 'POST' }), invalidatesTags: ['FamilyLink'],
    }),
    getFamilyRelationships: build.query<FamilyRelationship[], void>({ query: () => '/family/relationships', providesTags: ['FamilyLink'] }),
    updateFamilyRelationship: build.mutation<FamilyRelationship, { relationship_ref: string; action: 'unlink' | 'block' }>({ query: ({ relationship_ref, ...body }) => ({ url: '/family/relationships/' + relationship_ref, method: 'PATCH', body }), invalidatesTags: ['FamilyLink', 'FamilySession'] }),
    getAuthorizedFamilySessions: build.query<FamilyAuthorizedSession[], void>({ query: () => '/family/sessions', providesTags: ['FamilySession'] }),
    getFamilySession: build.query<FamilySessionDetail, number | string>({
      query: (sessionId) => "/family/sessions/" + sessionId,
      providesTags: (_result, _error, sessionId) => [{ type: "FamilySession", id: sessionId }],
    }),
    joinFamilySession: build.mutation<FamilySessionDetail, { session_code: string }>({
      query: (body) => ({ url: '/family/sessions/join', method: 'POST', body }),
      invalidatesTags: ['FamilySession'],
    }),
    generateJoinCode: build.mutation<{ join_code_short: string }, number | string>({
      query: (sessionId) => ({ url: '/family/sessions/' + sessionId + '/generate-join-code', method: 'POST' }),
      invalidatesTags: (_result, _error, sessionId) => [{ type: "FamilySession", id: sessionId }],
    }),
    commandFamilySession: build.mutation<FamilySessionDetail, { sessionId: number | string } & FamilySessionCommandRequest>({
      query: ({ sessionId, ...body }) => ({ url: "/family/sessions/" + sessionId + "/commands", method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }, 'FamilyCatalog'],
    }),
    heartbeatFamilySession: build.mutation<FamilySessionParticipant, { sessionId: number | string } & FamilyPresenceHeartbeatRequest>({
      query: ({ sessionId, ...body }) => ({ url: '/family/sessions/' + sessionId + '/presence', method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    publishFamilySelectionFocus: build.mutation<void, { sessionId: number | string; element_key: string; client_event_id: string }>({
      query: ({ sessionId, ...body }) => ({ url: '/family/sessions/' + sessionId + '/selection-focus', method: "POST", body }),
    }),
    leaveFamilySession: build.mutation<void, number | string>({
      query: (sessionId) => ({ url: '/family/sessions/' + sessionId + '/leave', method: "POST" }),
      invalidatesTags: (_result, _error, sessionId) => [{ type: "FamilySession", id: sessionId }],
    }),
    createCaregiverComment: build.mutation<FamilyCaregiverComment, { sessionId: number | string } & FamilyCaregiverCommentCreateRequest>({
      query: ({ sessionId, ...body }) => ({ url: '/family/sessions/' + sessionId + '/comments', method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    updateCaregiverComment: build.mutation<FamilyCaregiverComment, { sessionId: number | string; comment_ref: string; text: string }>({
      query: ({ sessionId, comment_ref, ...body }) => ({ url: '/family/sessions/' + sessionId + '/comments/' + comment_ref, method: "PATCH", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    getFamilyMessages: build.query<FamilyMessage[], { sessionId: number | string; upTo: number }>({
      query: ({ sessionId, upTo }) => '/family/sessions/' + sessionId + '/messages?up_to=' + upTo,
    }),
    submitCheckpointResponse: build.mutation<
      CheckpointResponse,
      {
        sessionId: number | string;
        checkpoint_message_id: number;
        responder_role: ParticipantRole;
        response_text: string;
        flagged_message_ids: number[];
        tactic_tag_guess?: string | null;
        share_with_caregiver?: boolean;
        expected_state_version?: number;
        client_command_id?: string;
      }
    >({
      query: ({ sessionId, ...body }) => ({ url: '/family/sessions/' + sessionId + '/checkpoint-responses', method: 'POST', body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: 'FamilySession', id: sessionId }],
    }),
    submitCompanionCheckpoint: build.mutation<
      CompanionCheckpointResult,
      {
        sessionId: number | string;
        checkpoint_message_id: number;
        child_response_text: string;
        flagged_message_ids: number[];
        tactic_tag_guess?: string | null;
        client_command_id?: string;
      }
    >({
      query: ({ sessionId, ...body }) => ({ url: '/companion/sessions/' + sessionId + '/checkpoint', method: 'POST', body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: 'FamilySession', id: sessionId }],
    }),
    submitFlagAttempt: build.mutation<FlagAttempt, { sessionId: number | string } & FlagAttemptRequest>({
      query: ({ sessionId, ...body }) => ({ url: "/companion/sessions/" + sessionId + "/flag-attempts", method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    requestCompanionHint: build.mutation<HintResponse, { sessionId: number | string; element_key?: string; client_command_id: string }>({
      query: ({ sessionId, ...body }) => ({ url: "/companion/sessions/" + sessionId + "/hints", method: "POST", body }),
    }),
    explainWithCompanion: build.mutation<
      { response_text: string; disclosure_triggered: boolean; support_resources: SupportResource[] },
      { sessionId: number | string; message: string; element_key?: string }
    >({
      query: ({ sessionId, ...body }) => ({ url: '/companion/sessions/' + sessionId + '/explain', method: 'POST', body }),
    }),
    requestSharedCompanionFeedback: build.mutation<SharedCompanionFeedback, { sessionId: number | string; message: string; element_key?: string; client_command_id: string }>({
      query: ({ sessionId, ...body }) => ({ url: '/companion/sessions/' + sessionId + '/shared-feedback', method: "POST", body }),
      invalidatesTags: (_result, _error, { sessionId }) => [{ type: "FamilySession", id: sessionId }],
    }),
    completeFamilySession: build.mutation<ConversationGuide, number | string>({
      query: (sessionId) => ({ url: '/family/sessions/' + sessionId + '/complete', method: 'POST' }),
      invalidatesTags: (_result, _error, sessionId) => [{ type: 'FamilySession', id: sessionId }, 'FamilyCatalog'],
    }),
    getFamilyReview: build.query<FamilyReview, number | string>({ query: (sessionId) => '/family/sessions/' + sessionId + '/review', providesTags: (_result, _error, sessionId) => [{ type: 'FamilySession', id: sessionId }] }),
    getConversationGuide: build.query<ConversationGuide, number | string>({
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
    listSimulations: build.query<SimulationRun[], { status?: string; scenario_id?: string; mode?: SimulationMode } | void>({
      query: (filters) => {
        const params = new URLSearchParams();
        if (filters?.status) params.set('status', filters.status);
        if (filters?.scenario_id) params.set('scenario_id', filters.scenario_id);
        if (filters?.mode) params.set('mode', filters.mode);
        const suffix = params.toString();
        return `/admin/simulations${suffix ? `?${suffix}` : ''}`;
      },
      providesTags: ['Simulation'],
    }),
    getSimulationHistory: build.query<SimulationHistoryPage, { status?: string; scenario_id?: string; mode?: SimulationMode; page?: number; page_size?: number }>({
      query: (filters) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
        return `/admin/simulations/history?${params.toString()}`;
      },
      providesTags: ['Simulation'],
    }),
    getSimulation: build.query<SimulationRun, { runId: number; advancedRaw?: boolean }>({
      query: ({ runId, advancedRaw = false }) => `/admin/simulations/${runId}?advanced_raw=${advancedRaw}`,
      providesTags: (_result, _error, { runId }) => [{ type: 'Simulation', id: runId }],
    }),
    getSimulationEventHistory: build.query<SimulationEventHistoryPage, { runId: number; event_type?: string; severity?: string; page?: number; page_size?: number; advancedRaw?: boolean }>({
      query: ({ runId, advancedRaw = false, ...filters }) => {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
        params.set('advanced_raw', String(advancedRaw));
        return `/admin/simulations/${runId}/history?${params.toString()}`;
      },
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
    getSimulationReviewQueue: build.query<AdminReviewQueueItem[], void>({ query: () => '/admin/review-queue', providesTags: ['Simulation'] }),
    publishCuratedTranscript: build.mutation<{ id: number; is_published: boolean }, number>({
      query: (id) => ({ url: `/admin/curated-transcripts/${id}/publish`, method: 'POST' }),
    }),
    getCuratedSceneReview: build.query<AdminSceneDraft, number>({
      query: (id) => `/admin/curated-transcripts/${id}/review`,
    }),
    updateCuratedSceneReview: build.mutation<AdminSceneDraft, { id: number; body: AdminSceneDraft }>({
      query: ({ id, body }) => ({ url: `/admin/curated-transcripts/${id}/review`, method: 'PUT', body }),
    }),

    // Preview validation uses the same scene contract and skin capability manifest as publication.
    getSceneCapabilities: build.query<SkinCapabilityManifest, void>({
      query: () => '/admin/scenarios/scene-capabilities',
    }),
    previewSceneDraft: build.mutation<AdminSceneDraft, AdminSceneDraft>({
      query: (body) => ({ url: '/admin/scenarios/scene-preview', method: 'POST', body }),
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
  useCreateFamilyInvitationMutation,
  useGetFamilyInvitationsQuery,
  usePreviewFamilyInvitationQuery,
  useAcceptFamilyInvitationMutation,
  useDeclineFamilyInvitationMutation,
  useRevokeFamilyInvitationMutation,
  useGetFamilyRelationshipsQuery,
  useUpdateFamilyRelationshipMutation,
  useGetAuthorizedFamilySessionsQuery,
  useGetFamilySessionQuery,
  useAcceptFamilyInvitationAsRecipientMutation,
  useDeclineFamilyInvitationAsRecipientMutation,
  useJoinFamilySessionMutation,
  useGenerateJoinCodeMutation,
  useCommandFamilySessionMutation,
  useHeartbeatFamilySessionMutation,
  usePublishFamilySelectionFocusMutation,
  useLeaveFamilySessionMutation,
  useCreateCaregiverCommentMutation,
  useUpdateCaregiverCommentMutation,
  useCreateFamilySessionMutation,
  useRestartFamilySessionMutation,
  useGetFamilyMessagesQuery,
  useSubmitCheckpointResponseMutation,
  useSubmitCompanionCheckpointMutation,
  useSubmitFlagAttemptMutation,
  useRequestCompanionHintMutation,
  useExplainWithCompanionMutation,
  useRequestSharedCompanionFeedbackMutation,
  useCompleteFamilySessionMutation,
  useGetConversationGuideQuery,
  useGetFamilyReviewQuery,
  useGetSummaryQuery,
  useCreateSimulationMutation,
  useListSimulationsQuery,
  useGetSimulationHistoryQuery,
  useGetSimulationQuery,
  useGetSimulationEventHistoryQuery,
  usePauseSimulationMutation,
  useResumeSimulationMutation,
  useStopSimulationMutation,
  useRespondToSimulationMutation,
  useEditSimulationMessageMutation,
  useRegenerateSimulationLastTurnMutation,
  useDecideSimulationMutation,
  useGetSimulationReviewQueueQuery,
  usePublishCuratedTranscriptMutation,
  useGetCuratedSceneReviewQuery,
  useUpdateCuratedSceneReviewMutation,
  useGetSceneCapabilitiesQuery,
  usePreviewSceneDraftMutation,
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
