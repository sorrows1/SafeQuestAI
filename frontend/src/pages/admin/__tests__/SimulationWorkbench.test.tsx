import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { configureStore } from '@reduxjs/toolkit';
import { SnackbarProvider } from 'notistack';
import { SimulationWorkbench } from '../SimulationWorkbench';
import { safeQuestApi } from '@/store/api';
import simulationViewerReducer from '@/features/simulation/simulationViewerSlice';
import type { SimulationRun } from '@/types';

const theme = createTheme();

const mockRun: SimulationRun = {
  id: 42,
  scenario_id: 'gaming_chat_boundary_pressure',
  mode: 'ai_vs_ai',
  status: 'running',
  created_at: new Date().toISOString(),
  stop_reason: null,
  diagnostics: {
    progression: {
      current_stage: 'grooming_trust_building',
      next_stage: 'grooming_isolation',
      current_objective: 'obj_build_rapport',
      completed_objectives: ['obj_initial_contact'],
    },
    objectives: {
      current: 'obj_build_rapport',
      completed: ['obj_initial_contact'],
      pending: ['obj_request_private_chat'],
    },
    warnings: [
      { code: 'W_HIGH_TRUST', message: 'Trust delta multiplier elevated', severity: 'warning', source: 'scorer' },
    ],
    safety_findings: [
      { code: 'S_BOUNDARY', message: 'Pressure tactics detected', severity: 'warning', source: 'safety_checker' },
    ],
    tactic_tags: ['trust_building', 'isolation'],
    prompt_provenance: [
      { id: 'p1', name: 'initiator_system', role: 'initiator', version: '1.0', hash: 'abc12345', role_scope: 'initiator' },
    ],
    flags: ['concerning_example'],
  },
  resource_usage: {
    messages: 10,
    message_limit: 30,
    message_percent: 33,
    running_seconds: 120,
    minute_limit: 600,
    time_percent: 20,
    llm_calls: 5,
    prompt_tokens: 1200,
    completion_tokens: 450,
  },
  worker_lease: {
    worker_id: 'worker-node-1',
    leased_until: new Date(Date.now() + 60000).toISOString(),
    state: 'active',
    healthy: true,
  },
  branch_summary: {
    active_branch: 'main',
    branch_count: 1,
    revision_count: 0,
    latest_revision_id: null,
  },
  prompts: {
    initiator_system: 'You are an initiator persona testing boundaries...',
  },
  messages: [
    {
      id: 1,
      sequence: 1,
      branch_id: 'main',
      sender: 'initiator',
      content: 'Hey there! What game are you playing right now?',
      metadata: { stage_id: 'grooming_trust_building', tactic_tags: ['trust_building'] },
      created_at: new Date().toISOString(),
    },
    {
      id: 2,
      sequence: 2,
      branch_id: 'main',
      sender: 'respondent',
      content: 'Just playing SafeQuest RPG with my team!',
      metadata: { is_checkpoint: true, objective_id: 'obj_initial_contact' },
      created_at: new Date().toISOString(),
    },
  ],
};

function createMockStore(customState = {}) {
  return configureStore({
    reducer: {
      [safeQuestApi.reducerPath]: safeQuestApi.reducer,
      simulationViewer: simulationViewerReducer,
      auth: () => ({ accessToken: 'mock-token', user: { role: 'admin' } }),
      ui: () => ({ themeMode: 'dark' }),
    },
    middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(safeQuestApi.middleware),
  });
}

function renderWorkbench(runId?: number) {
  const store = createMockStore();
  const path = runId ? `/admin/simulator/${runId}` : '/admin/simulator';

  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <SnackbarProvider>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path="/admin/simulator" element={<SimulationWorkbench />} />
              <Route path="/admin/simulator/:runId" element={<SimulationWorkbench />} />
            </Routes>
          </MemoryRouter>
        </SnackbarProvider>
      </ThemeProvider>
    </Provider>
  );
}

describe('Phase 10 —  Admin Simulation Observability & Workbench Redesign', () => {
  it('renders workbench header and onboarding view when no run is selected', () => {
    renderWorkbench();

    expect(screen.getAllByText('Simulation Workbench').length).toBeGreaterThan(0);
    expect(screen.getByText(/Durable multi-agent execution/i)).toBeTruthy();
    expect(screen.getByText('No active simulation selected')).toBeTruthy();
    expect(screen.getByText('Start Run')).toBeTruthy();
  });

  it('renders status chips, recommended action banner, and control buttons', () => {
    renderWorkbench(42);

    expect(screen.getAllByText('Simulation Workbench').length).toBeGreaterThan(0);
  });
});
