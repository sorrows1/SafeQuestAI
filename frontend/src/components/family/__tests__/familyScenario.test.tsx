import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it, vi } from 'vitest';
import { darkTheme } from '@/theme';
import { SkinRouter } from '@/components/scenario-render/SkinRouter';
import { FlagInspectorRail } from '../FlagInspectorRail';
import { ConversationGuideView } from '../ConversationGuideView';
import { CheckpointPause } from '../CheckpointPause';
import type { FamilyMessage, FamilyScene, FlagAttempt, RenderSkin, ValidatedFinding } from '@/types';

vi.mock('@/store/api', () => ({
  useGetConversationGuideQuery: () => ({
    data: {
      id: 1,
      family_session_id: 1,
      scenario_summary: 'A calm recap.',
      child_reasoning_excerpt: { one: 'I would tell someone.' },
      discussion_prompts: ['Who feels safe to tell?'],
      completed_together: true,
      generated_at: '',
    },
    isLoading: false,
    isError: false,
  }),
}));
const messages: FamilyMessage[] = [
  {
    id: 11,
    sequence: 1,
    speaker_label: 'Taylor',
    content: 'Please keep this between us.',
    pace: 'normal',
    is_checkpoint: false,
    checkpoint_prompt: null,
  },
];
function renderWithTheme(node: React.ReactElement) {
  return render(<ThemeProvider theme={darkTheme}>{node}</ThemeProvider>);
}
const sceneFor = (skin: RenderSkin): FamilyScene => ({ scene_schema_version: 1, skin_version: "1.0", render_skin: skin, elements: [{ element_key: "message-11", element_type: "message", parent_element_key: null, source_message_id: 11, sequence: 1, content: messages[0].content, presentation: {}, selectable: true, accessible_label: "Message from Taylor", semantic_role: "article" }], messages });
function SelectionHarness({ skin }: { skin: RenderSkin }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <>
      <SkinRouter
        renderSkin={skin}
        scene={sceneFor(skin)}
        selection={{ selectedElementKeys: selected }}
        onSelect={(key) => setSelected((current) => (current.includes(key) ? [] : [key]))}
      />
      <output>{selected.join(',')}</output>
    </>
  );
}
describe('family scenario UI', () => {
  it.each<RenderSkin>(['chat', 'email', 'social_feed', 'game_chat', 'forum', 'marketplace'])('uses identical selection for the %s skin', async (skin) => {
    renderWithTheme(<SelectionHarness skin={skin} />);
    fireEvent.keyDown(screen.getByRole('button', { name: /message from taylor/i }), { key: 'Enter' });
    expect(screen.getByText('message-11')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('button', { name: /message from taylor/i }), { key: ' ' });
    expect(screen.getByText('', { selector: 'output' })).toBeTruthy();
  });
  it('keeps score-like language out of the conversation guide', () => {
    renderWithTheme(<ConversationGuideView sessionId={1} />);
    expect(screen.queryByText(/score|grade|percentage|incorrect|mistake/i)).toBeNull();
    expect(screen.getByRole('region', { name: /conversation guide/i })).toBeTruthy();
  });
  it('uses the same checkpoint component for parent-present and companion sessions', async () => {
    const onSubmit = vi.fn();
    const { rerender } = renderWithTheme(
      <CheckpointPause
        prompt="What would you do?"
        selectedCount={0}
        companionMode={false}
        onSubmit={onSubmit}
        onTagChange={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText(/what do you notice/i), { target: { value: 'I would tell someone.' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(onSubmit).toHaveBeenCalledWith('I would tell someone.', '');
    rerender(
      <ThemeProvider theme={darkTheme}>
        <CheckpointPause
          prompt="What would you do?"
          selectedCount={0}
          companionMode
          onSubmit={onSubmit}
          onTagChange={vi.fn()}
        />
      </ThemeProvider>
    );
    expect(screen.getByRole('region', { name: /discussion pause/i })).toBeTruthy();
  });

  it('renders FlagInspectorRail reasoning composer and handles attempt submission', async () => {
    const onSubmitAttempt = vi.fn();
    renderWithTheme(
      <FlagInspectorRail
        messages={messages}
        highlightedMessageIds={[11]}
        tagAssignments={{}}
        selectedMessageId={11}
        selectedElementKey="msg-11"
        onSelectMessage={vi.fn()}
        onSubmitAttempt={onSubmitAttempt}
      />
    );

    expect(screen.getByText('Flag Inspector')).toBeTruthy();
    expect(screen.getByText('What is your safety evaluation of this item?')).toBeTruthy();

    const reasoningInput = screen.getByLabelText(/Reasoning explanation input/i);
    fireEvent.change(reasoningInput, { target: { value: 'This message pressures me to keep secrets.' } });

    const submitBtn = screen.getByRole('button', { name: /Check with Companion/i });
    fireEvent.click(submitBtn);

    expect(onSubmitAttempt).toHaveBeenCalledWith({
      element_key: 'msg-11',
      claim: 'red_flag',
      reasoning: 'This message pressures me to keep secrets.',
    });
  });

  it('renders neutral encouraging feedback for non-flag attempts without red error styling', () => {
    const neutralAttempt: FlagAttempt = {
      id: 1,
      element_key: 'msg-11',
      claim: 'not_red_flag',
      validation_result: 'not_a_flag',
      feedback: {
        response_text: "Let's look closer at this message together. It might seem normal, but consider secret keeping.",
      },
      disclosure_triggered: false,
      created_at: new Date().toISOString(),
      findings: [],
      progress: {
        reviewed_element_count: 1,
        validated_finding_count: 0,
        eligible_target_count: 3,
        required_finding_count: 2,
        checkpoint_progress: 0,
        content_progress: 33,
        completion_ready: false,
      },
    };

    renderWithTheme(
      <FlagInspectorRail
        messages={messages}
        highlightedMessageIds={[]}
        tagAssignments={{}}
        selectedMessageId={null}
        onSelectMessage={vi.fn()}
        lastAttempt={neutralAttempt}
      />
    );

    expect(screen.getByText("Let's Look Closer Together")).toBeTruthy();
    expect(screen.getByText(/consider secret keeping/i)).toBeTruthy();
    expect(screen.queryByText(/error|wrong|mistake|failed/i)).toBeNull();
  });

  it('renders validated findings list with interactive tactic chips', () => {
    const validatedFindings: ValidatedFinding[] = [
      {
        element_key: 'msg-11',
        annotation_id: 1,
        tactic_tag: 'secrecy_pressure',
        explanation: 'Asking to keep secrets isolates the child.',
        discovered_at: new Date().toISOString(),
        visibility: 'shared',
      },
    ];
    const onSelectMessage = vi.fn();

    renderWithTheme(
      <FlagInspectorRail
        messages={messages}
        highlightedMessageIds={[]}
        tagAssignments={{}}
        selectedMessageId={null}
        onSelectMessage={onSelectMessage}
        validatedFindings={validatedFindings}
      />
    );

    expect(screen.getByText('Validated Safety Insights (1)')).toBeTruthy();
    expect(screen.getByText('secrecy pressure')).toBeTruthy();
    expect(screen.getByText('Asking to keep secrets isolates the child.')).toBeTruthy();

    const card = screen.getByRole('button', { name: /View validated finding secrecy_pressure/i });
    fireEvent.click(card);
    expect(onSelectMessage).toHaveBeenCalledWith(11);
  });
});

