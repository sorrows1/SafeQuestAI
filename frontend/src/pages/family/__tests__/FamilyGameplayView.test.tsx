import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeProvider, createTheme } from '@mui/material';
import { FamilyGameplayView } from '../FamilyGameplayView';
import type { FamilyMessage } from '@/types';

const theme = createTheme();

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

describe('FamilyGameplayView', () => {
  it('renders top mission bar with title, status, progress, and action buttons', () => {
    const onHint = vi.fn();
    const onReset = vi.fn();
    const sceneRef = createRef<HTMLDivElement>();

    render(
      <ThemeProvider theme={theme}>
        <FamilyGameplayView
          renderSkin="chat"
          messages={sampleMessages}
          detectiveMode={true}
          highlightedMessageIds={[102]}
          onToggleMessage={vi.fn()}
          onSceneScroll={vi.fn()}
          sceneRef={sceneRef}
          showNewContent={false}
          onJumpToNewest={vi.fn()}
          title="Cyberbullying & Pressure Scenario"
          state="active"
          totalCount={2}
          onHint={onHint}
          onReset={onReset}
        />
      </ThemeProvider>
    );

    expect(screen.getAllByText('Cyberbullying & Pressure Scenario').length).toBeGreaterThan(0);
    expect(screen.getByText('SCENARIO ACTIVE')).toBeTruthy();
    expect(screen.getByText('Findings: 0/0')).toBeTruthy();

    // Trigger hint button
    const hintButton = screen.getByLabelText(/Get age-appropriate discussion hint/i);
    fireEvent.click(hintButton);
    expect(onHint).toHaveBeenCalled();

    // Trigger reset button
    const resetButton = screen.getByLabelText(/Reset activity attempt/i);
    fireEvent.click(resetButton);
    expect(onReset).toHaveBeenCalled();
  });

  it('renders selectable messages with non-color visual flag cues when highlighted', () => {
    const onToggleMessage = vi.fn();
    const sceneRef = createRef<HTMLDivElement>();

    render(
      <ThemeProvider theme={theme}>
        <FamilyGameplayView
          renderSkin="chat"
          messages={sampleMessages}
          detectiveMode={true}
          highlightedMessageIds={[102]}
          onToggleMessage={onToggleMessage}
          onSceneScroll={vi.fn()}
          sceneRef={sceneRef}
          showNewContent={false}
          onJumpToNewest={vi.fn()}
        />
      </ThemeProvider>
    );

    // Flagged message should show non-color cue text
    expect(screen.getByText(/SELECTED FOR (DISCUSSION|EVALUATION)/)).toBeTruthy();

    // Click unhighlighted message
    const firstMessage = screen.getByText('Hey everyone, check your slides.');
    fireEvent.click(firstMessage);
    expect(onToggleMessage).toHaveBeenCalledWith(101);
  });

  it('displays floating "New content below" button when showNewContent is true', () => {
    const onJumpToNewest = vi.fn();
    const sceneRef = createRef<HTMLDivElement>();

    render(
      <ThemeProvider theme={theme}>
        <FamilyGameplayView
          renderSkin="chat"
          messages={sampleMessages}
          detectiveMode={false}
          highlightedMessageIds={[]}
          onToggleMessage={vi.fn()}
          onSceneScroll={vi.fn()}
          sceneRef={sceneRef}
          showNewContent={true}
          onJumpToNewest={onJumpToNewest}
        />
      </ThemeProvider>
    );

    const jumpButton = screen.getByText('New content below');
    expect(jumpButton).toBeTruthy();
    fireEvent.click(jumpButton);
    expect(onJumpToNewest).toHaveBeenCalled();
  });

  it('renders CompletionReviewModal when completionModalOpen is true and handles review actions', () => {
    const onAcknowledge = vi.fn();
    const onOpenHelp = vi.fn();
    const onFinish = vi.fn();
    const sceneRef = createRef<HTMLDivElement>();

    const { rerender } = render(
      <ThemeProvider theme={theme}>
        <FamilyGameplayView
          renderSkin="chat"
          messages={sampleMessages}
          detectiveMode={true}
          highlightedMessageIds={[102]}
          onToggleMessage={vi.fn()}
          onSceneScroll={vi.fn()}
          sceneRef={sceneRef}
          showNewContent={false}
          onJumpToNewest={vi.fn()}
          state="completion_review"
          completionModalOpen={true}
          completionAcknowledged={false}
          onAcknowledgeCompletion={onAcknowledge}
          onOpenHelp={onOpenHelp}
          onFinishCompletion={onFinish}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Scenario Complete — Review Together')).toBeTruthy();
    expect(screen.getByText('I Reviewed the Scene')).toBeTruthy();

    fireEvent.click(screen.getByText('I Reviewed the Scene'));
    expect(onAcknowledge).toHaveBeenCalled();

    // Rerender as acknowledged
    rerender(
      <ThemeProvider theme={theme}>
        <FamilyGameplayView
          renderSkin="chat"
          messages={sampleMessages}
          detectiveMode={true}
          highlightedMessageIds={[102]}
          onToggleMessage={vi.fn()}
          onSceneScroll={vi.fn()}
          sceneRef={sceneRef}
          showNewContent={false}
          onJumpToNewest={vi.fn()}
          state="completion_review"
          completionModalOpen={true}
          completionAcknowledged={true}
          onAcknowledgeCompletion={onAcknowledge}
          onOpenHelp={onOpenHelp}
          onFinishCompletion={onFinish}
        />
      </ThemeProvider>
    );

    expect(screen.getByText('Who Could Help?')).toBeTruthy();
    expect(screen.getByText('Finish & View Guide')).toBeTruthy();

    fireEvent.click(screen.getByText('Who Could Help?'));
    expect(onOpenHelp).toHaveBeenCalled();

    fireEvent.click(screen.getByText('Finish & View Guide'));
    expect(onFinish).toHaveBeenCalled();
  });

  it("shows controlled session guidance and an anchored hint announcement", () => {
    const onCloseGuide = vi.fn();
    const sceneRef = createRef<HTMLDivElement>();
    render(
      <ThemeProvider theme={theme}>
        <FamilyGameplayView
          renderSkin="chat"
          messages={sampleMessages}
          highlightedMessageIds={[]}
          onToggleMessage={vi.fn()}
          onSceneScroll={vi.fn()}
          sceneRef={sceneRef}
          showNewContent={false}
          onJumpToNewest={vi.fn()}
          infoGuideOpen
          onInfoGuideClose={onCloseGuide}
          hintMessage="Look for pressure or secrecy in the selected item."
        />
      </ThemeProvider>
    );
    expect(screen.getByRole("dialog", { name: /how to play safequest/i })).toBeTruthy();
    expect(screen.getByText("Look for pressure or secrecy in the selected item.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /close guide/i }));
    expect(onCloseGuide).toHaveBeenCalled();
  });
});
