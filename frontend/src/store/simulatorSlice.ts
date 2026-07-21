import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import type { SimulatorChatResponse, HistoryEntry } from '@/types';

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  content: string;
  timestamp: string;
  metadata?: SimulatorChatResponse;
}

interface SimulatorState {
  sessionId: number | null;
  scenarioId: string | null;
  difficulty: string;
  messages: Message[];
  currentStage: string;
  currentObjective: string;
  completedObjectives: string[];
  trust: number;
  suspicion: number;
  flags: string[];
  loading: boolean;
  lastPrompt: string | null;
  lastResponse: SimulatorChatResponse | null;
  debugMode: boolean;
}

const initialState: SimulatorState = {
  sessionId: null,
  scenarioId: null,
  difficulty: 'Medium',
  messages: [],
  currentStage: '',
  currentObjective: '',
  completedObjectives: [],
  trust: 0,
  suspicion: 0,
  flags: [],
  loading: false,
  lastPrompt: null,
  lastResponse: null,
  debugMode: false,
};

const simulatorSlice = createSlice({
  name: 'simulator',
  initialState,
  reducers: {
    startSession: (state, action: PayloadAction<{
      sessionId: number; scenarioId: string; difficulty: string; initialMessage: string;
    }>) => {
      const { sessionId, scenarioId, difficulty, initialMessage } = action.payload;
      state.sessionId = sessionId;
      state.scenarioId = scenarioId;
      state.difficulty = difficulty;
      state.messages = [{
        id: crypto.randomUUID(),
        sender: 'assistant',
        content: initialMessage,
        timestamp: new Date().toISOString(),
      }];
      state.trust = 0; state.suspicion = 0;
      state.flags = []; state.completedObjectives = [];
      state.currentStage = ''; state.currentObjective = '';
    },
    addUserMessage: (state, action: PayloadAction<string>) => {
      state.messages.push({
        id: crypto.randomUUID(),
        sender: 'user',
        content: action.payload,
        timestamp: new Date().toISOString(),
      });
      state.loading = true;
    },
    addAssistantMessage: (state, action: PayloadAction<SimulatorChatResponse>) => {
      const resp = action.payload;
      state.messages.push({
        id: crypto.randomUUID(),
        sender: 'assistant',
        content: resp.reply,
        timestamp: new Date().toISOString(),
        metadata: resp,
      });
      state.trust = resp.trust;
      state.suspicion = resp.suspicion;
      state.currentStage = resp.current_stage;
      state.currentObjective = resp.current_objective;
      state.flags = resp.flags;
      if (resp.objective_completed && resp.current_objective) {
        if (!state.completedObjectives.includes(resp.current_objective)) {
          state.completedObjectives.push(resp.current_objective);
        }
      }
      state.lastResponse = resp;
      state.lastPrompt = resp.built_prompt ?? null;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setDebugMode: (state, action: PayloadAction<boolean>) => {
      state.debugMode = action.payload;
    },
    resetSimulator: () => initialState,
  },
});

export const {
  startSession, addUserMessage, addAssistantMessage,
  setLoading, setDebugMode, resetSimulator,
} = simulatorSlice.actions;
export default simulatorSlice.reducer;
