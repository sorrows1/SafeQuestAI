import { createEntityAdapter, createSelector, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { RootState } from '@/store';
import type { SimulationRun } from '@/types';

export interface GenerationMessage {
  id: number;
  sequence: number;
  sender: string;
  content: string;
  pace: string;
  metadata?: Record<string, unknown>;
}

export type ViewerRunStatus = 'idle' | 'running' | 'paused' | 'awaiting_admin' | 'ready_for_review' | 'approved' | 'rejected' | 'limit_reached' | 'completed' | 'failed';
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

function normalizeStatus(status: string): ViewerRunStatus {
  if (['paused', 'awaiting_admin', 'ready_for_review', 'approved', 'rejected', 'limit_reached'].includes(status)) return status as ViewerRunStatus;
  if (status === 'failed') return 'failed';
  if (['pending', 'approved', 'rejected', 'completed'].includes(status)) return 'completed';
  return 'running';
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
    typingStarted(state) { state.typing = true; },
    typingStopped(state) { state.typing = false; },
    runStatusChanged(state, action: PayloadAction<string>) {
      state.runStatus = normalizeStatus(action.payload);
      if (state.runStatus !== 'running') state.typing = false;
    },
    connectionStatusChanged(state, action: PayloadAction<ConnectionStatus>) { state.connectionStatus = action.payload; },
    messagesLoaded(state, action: PayloadAction<GenerationMessage[]>) {
      messagesAdapter.setAll(state, action.payload);
      state.typing = false;
    },
    runHydrated(state, action: PayloadAction<SimulationRun>) {
      state.runId = action.payload.id;
      state.runStatus = normalizeStatus(action.payload.status);
      state.activeBranch = String(action.payload.progress?.active_branch ?? 'main');
      messagesAdapter.setAll(state, (action.payload.messages ?? []).map((message) => ({ id: message.id, sequence: message.sequence, sender: message.sender, content: message.content, pace: String(message.metadata.pace ?? 'normal'), metadata: message.metadata })));
      state.typing = action.payload.status === 'running';
    },
    eventCursorUpdated(state, action: PayloadAction<number>) { state.lastEventId = Math.max(state.lastEventId, action.payload); },
  },
});

export const { connectionStatusChanged, eventCursorUpdated, messageReceived, messagesLoaded, runHydrated, runSelected, runStarted, runStatusChanged, typingStarted, typingStopped } = simulationViewerSlice.actions;

const messageSelectors = messagesAdapter.getSelectors<RootState>((state) => state.simulationViewer);
export const selectSimulationMessages = messageSelectors.selectAll;
export const selectSimulationRunId = (state: RootState) => state.simulationViewer.runId;
export const selectSimulationRunStatus = (state: RootState) => state.simulationViewer.runStatus;
export const selectSimulationTyping = (state: RootState) => state.simulationViewer.typing;
export const selectSimulationConnectionStatus = (state: RootState) => state.simulationViewer.connectionStatus;
export const selectSimulationLastEventId = (state: RootState) => state.simulationViewer.lastEventId;
export const selectSimulationActiveBranch = (state: RootState) => state.simulationViewer.activeBranch;
export const selectSimulationHasMessages = createSelector(selectSimulationMessages, (messages) => messages.length > 0);

export default simulationViewerSlice.reducer;
