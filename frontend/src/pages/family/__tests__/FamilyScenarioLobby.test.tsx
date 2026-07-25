import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/theme';
const mocked = vi.hoisted(() => ({ query: vi.fn(), create: vi.fn() }));
vi.mock('@/store/api', () => ({ useGetFamilyScenariosQuery: () => mocked.query(), useCreateFamilySessionMutation: () => [mocked.create, { isLoading: false, error: null }] }));
import { FamilyScenarioLobby } from '../FamilyScenarioLobby';
const scenario = { id: 1, title: 'A private prize', summary: 'A calm example.', category: 'scam', render_skin: 'chat' as const, difficulty: 'Easy', tags: ['privacy'], learning_objectives: ['Ask for help'], message_count: 4, checkpoint_count: 1, published_at: '2026-07-25T00:00:00Z', supported_participation_modes: ['with_parent', 'with_companion'] };
const renderLobby = () => render(<ThemeProvider theme={darkTheme}><MemoryRouter><FamilyScenarioLobby /></MemoryRouter></ThemeProvider>);
describe('FamilyScenarioLobby', () => {
  beforeEach(() => { mocked.query.mockReset(); mocked.create.mockReset(); });
  it('shows a retryable error and a prepared-library state', () => { mocked.query.mockReturnValue({ data: undefined, isLoading: false, isFetching: false, isError: true, refetch: vi.fn() }); renderLobby(); expect(screen.getByRole('button', { name: /try again/i })).toBeTruthy(); mocked.query.mockReturnValue({ data: { items: [], total: 0, page: 1, limit: 12 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() }); renderLobby(); expect(screen.getByText(/being prepared/i)).toBeTruthy(); });
  it('opens the accessible detail and setup flow from a reviewed card', () => { mocked.query.mockReturnValue({ data: { items: [scenario], total: 1, page: 1, limit: 12 }, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() }); renderLobby(); fireEvent.click(screen.getByRole('button', { name: /learn more about a private prize/i })); expect(screen.getByRole('dialog')).toBeTruthy(); expect(screen.getByRole('button', { name: /start discussion/i })).toBeTruthy(); });
});
