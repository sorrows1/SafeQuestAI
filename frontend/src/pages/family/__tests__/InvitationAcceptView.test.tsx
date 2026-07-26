import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/theme';
import { InvitationAcceptView } from '../InvitationAcceptView';

const mocked = vi.hoisted(() => ({
  preview: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
}));

vi.mock('@/store/api', () => ({
  safeQuestApi: { reducerPath: 'safeQuestApi', reducer: (s = {}) => s, middleware: () => (next: any) => (action: any) => next(action) },
  usePreviewFamilyInvitationQuery: (secret: string) => mocked.preview(secret),
  useAcceptFamilyInvitationMutation: () => [mocked.accept, { isLoading: false, error: null }],
  useDeclineFamilyInvitationMutation: () => [mocked.decline, { isLoading: false }],
}));

const mockPreview = {
  invitation_ref: 'fi_123',
  inviter_display_name: 'Jordan Caregiver',
  expires_at: '2026-08-01T00:00:00Z',
  sharing_summary: 'Linking only enables explicitly shared family scenarios.',
};

const renderView = (initialEntry = '/family/invitations/accept?secret=tok_abc123') =>
  render(
    <ThemeProvider theme={darkTheme}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <InvitationAcceptView />
      </MemoryRouter>
    </ThemeProvider>
  );

describe('InvitationAcceptView Page', () => {
  beforeEach(() => {
    mocked.preview.mockReset();
    mocked.accept.mockReset();
    mocked.decline.mockReset();
  });

  it('renders short code input form when no secret parameter is present', () => {
    mocked.preview.mockReturnValue({ data: undefined, isLoading: false, isError: false });
    renderView('/family/invitations/accept');

    expect(screen.getByText('Family Invitation')).toBeTruthy();
    expect(screen.getByLabelText(/short code or secret token/i)).toBeTruthy();
  });

  it('renders preview card when valid secret parameter is supplied', () => {
    mocked.preview.mockReturnValue({ data: mockPreview, isLoading: false, isError: false });
    renderView('/family/invitations/accept?secret=tok_abc123');

    expect(screen.getByText('Accept Family Invitation?')).toBeTruthy();
    expect(screen.getByText('Jordan Caregiver')).toBeTruthy();
    expect(screen.getByRole('button', { name: /accept invitation/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /decline/i })).toBeTruthy();
  });

  it('shows generic unavailable error screen when invitation is expired or invalid', () => {
    mocked.preview.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    renderView('/family/invitations/accept?secret=invalid_secret');

    expect(screen.getByText('Invitation Unavailable')).toBeTruthy();
    expect(screen.getByText(/this invitation link or code is invalid, expired/i)).toBeTruthy();
  });

  it('calls accept mutation when Accept Invitation is clicked', async () => {
    mocked.preview.mockReturnValue({ data: mockPreview, isLoading: false, isError: false });
    mocked.accept.mockReturnValue({ unwrap: () => Promise.resolve({ relationship_ref: 'fr_999' }) });

    renderView('/family/invitations/accept?secret=tok_abc123');

    fireEvent.click(screen.getByRole('button', { name: /accept invitation/i }));

    await waitFor(() => {
      expect(mocked.accept).toHaveBeenCalledWith({ secret: 'tok_abc123' });
      expect(screen.getByText('Family Relationship Linked!')).toBeTruthy();
    });
  });
});
