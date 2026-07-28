import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { PresenceAvatarBar } from '@/components/family/PresenceAvatarBar';
import { CaregiverCommentSection } from '@/components/family/CaregiverCommentSection';
import { PostSessionSharedReview } from '@/components/family/PostSessionSharedReview';
import { FamilyGameplayView } from '../FamilyGameplayView';
import type {
  FamilyCaregiverComment,
  FamilyMessage,
  FamilySessionParticipant,
  ValidatedFinding,
} from '@/types';

const theme = createTheme();

const mockParticipants: FamilySessionParticipant[] = [
  {
    member_ref: 'usr-child-1',
    display_name: 'Sam',
    avatar_url: null,
    role: 'learner',
    joined_at: '2026-07-26T10:00:00Z',
    last_seen_at: '2026-07-26T10:05:00Z',
    presence_status: 'online',
  },
  {
    member_ref: 'usr-parent-1',
    display_name: 'Morgan',
    avatar_url: null,
    role: 'caregiver',
    joined_at: '2026-07-26T10:01:00Z',
    last_seen_at: '2026-07-26T10:04:00Z',
    presence_status: 'offline',
  },
];

const mockComments: FamilyCaregiverComment[] = [
  {
    comment_ref: 'cmt-1',
    author_ref: 'usr-parent-1',
    author_display_name: 'Morgan (Parent)',
    element_key: 'legacy-102',
    annotation_id: null,
    text: 'Notice how Alex put pressure on you right away.',
    child_visible_label: 'Caregiver Guidance',
    created_at: '2026-07-26T10:06:00Z',
    updated_at: '2026-07-26T10:06:00Z',
  },
];

const mockFindings: ValidatedFinding[] = [
  {
    element_key: 'legacy-102',
    annotation_id: 1,
    tactic_tag: 'boundary_pressure',
    explanation: 'The sender demanded immediate action under threat.',
    discovered_at: '2026-07-26T10:04:00Z',
    visibility: 'shared',
  },
];

const sampleMessages: FamilyMessage[] = [
  {
    id: 101,
    sequence: 0,
    speaker_label: 'Riley',
    content: 'Hey everyone, check your slides.',
    pace: 'normal',
    is_checkpoint: false,
    checkpoint_prompt: null,
  },
  {
    id: 102,
    sequence: 1,
    speaker_label: 'Alex',
    content: 'Send your password right now or you are out of the group.',
    pace: 'normal',
    is_checkpoint: true,
    checkpoint_prompt: 'What would you do?',
  },
];

