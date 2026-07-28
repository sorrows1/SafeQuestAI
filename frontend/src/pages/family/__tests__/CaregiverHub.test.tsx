import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/theme';
import { CaregiverHub } from '../CaregiverHub';

const mocked = vi.hoisted(() => ({
  relationships: vi.fn(),
  invitations: vi.fn(),
  sessions: vi.fn(),
  revoke: vi.fn(),
  updateRel: vi.fn(),
  createInv: vi.fn(),
}));

vi.mock('@/store/api', () => ({
  safeQuestApi: { reducerPath: 'safeQuestApi', reducer: (s = {}) => s, middleware: () => (next: any) => (action: any) => next(action) },
  useGetFamilyRelationshipsQuery: () => mocked.relationships(),
  useGetFamilyInvitationsQuery: () => mocked.invitations(),
  useGetAuthorizedFamilySessionsQuery: () => mocked.sessions(),
  useRevokeFamilyInvitationMutation: () => [mocked.revoke, { isLoading: false }],
  useUpdateFamilyRelationshipMutation: () => [mocked.updateRel, { isLoading: false }],
  useCreateFamilyInvitationMutation: () => [mocked.createInv, { isLoading: false, error: null }],
  useAcceptFamilyInvitationAsRecipientMutation: () => [vi.fn(), { isLoading: false }],
  useDeclineFamilyInvitationAsRecipientMutation: () => [vi.fn(), { isLoading: false }],
  useJoinFamilySessionMutation: () => [vi.fn(), { isLoading: false }],
  useGenerateJoinCodeMutation: () => [vi.fn(), { isLoading: false }],
}));

const mockRel = {
  relationship_ref: 'fr_123',
  role: 'caregiver',
  viewer_role: 'caregiver',
  member_role: 'learner',
  member_ref: 'member_456',
  member_display_name: 'Alex Parent',
  member_avatar_url: null,
  accepted_at: '2026-07-26T00:00:00Z',
  status: 'active',
};

const mockInv = {
  invitation_ref: 'fi_789',
  status: 'pending',
  expires_at: '2026-08-01T00:00:00Z',
  created_at: '2026-07-26T00:00:00Z',
  delivery_label: "Mom's Tablet",
  token: 'tok_abc123',
  short_code: 'A7B9K2M4',
  direction: 'sent',
  inviter_role: 'caregiver',
  intended_role: 'learner',
};

const renderHub = () =>
  render(
    <ThemeProvider theme={darkTheme}>
      <MemoryRouter>
        <CaregiverHub />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('CaregiverHub Page', () => {
  beforeEach(() => {
    mocked.relationships.mockReturnValue({ data: [mockRel], isLoading: false });
    mocked.invitations.mockReturnValue({ data: [mockInv], isLoading: false });
    mocked.sessions.mockReturnValue({ data: [], isLoading: false });
  });

  it('renders header, family members tab, and relationships list', () => {
    renderHub();

    expect(screen.getByRole('heading', { name: 'Caregiver Hub' })).toBeTruthy();
    expect(screen.getByText('Alex Parent')).toBeTruthy();
    expect(screen.getByText(/Learner · Connected/i)).toBeTruthy();
  });

  it('switches tabs to view pending invitations', () => {
    renderHub();

    const invitationsTab = screen.getByRole('button', { name: /invitations/i });
    fireEvent.click(invitationsTab);

    expect(screen.getByText(/Invitation to Mom's Tablet/i)).toBeTruthy();
    expect(screen.getByText(/A7B9K2M4/)).toBeTruthy();
  });

  it('shows confirmation dialog when unlinking a relationship', async () => {
    renderHub();

    fireEvent.click(screen.getByRole('button', { name: /unlink/i }));

    await waitFor(() => {
      expect(screen.getByText(/unlink family member/i)).toBeTruthy();
    });
  });
});
