import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type {
  ScenarioDefinition, PersonaDefinition, StageDefinition,
  ObjectiveDefinition, ConstraintDefinition, PromptTemplate,
  SimulatorStartRequest, SimulatorStartResponse,
  SimulatorChatRequest, SimulatorChatResponse,
  ValidationReport, ConfigSummary,
} from '@/types';

export const safeQuestApi = createApi({
  reducerPath: 'safeQuestApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Scenario', 'Persona', 'Stage', 'Objective', 'Constraint', 'Prompt'],

  endpoints: (build) => ({

    // ── Config Summary ──────────────────────────────────────────────────────
    getSummary: build.query<ConfigSummary, void>({
      query: () => '/config/summary',
    }),

    // ── Scenarios ───────────────────────────────────────────────────────────
    listScenarios: build.query<ScenarioDefinition[], void>({
      query: () => '/scenarios/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Scenario' as const, id })), { type: 'Scenario', id: 'LIST' }]
          : [{ type: 'Scenario', id: 'LIST' }],
    }),
    getScenario: build.query<ScenarioDefinition, string>({
      query: (id) => `/scenarios/${id}`,
      providesTags: (_r, _e, id) => [{ type: 'Scenario', id }],
    }),
    createScenario: build.mutation<ScenarioDefinition, ScenarioDefinition>({
      query: (body) => ({ url: '/scenarios/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),
    updateScenario: build.mutation<ScenarioDefinition, { id: string; body: ScenarioDefinition }>({
      query: ({ id, body }) => ({ url: `/scenarios/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Scenario', id }, { type: 'Scenario', id: 'LIST' }],
    }),
    deleteScenario: build.mutation<void, string>({
      query: (id) => ({ url: `/scenarios/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Scenario', id }, { type: 'Scenario', id: 'LIST' }],
    }),
    duplicateScenario: build.mutation<ScenarioDefinition, string>({
      query: (id) => ({ url: `/scenarios/${id}/duplicate`, method: 'POST' }),
      invalidatesTags: [{ type: 'Scenario', id: 'LIST' }],
    }),

    // ── Personas ────────────────────────────────────────────────────────────
    listPersonas: build.query<PersonaDefinition[], void>({
      query: () => '/personas/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Persona' as const, id })), { type: 'Persona', id: 'LIST' }]
          : [{ type: 'Persona', id: 'LIST' }],
    }),
    createPersona: build.mutation<PersonaDefinition, PersonaDefinition>({
      query: (body) => ({ url: '/personas/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Persona', id: 'LIST' }],
    }),
    updatePersona: build.mutation<PersonaDefinition, { id: string; body: PersonaDefinition }>({
      query: ({ id, body }) => ({ url: `/personas/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Persona', id }, { type: 'Persona', id: 'LIST' }],
    }),
    deletePersona: build.mutation<void, string>({
      query: (id) => ({ url: `/personas/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Persona', id }, { type: 'Persona', id: 'LIST' }],
    }),

    // ── Stages ──────────────────────────────────────────────────────────────
    listStages: build.query<StageDefinition[], void>({
      query: () => '/stages/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Stage' as const, id })), { type: 'Stage', id: 'LIST' }]
          : [{ type: 'Stage', id: 'LIST' }],
    }),
    createStage: build.mutation<StageDefinition, StageDefinition>({
      query: (body) => ({ url: '/stages/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Stage', id: 'LIST' }],
    }),
    updateStage: build.mutation<StageDefinition, { id: string; body: StageDefinition }>({
      query: ({ id, body }) => ({ url: `/stages/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Stage', id }, { type: 'Stage', id: 'LIST' }],
    }),
    deleteStage: build.mutation<void, string>({
      query: (id) => ({ url: `/stages/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Stage', id }, { type: 'Stage', id: 'LIST' }],
    }),

    // ── Objectives ──────────────────────────────────────────────────────────
    listObjectives: build.query<ObjectiveDefinition[], void>({
      query: () => '/objectives/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Objective' as const, id })), { type: 'Objective', id: 'LIST' }]
          : [{ type: 'Objective', id: 'LIST' }],
    }),
    createObjective: build.mutation<ObjectiveDefinition, ObjectiveDefinition>({
      query: (body) => ({ url: '/objectives/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Objective', id: 'LIST' }],
    }),
    updateObjective: build.mutation<ObjectiveDefinition, { id: string; body: ObjectiveDefinition }>({
      query: ({ id, body }) => ({ url: `/objectives/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Objective', id }, { type: 'Objective', id: 'LIST' }],
    }),
    deleteObjective: build.mutation<void, string>({
      query: (id) => ({ url: `/objectives/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Objective', id }, { type: 'Objective', id: 'LIST' }],
    }),

    // ── Constraints ─────────────────────────────────────────────────────────
    listConstraints: build.query<ConstraintDefinition[], void>({
      query: () => '/constraints/',
      providesTags: (result) =>
        result
          ? [...result.map(({ id }) => ({ type: 'Constraint' as const, id })), { type: 'Constraint', id: 'LIST' }]
          : [{ type: 'Constraint', id: 'LIST' }],
    }),
    createConstraint: build.mutation<ConstraintDefinition, ConstraintDefinition>({
      query: (body) => ({ url: '/constraints/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Constraint', id: 'LIST' }],
    }),
    updateConstraint: build.mutation<ConstraintDefinition, { id: string; body: ConstraintDefinition }>({
      query: ({ id, body }) => ({ url: `/constraints/${id}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { id }) => [{ type: 'Constraint', id }, { type: 'Constraint', id: 'LIST' }],
    }),
    deleteConstraint: build.mutation<void, string>({
      query: (id) => ({ url: `/constraints/${id}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, id) => [{ type: 'Constraint', id }, { type: 'Constraint', id: 'LIST' }],
    }),

    // ── Prompt Templates ────────────────────────────────────────────────────
    listPrompts: build.query<PromptTemplate[], void>({
      query: () => '/prompts/',
      providesTags: (result) =>
        result
          ? [...result.map(({ name }) => ({ type: 'Prompt' as const, id: name })), { type: 'Prompt', id: 'LIST' }]
          : [{ type: 'Prompt', id: 'LIST' }],
    }),
    createPrompt: build.mutation<PromptTemplate, PromptTemplate>({
      query: (body) => ({ url: '/prompts/', method: 'POST', body }),
      invalidatesTags: [{ type: 'Prompt', id: 'LIST' }],
    }),
    updatePrompt: build.mutation<PromptTemplate, { name: string; body: PromptTemplate }>({
      query: ({ name, body }) => ({ url: `/prompts/${name}`, method: 'PUT', body }),
      invalidatesTags: (_r, _e, { name }) => [{ type: 'Prompt', id: name }, { type: 'Prompt', id: 'LIST' }],
    }),
    deletePrompt: build.mutation<void, string>({
      query: (name) => ({ url: `/prompts/${name}`, method: 'DELETE' }),
      invalidatesTags: (_r, _e, name) => [{ type: 'Prompt', id: name }, { type: 'Prompt', id: 'LIST' }],
    }),
    previewPrompt: build.mutation<{ rendered: string }, { name: string; vars: Record<string, string> }>({
      query: ({ name, vars }) => ({ url: `/prompts/${name}/preview`, method: 'POST', body: vars }),
    }),

    // ── Simulator ───────────────────────────────────────────────────────────
    startSession: build.mutation<SimulatorStartResponse, SimulatorStartRequest>({
      query: (body) => ({ url: '/simulator/start', method: 'POST', body }),
    }),
    chatMessage: build.mutation<SimulatorChatResponse, { req: SimulatorChatRequest; debug?: boolean }>({
      query: ({ req, debug = false }) => ({
        url: `/simulator/chat?debug=${debug}`,
        method: 'POST',
        body: req,
      }),
    }),

    // ── Validation ──────────────────────────────────────────────────────────
    validateAll: build.query<ValidationReport, void>({
      query: () => '/validation/',
    }),
    validateScenario: build.query<ValidationReport, string>({
      query: (id) => `/validation/scenario/${id}`,
    }),
  }),
});

export const {
  useGetSummaryQuery,
  // Scenarios
  useListScenariosQuery,
  useGetScenarioQuery,
  useCreateScenarioMutation,
  useUpdateScenarioMutation,
  useDeleteScenarioMutation,
  useDuplicateScenarioMutation,
  // Personas
  useListPersonasQuery,
  useCreatePersonaMutation,
  useUpdatePersonaMutation,
  useDeletePersonaMutation,
  // Stages
  useListStagesQuery,
  useCreateStageMutation,
  useUpdateStageMutation,
  useDeleteStageMutation,
  // Objectives
  useListObjectivesQuery,
  useCreateObjectiveMutation,
  useUpdateObjectiveMutation,
  useDeleteObjectiveMutation,
  // Constraints
  useListConstraintsQuery,
  useCreateConstraintMutation,
  useUpdateConstraintMutation,
  useDeleteConstraintMutation,
  // Prompts
  useListPromptsQuery,
  useCreatePromptMutation,
  useUpdatePromptMutation,
  useDeletePromptMutation,
  usePreviewPromptMutation,
  // Simulator
  useStartSessionMutation,
  useChatMessageMutation,
  // Validation
  useLazyValidateAllQuery,
  useLazyValidateScenarioQuery,
} = safeQuestApi;