describe('Phase 8 —  Multiplayer & Post-Session Review UI', () => {
  describe('PresenceAvatarBar', () => {
    it('renders participant avatars, presence indicators, and turn labels', () => {
      render(
        <ThemeProvider theme={theme}>
          <PresenceAvatarBar
            participants={mockParticipants}
            streamStatus="connected"
            turnRole="learner"
            userRole="learner"
          />
        </ThemeProvider>
      );

      expect(screen.getByText('Session Participants')).toBeTruthy();
      expect(screen.getByText('Your turn to explore scene')).toBeTruthy();
    });

    it('renders offline stream banner and disconnect options when participant is offline', () => {
      const onReconnect = vi.fn();
      const onContinueAsync = vi.fn();

      render(
        <ThemeProvider theme={theme}>
          <PresenceAvatarBar
            participants={mockParticipants}
            streamStatus="offline"
            turnRole="caregiver"
            userRole="learner"
            onReconnect={onReconnect}
            onContinueAsync={onContinueAsync}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/Live connection paused/i)).toBeTruthy();
      expect(screen.getByText(/Morgan is currently offline/i)).toBeTruthy();

      const asyncBtn = screen.getByText('Continue Asynchronously');
      fireEvent.click(asyncBtn);
      expect(onContinueAsync).toHaveBeenCalled();
    });
  });

  describe('CaregiverCommentSection', () => {
    it('renders caregiver comments with child-visible guidance label', () => {
      render(
        <ThemeProvider theme={theme}>
          <CaregiverCommentSection
            comments={mockComments}
            elementKey="legacy-102"
            canAddComment={false}
          />
        </ThemeProvider>
      );

      expect(screen.getByText(/Caregiver Discussion Notes \(1\)/i)).toBeTruthy();
      expect(screen.getByText(/"Notice how Alex put pressure on you right away."/i)).toBeTruthy();
    });

    it('allows caregiver to submit a new guidance comment', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);

      render(
        <ThemeProvider theme={theme}>
          <CaregiverCommentSection
            comments={[]}
            elementKey="legacy-102"
            canAddComment={true}
            onSubmitComment={onSubmit}
          />
        </ThemeProvider>
      );

      const input = screen.getByPlaceholderText(/Add a supportive discussion note/i);
      fireEvent.change(input, { target: { value: 'Great job identifying the pressure!' } });

      const submitBtn = screen.getByText('Post Note');
      fireEvent.click(submitBtn);

      expect(onSubmit).toHaveBeenCalledWith('Great job identifying the pressure!', 'legacy-102');
    });
  });

  describe('PostSessionSharedReview', () => {
    it('renders post-session shared review with recap, findings, and safety action tabs', () => {
      render(
        <ThemeProvider theme={theme}>
          <PostSessionSharedReview
            scenarioTitle="Boundary Pressure Scenario"
            category="cyberbullying"
            completedTogether={true}
            validatedFindings={mockFindings}
            caregiverComments={mockComments}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('Boundary Pressure Scenario — Post-Session Family Review')).toBeTruthy();
      expect(screen.getByText('Completed Together')).toBeTruthy();

      // Validated findings tab content
      expect(screen.getAllByText(/BOUNDARY PRESSURE/i).length).toBeGreaterThan(0);
      expect(screen.getByText('The sender demanded immediate action under threat.')).toBeTruthy();

      // Ensure no grades or scores are rendered
      expect(screen.queryByText(/Grade/i)).toBeNull();
      expect(screen.queryByText(/Score/i)).toBeNull();
      expect(screen.queryByText(/Accuracy/i)).toBeNull();
    });

    it('renders persisted review totals, unresolved concerns, reasoning, checkpoints and next steps', () => {
      render(<ThemeProvider theme={theme}><PostSessionSharedReview review={{ session_ref: 's1', attempts: [], total_annotated_concerns: 3, identified_concerns: 3, unresolved_concerns: 1, concerns: [{ element_key: 'e1', annotation_ids: [1], tactic_tag: 'BOUNDARY_PRESSURE', text: 'A pressured request', explanation: 'Notice pressure', identified: true, selected_for_revisit: true, shared_reasoning: 'We would pause and ask for help.' }], non_concerning_selections: [], completed_checkpoints: [{ responder_role: 'child', checkpoint_message_id: 1, text: 'We discussed this together.' }, { responder_role: 'parent', checkpoint_message_id: 2, text: 'We paused together.' }], shared_discussion: [{ responder_role: 'caregiver', text: 'We discussed this together.' }], suggested_next_steps: ['Talk to a trusted adult.'], practice_areas: ['Privacy boundaries'] }} /></ThemeProvider>);
      expect(screen.getByText(/Annotated concerns: 3 · Identified: 3 · To revisit: 1/)).toBeTruthy();
      expect(screen.getByText('A pressured request')).toBeTruthy();
      expect(screen.getByText(/We would pause and ask for help/)).toBeTruthy();
      expect(screen.getByText(/Completed checkpoints: 2/)).toBeTruthy();
      expect(screen.getByText(/Talk to a trusted adult/)).toBeTruthy();
      expect(screen.queryByText(/No red flags were explicitly tagged/)).toBeNull();
    });
  });

  describe('FamilyGameplayView Multiplayer Integration', () => {
    it('renders presence bar, mission bar with turn chip, and caregiver section', () => {
      const sceneRef = createRef<HTMLDivElement>();

      render(
        <ThemeProvider theme={theme}>
          <FamilyGameplayView
            renderSkin="chat"
            messages={sampleMessages}
            highlightedMessageIds={[102]}
            onToggleMessage={vi.fn()}
            onSceneScroll={vi.fn()}
            sceneRef={sceneRef}
            showNewContent={false}
            onJumpToNewest={vi.fn()}
            title="Boundary Pressure Test"
            state="active"
            participants={mockParticipants}
            streamStatus="connected"
            turnRole="learner"
            caregiverComments={mockComments}
            canAddComment={true}
          />
        </ThemeProvider>
      );

      expect(screen.getByText('Session Participants')).toBeTruthy();
      expect(screen.getByText('Caregiver Discussion Notes (1)')).toBeTruthy();
    });
  });
});
