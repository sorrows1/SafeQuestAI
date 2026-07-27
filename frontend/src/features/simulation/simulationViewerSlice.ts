import { createEntityAdapter, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { SimulationRun } from '@/types';

export interface GenerationMessage {
  id: number;
  sequence: number;
  sender: string;
  content: string;
  pace: string;
  tactic_tags: string[];
  metadata?: Record<string, unknown>;
}

export type ViewerRunStatus =
  'idle' | 'running' | 'paused' | 'awaiting_admin' | 'ready_for_review' | 'approved' | 'rejected' | 'limit_reached' | 'completed' | 'failed' | 'failed_retryable' | 'failed_terminal';
export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

const messagesAdapter = createEntityAdapter<GenerationMessage>({
  sortComparer: (a, b) => a.sequence - b.sequence,
});

const initialState = messagesAdapter.getInitialState({
  runId: null as number | null,
  runStatus: 'idle' as ViewerRunStatus,
  connectionStatus: 'disconnected' as ConnectionStatus,
  lastEventId: 0,
  activeBranch: 'main',
  typing: false,
});

export function normalizeSimulationStatus(status: string): ViewerRunStatus {
  switch (status) {
    case 'running':
    case 'paused':
    case 'awaiting_admin':
    case 'ready_for_review':
    case 'approved':
    case 'rejected':
    case 'limit_reached':
    case 'failed':
    case 'failed_retryable':
    case 'failed_terminal':
    case 'completed':
      return status;
    case 'queued':
    case 'pending':
      return 'idle';
    default:
      return 'idle';
  }
}

const simulationViewerSlice = createSlice({
  name: 'simulationViewer',
  initialState,
  reducers: {
    runStarted(state, action: PayloadAction<number>) {
      messagesAdapter.removeAll(state);
      state.runId = action.payload;
      state.runStatus = 'running';
      state.connectionStatus = 'connecting';
      state.typing = false;
    },
    runSelected(state, action: PayloadAction<number>) {
      messagesAdapter.removeAll(state);
      state.runId = action.payload;
      state.runStatus = 'completed';
      state.connectionStatus = 'disconnected';
      state.typing = false;
    },
    messageReceived(state, action: PayloadAction<GenerationMessage>) {
      messagesAdapter.upsertOne(state, action.payload);
      state.typing = false;
    },
    tacticTagsUpdated(state, action: PayloadAction<{ messageId: number; tactic_tags: string[] }>) {
      const existing = state.entities[action.payload.messageId];
      if (existing) {
        existing.tactic_tags = action.payload.tactic_tags;
      }
    },
    typingStarted(state) {
      state.typing = true;
    },
    typingStopped(state) {
      state.typing = false;
    },
    runStatusChanged(state, action: PayloadAction<string>) {
      state.runStatus = normalizeSimulationStatus(action.payload);
      if (state.runStatus !== 'running') state.typing = false;
    },
    connectionStatusChanged(state, action: PayloadAction<ConnectionStatus>) {
      state.connectionStatus = action.payload;
    },
    messagesLoaded(state, action: PayloadAction<GenerationMessage[]>) {
      messagesAdapter.setAll(state, action.payload);
      state.typing = false;
    },
    runHydrated(state, action: PayloadAction<SimulationRun>) {
      state.runId = action.payload.id;
      state.runStatus = normalizeSimulationStatus(action.payload.status);
      state.activeBranch = String(action.payload.progress?.active_branch ?? 'main');
      messagesAdapter.upsertMany(
        state,
        (action.payload.messages ?? []).map((message) => ({
          id: message.id,
          sequence: message.sequence,
          sender: message.sender,
          content: message.content,
          pace: String(message.metadata?.pace ?? 'normal'),
          tactic_tags: (message.metadata?.tactic_tags as string[]) ?? [],
          metadata: message.metadata,
        }))
      );
      state.typing = action.payload.status === 'running';
    },
    eventCursorUpdated(state, action: PayloadAction<number>) {
      state.lastEventId = Math.max(state.lastEventId, action.payload);
    },
  },
});

export const {
  connectionStatusChanged,
  eventCursorUpdated,
  messageReceived,
  messagesLoaded,
  runHydrated,
  runSelected,
  runStarted,
  runStatusChanged,
  tacticTagsUpdated,
  typingStarted,
  typingStopped,
} = simulationViewerSlice.actions;

const messageSelectors = messagesAdapter.getSelectors<RootState>((state) => state.simulationViewer);
export const selectSimulationMessages = messageSelectors.selectAll;
export const selectSimulationRunId = (state: RootState) => state.simulationViewer.runId;
export const selectSimulationRunStatus = (state: RootState) => state.simulationViewer.runStatus;
export const selectSimulationTyping = (state: RootState) => state.simulationViewer.typing;
export const selectSimulationConnectionStatus = (state: RootState) => state.simulationViewer.connectionStatus;
export const selectSimulationLastEventId = (state: RootState) => state.simulationViewer.lastEventId;
export const selectSimulationActiveBranch = (state: RootState) => state.simulationViewer.activeBranch;
export const selectSimulationHasMessages = createSelector(selectSimulationMessages, (messages) => messages.length > 0);
/** Derived: all unique tactic tags across active messages, updated live from SSE events. */
export const selectLiveTacticTags = createSelector(
  selectSimulationMessages,
  (messages) => [...new Set(messages.flatMap((m) => m.tactic_tags ?? []))].sort(),
);
/** Derived: count of messages that carry at least one tactic tag (= red flag count). */
export const selectLiveRedFlagCount = createSelector(
  selectSimulationMessages,
  (messages) => messages.filter((m) => (m.tactic_tags ?? []).length > 0).length,
);

export default simulationViewerSlice.reducer;
