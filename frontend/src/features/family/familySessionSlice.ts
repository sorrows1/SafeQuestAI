import { createEntityAdapter, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { CheckpointResponse, FamilyMessage, FamilySession, ParticipantRole } from '@/types';
const messagesAdapter = createEntityAdapter<FamilyMessage>({ sortComparer: (a, b) => a.sequence - b.sequence });
export interface ActiveCheckpoint {
  messageId: number;
  prompt: string;
}
const initialState = messagesAdapter.getInitialState({
  session: null as FamilySession | null,
  detectiveMode: false,
  highlightedMessageIds: [] as number[],
  tagAssignments: {} as Record<number, string>,
  activeCheckpoint: null as ActiveCheckpoint | null,
  checkpointResponses: [] as CheckpointResponse[],
  participantTurn: 'child' as ParticipantRole,
  revealedThrough: -1,
});
const familySessionSlice = createSlice({
  name: 'familySession',
  initialState,
  reducers: {
    familySessionStarted(state, action: PayloadAction<FamilySession>) {
      messagesAdapter.removeAll(state);
      state.session = action.payload;
      state.detectiveMode = action.payload.detective_mode;
      state.highlightedMessageIds = [];
      state.tagAssignments = {};
      state.activeCheckpoint = null;
      state.checkpointResponses = [];
      state.participantTurn = 'child';
      state.revealedThrough = -1;
    },
    familyMessagesLoaded(
      state,
      action: PayloadAction<FamilyMessage[] | { sessionId: number; messages: FamilyMessage[] }>
    ) {
      if (Array.isArray(action.payload)) {
        messagesAdapter.setAll(state, action.payload);
      } else {
        if (state.session?.id !== action.payload.sessionId) return;
        messagesAdapter.setAll(state, action.payload.messages);
      }
    },
    revealThrough(state, action: PayloadAction<number>) {
      state.revealedThrough = Math.max(state.revealedThrough, action.payload);
    },
    checkpointActivated(state, action: PayloadAction<ActiveCheckpoint>) {
      state.activeCheckpoint = action.payload;
    },
    checkpointCleared(state) {
      state.activeCheckpoint = null;
      state.highlightedMessageIds = [];
      state.tagAssignments = {};
    },
    checkpointResponseRecorded(state, action: PayloadAction<CheckpointResponse>) {
      state.checkpointResponses.push(action.payload);
    },
    participantTurnSet(state, action: PayloadAction<ParticipantRole>) {
      state.participantTurn = action.payload;
    },
    highlightedMessageToggled(state, action: PayloadAction<number>) {
      if (!state.detectiveMode) return;
      const index = state.highlightedMessageIds.indexOf(action.payload);
      if (index >= 0) state.highlightedMessageIds.splice(index, 1);
      else state.highlightedMessageIds.push(action.payload);
    },
    tagAssignmentSet(state, action: PayloadAction<{ messageId: number; tag: string }>) {
      if (!state.detectiveMode) return;
      if (action.payload.tag.trim()) state.tagAssignments[action.payload.messageId] = action.payload.tag.trim();
      else delete state.tagAssignments[action.payload.messageId];
    },
  },
});
export const {
  checkpointActivated,
  checkpointCleared,
  checkpointResponseRecorded,
  familyMessagesLoaded,
  familySessionStarted,
  highlightedMessageToggled,
  participantTurnSet,
  revealThrough,
  tagAssignmentSet,
} = familySessionSlice.actions;
const selectors = messagesAdapter.getSelectors<RootState>((state) => state.familySession);
export const selectFamilyMessages = selectors.selectAll;
export const selectVisibleFamilyMessages = createSelector(
  [selectFamilyMessages, (state: RootState) => state.familySession.revealedThrough],
  (messages, revealedThrough) => messages.filter((message) => message.sequence <= revealedThrough)
);
export const selectFamilySession = (state: RootState) => state.familySession.session;
export const selectFamilyDetectiveMode = (state: RootState) => state.familySession.detectiveMode;
export const selectHighlightedMessageIds = (state: RootState) => state.familySession.highlightedMessageIds;
export const selectTagAssignments = (state: RootState) => state.familySession.tagAssignments;
export const selectActiveCheckpoint = (state: RootState) => state.familySession.activeCheckpoint;
export const selectParticipantTurn = (state: RootState) => state.familySession.participantTurn;
export default familySessionSlice.reducer;
