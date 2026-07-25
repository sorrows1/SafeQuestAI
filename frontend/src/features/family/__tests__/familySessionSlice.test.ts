import { describe, expect, it } from 'vitest';
import familySessionReducer, {
  familyMessagesLoaded,
  familySessionStarted,
  revealThrough,
  selectFamilyMessages,
  selectVisibleFamilyMessages,
} from '../familySessionSlice';

describe('familySessionSlice', () => {
  it('handles message loading with object or array payloads and initial revealedThrough = -1', () => {
    let state = familySessionReducer(
      undefined,
      familySessionStarted({
        id: 101,
        transcript_id: 2,
        parent_user_id: null,
        companion_mode: true,
        detective_mode: false,
        started_at: '2026-07-25T00:00:00Z',
        completed_at: null,
      })
    );

    expect(state.revealedThrough).toBe(-1);

    // Test with object payload matching session ID
    state = familySessionReducer(
      state,
      familyMessagesLoaded({
        sessionId: 101,
        messages: [
          { id: 201, sequence: 0, speaker_label: 'Riley', content: 'Draft post', pace: 'normal', is_checkpoint: true, checkpoint_prompt: 'Pause?' },
          { id: 202, sequence: 1, speaker_label: 'Options', content: 'Safer choices', pace: 'normal', is_checkpoint: false, checkpoint_prompt: null },
        ],
      })
    );

    let rootState = { familySession: state } as any;
    expect(selectFamilyMessages(rootState)).toHaveLength(2);
    // Before any revealThrough, visibleMessages should be empty
    expect(selectVisibleFamilyMessages(rootState)).toHaveLength(0);

    // Reveal sequence 0
    state = familySessionReducer(state, revealThrough(0));
    rootState = { familySession: state } as any;
    expect(selectVisibleFamilyMessages(rootState)).toHaveLength(1);
    expect(selectVisibleFamilyMessages(rootState)[0].sequence).toBe(0);

    // Test with direct array payload
    state = familySessionReducer(
      state,
      familyMessagesLoaded([
        { id: 301, sequence: 0, speaker_label: 'A', content: 'One', pace: 'normal', is_checkpoint: false, checkpoint_prompt: null },
      ])
    );
    rootState = { familySession: state } as any;
    expect(selectFamilyMessages(rootState)).toHaveLength(1);
  });
});
