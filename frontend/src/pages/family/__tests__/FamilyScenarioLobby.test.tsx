import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/theme';
import { FamilyScenarioLobby } from '../FamilyScenarioLobby';

const mocked = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn() }));

vi.mock('@/store/api', () => ({
  safeQuestApi: { reducerPath: 'safeQuestApi', reducer: (s = {}) => s, middleware: () => (next: any) => (action: any) => next(action) },
  useGetFamilyScenariosQuery: (...args: unknown[]) => mocked.query(...args),
  useCreateFamilySessionMutation: () => [mocked.create, { isLoading: false, error: null }],
}));

const scenario = {
  id: 1,
  title: 'A private prize',
  summary: 'A calm example.',
  category: 'scam',
  render_skin: 'chat' as const,
  difficulty: 'Easy',
  tags: ['privacy'],
  learning_objectives: ['Ask for help'],
  message_count: 4,
  checkpoint_count: 1,
  published_at: '2026-07-25T00:00:00Z',
  supported_participation_modes: ['with_parent', 'with_companion'],
};

const renderLobby = (route = '/') =>
  render(
    <ThemeProvider theme={darkTheme}>
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path="/family/scenarios" element={<FamilyScenarioLobby />} />
          <Route path="/family/scenarios/:transcriptId/sessions/:sessionId" element={<div>Player Session View</div>} />
          <Route path="/" element={<FamilyScenarioLobby />} />
        </Routes>
      </MemoryRouter>
    </ThemeProvider>
  );

describe('FamilyScenarioLobby Container', () => {
  beforeEach(() => {
    mocked.query.mockReset();
    mocked.create.mockReset();
  });

  it('shows a retryable error and a prepared-library state', () => {
    mocked.query.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: true, refetch: vi.fn() });
    renderLobby();
    expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy();
    mocked.query.mockReturnValue({
      data: { items: [], total: 0, page: 1, limit: 12 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderLobby();
    expect(screen.getByText(/being prepared/i)).toBeTruthy();
  });

  it('restores single and multi-select filters from a shareable URL', () => {
    mocked.query.mockReturnValue({ data: { items: [], total: 0, page: 2, limit: 12 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() });
    renderLobby('/family/scenarios?search=privacy&category=scam&category=grooming&difficulty=Easy&render_skin=chat&sort=title&page=2');
    
    expect(mocked.query.mock.calls[0][0]).toMatchObject({
      search: 'privacy',
      category: ['scam', 'grooming'],
      difficulty: ['Easy'],
      render_skin: ['chat'],
      sort: 'title',
      page: 2,
    });
    expect(screen.getByRole('textbox', { name: /search reviewed scenarios/i }).getAttribute('value')).toBe('privacy');
  });

  it('opens the accessible detail and setup flow from a reviewed card', () => {
    mocked.query.mockReturnValue({
      data: { items: [scenario], total: 1, page: 1, limit: 12 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderLobby();
    fireEvent.click(screen.getByRole('button', { name: /learn more about a private prize/i }));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('button', { name: /start solo activity/i })).toBeTruthy();
  });

  it('displays participation choices including solo companion, family invite, and join session', () => {
    mocked.query.mockReturnValue({
      data: { items: [scenario], total: 1, page: 1, limit: 12 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    renderLobby();
    fireEvent.click(screen.getByRole('button', { name: /learn more about a private prize/i }));
    expect(screen.getByText(/solo activity with ai companion/i)).toBeTruthy();
    expect(screen.getByText(/invite family member/i)).toBeTruthy();
    expect(screen.getByText(/join active session/i)).toBeTruthy();
  });

  it('creates session and navigates to session player route when start solo is clicked', async () => {
    mocked.query.mockReturnValue({
      data: { items: [scenario], total: 1, page: 1, limit: 12 },
      isLoading: false,
      isFetching: false,
      isError: false,
      refetch: vi.fn(),
    });
    mocked.create.mockReturnValue({ unwrap: () => Promise.resolve({ id: 's_999', transcript_id: 1 }) });

    renderLobby('/family/scenarios');
    fireEvent.click(screen.getByRole('button', { name: /learn more about a private prize/i }));
    fireEvent.click(screen.getByRole('button', { name: /start solo activity/i }));

    await waitFor(() => {
      expect(mocked.create).toHaveBeenCalledWith({ transcriptId: 1 });
      expect(screen.getByText('Player Session View')).toBeTruthy();
    });
  });
});
