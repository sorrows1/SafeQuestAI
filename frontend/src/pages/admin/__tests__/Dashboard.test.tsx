import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { Dashboard } from '../Dashboard';
import { safeQuestApi } from '@/store/api';

const theme = createTheme();

const mockSummary = {
  scenarios: [
    { id: 'gaming_chat_boundary_pressure', display_name: 'Gaming Boundary Pressure', difficulty: 'Medium' as const },
    { id: 'pause_before_posting', display_name: 'Pause Before Posting', difficulty: 'Easy' as const },
  ],
  personas: ['persona_groomer', 'persona_child'],
  stages: ['stage_grooming_trust', 'stage_grooming_isolation'],
  objectives: ['obj_trust_building', 'obj_private_platform'],
  constraints: ['constraint_no_explicit'],
  prompt_templates: ['initiator_system', 'respondent_system'],
  observability: {
    review_ready_count: 3,
    unpublished_approved_transcript_count: 2,
    active_run_count: 1,
    failed_run_count: 0,
    limited_run_count: 1,
    validation_blocker_count: 0,
    recently_published: [
      { id: 101, scenario_id: 'gaming_chat_boundary_pressure', category: 'grooming', published_at: new Date().toISOString() },
    ],
    system_health: { database: 'available' as const, llm: 'available' as const },
  },
};

vi.mock('@/store/api', async () => {
  const actual: any = await vi.importActual('@/store/api');
  return {
    ...actual,
    useGetSummaryQuery: () => ({
      data: mockSummary,
      isLoading: false,
      error: null,
    }),
    useLazyValidateAllQuery: () => [vi.fn(), { data: null, isFetching: false }],
  };
});

function createMockStore() {
  return configureStore({
    reducer: {
      [safeQuestApi.reducerPath]: safeQuestApi.reducer,
      auth: () => ({ accessToken: 'mock-token', user: { role: 'admin' } }),
      ui: () => ({ themeMode: 'dark' }),
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(safeQuestApi.middleware),
  });
}

describe('Phase 10 —  Admin Dashboard Observability Redesign', () => {
  it('renders dashboard title, system health chips, and operational action cards', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );

    expect(screen.getByText('Platform Dashboard & Observability')).toBeTruthy();

    // System Health chips
    expect(screen.getByText('Database: available')).toBeTruthy();
    expect(screen.getByText('LLM Engine: available')).toBeTruthy();

    // Action Required Cards
    expect(screen.getByText('Review Ready')).toBeTruthy();
    expect(screen.getByText('Unpublished Approved')).toBeTruthy();
    expect(screen.getByText('Failed / Limited Runs')).toBeTruthy();
    expect(screen.getByText('Validation Blockers')).toBeTruthy();
  });

  it('renders content inventory overview cards and scenario catalog', () => {
    const store = createMockStore();

    render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          <MemoryRouter>
            <Dashboard />
          </MemoryRouter>
        </ThemeProvider>
      </Provider>
    );

    expect(screen.getByText('Content Inventory Overview')).toBeTruthy();
    expect(screen.getByText('Scenarios & Validation Status')).toBeTruthy();
    expect(screen.getByText('Gaming Boundary Pressure')).toBeTruthy();
    expect(screen.getByText('Pause Before Posting')).toBeTruthy();
  });
});
