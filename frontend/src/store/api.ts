import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { RootState } from '@/store';
import type {
  ScenarioDefinition, PersonaDefinition, StageDefinition,
  ObjectiveDefinition, ConstraintDefinition, PromptTemplate,
  SimulatorStartRequest, SimulatorStartResponse,
  SimulatorChatRequest, SimulatorChatResponse,
  ValidationReport, ConfigSummary,
} from '@/types';

// ── Public/auth types ────────────────────────────────────────────────────────
export interface AuthTokens { access_token: string; refresh_token: string; token_type: string; }
export interface UserOut { id: number; email: string; display_name: string; avatar_url: string | null; role: string; google_id: string | null; }
export interface ConversationOut { id: number; contact_name: string; contact_avatar: string | null; status: string; last_message_at: string | null; unread_count: number; last_message: string | null; }
export interface MessageOut { id: number; sender: string; content: string; timestamp: string; is_read: boolean; }
export interface ConversationDetailOut { id: number; contact_name: string; contact_avatar: string | null; status: string; messages: MessageOut[]; }
export interface MessageRequestItem { scenario_id: string; contact_name: string; contact_avatar: string; preview: string; difficulty: string; }
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
  tagTypes: ['Scenario', 'Persona', 'Stage', 'Objective', 'Constraint', 'Prompt', 'Conversation', 'User'],

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

    // ── Admin Config Summary ────────────────────────────────────────────────
    getSummary: build.query<ConfigSummary, void>({
      query: () => '/admin/config/summary',
    }),

    // ── Public Conversations ────────────────────────────────────────────────
    listConversations: build.query<ConversationOut[], void>({
      query: () => '/conversations/',
      providesTags: ['Conversation'],
    }),
    getConversation: build.query<ConversationDetailOut, number>({
      query: (id) => `/conversations/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Conversation', id }],
    }),
    getMessageRequests: build.query<MessageRequestItem[], void>({
      query: () => '/conversations/requests',
    }),
    acceptRequest: build.mutation<ConversationOut, { scenario_id: string; difficulty: string }>({
      query: (body) => ({ url: '/conversations/', method: 'POST', body }),
      invalidatesTags: ['Conversation'],
    }),
    sendMessage: build.mutation<MessageOut, { conv_id: number; content: string }>({
      query: ({ conv_id, content }) => ({ url: `/conversations/${conv_id}/message`, method: 'POST', body: { content } }),
      invalidatesTags: (_r, _e, { conv_id }) => [{ type: 'Conversation', id: conv_id }, 'Conversation'],
    }),
    patchConversation: build.mutation<ConversationOut, { id: number; status: string }>({
      query: ({ id, status }) => ({ url: `/conversations/${id}`, method: 'PATCH', body: { status } }),
      invalidatesTags: ['Conversation'],
    }),
    deleteConversation: build.mutation<void, number>({
      query: (id) => ({ url: `/conversations/${id}`, method: 'DELETE' }),
      invalidatesTags: ['Conversation'],
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
  useGetSummaryQuery,
  useListConversationsQuery, useGetConversationQuery, useGetMessageRequestsQuery,
  useAcceptRequestMutation, useSendMessageMutation,
  usePatchConversationMutation, useDeleteConversationMutation,
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
