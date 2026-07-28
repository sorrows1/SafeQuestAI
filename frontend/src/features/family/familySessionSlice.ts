import { createEntityAdapter, createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "@/store";
import type {
  CheckpointResponse,
  FamilyMessage,
  FamilyRole,
  FamilyScene,
  FamilySession,
  FamilySessionCapabilities,
  FamilySessionDetail,
  ParticipantRole,
  SceneElement,
  SessionProgress,
  ValidatedFinding,
  FamilySessionEvent,
} from "@/types";

const messagesAdapter = createEntityAdapter<FamilyMessage>({ sortComparer: (a, b) => a.sequence - b.sequence });
const elementsAdapter = createEntityAdapter<SceneElement, string>({ selectId: (element) => element.element_key, sortComparer: (a, b) => a.sequence - b.sequence });
const findingsAdapter = createEntityAdapter<ValidatedFinding, string>({
  selectId: (finding) => finding.insight_key ?? (finding.element_key + ":" + finding.annotation_id),
});

export interface ActiveCheckpoint {
  messageId: number;
  prompt: string;
}

const initialState = {
  detail: null as FamilySessionDetail | null,
  session: null as FamilySession | null,
  scene: null as FamilyScene | null,
  progress: null as SessionProgress | null,
  participantRole: null as FamilyRole | null,
  capabilities: null as FamilySessionCapabilities | null,
  detectiveMode: true,
  highlightedMessageIds: [] as number[],
  selectedElementKey: null as string | null,
  pendingAttempt: false,
  lastAttempt: null as import("@/types").FlagAttempt | null,
  tagAssignments: {} as Record<number, string>,
  activeCheckpoint: null as ActiveCheckpoint | null,
  checkpointResponses: [] as CheckpointResponse[],
  participantTurn: "child" as ParticipantRole,
  // Display-only state may move optimistically; authoritative hydration wins.
  revealedThrough: -1,
  lastEventId: 0,
  streamStatus: "idle" as "idle" | "connecting" | "connected" | "reconnecting" | "offline",
};

function hydrate(state: any, detail: FamilySessionDetail) {
  const current = state.session;
  if (current?.id === detail.session.id && current.state_version && current.state_version > detail.session.state_version) return;
  const changedSession = current?.id !== detail.session.id;
  state.detail = detail;
  state.session = detail.session;
  state.scene = detail.scene;
  state.progress = detail.progress;
  state.participantRole = detail.participant_role;
  state.capabilities = detail.capabilities;
  state.detectiveMode = true;
  messagesAdapter.setAll(state, detail.scene.messages);
  elementsAdapter.setAll(state.elements, detail.scene.elements);
  findingsAdapter.setAll(state.findings, detail.findings);
  state.revealedThrough = detail.session.revealed_up_to;
  const checkpointElement = detail.session.active_checkpoint_element_key
    ? detail.scene.elements.find((element) => element.element_key === detail.session.active_checkpoint_element_key)
    : undefined;
  const checkpointMessage = checkpointElement?.source_message_id
    ? detail.scene.messages.find((message) => message.id === checkpointElement.source_message_id)
    : undefined;
  state.activeCheckpoint = checkpointMessage
    ? { messageId: checkpointMessage.id, prompt: checkpointMessage.checkpoint_prompt ?? "What would you like to talk about?" }
    : null;
  if (changedSession) {
    state.highlightedMessageIds = [];
    state.tagAssignments = {};
    state.checkpointResponses = [];
    state.lastAttempt = null;
    state.pendingAttempt = false;
    state.selectedElementKey = null;
  }
}

const familySessionSlice = createSlice({
  name: "familySession",
  initialState: messagesAdapter.getInitialState({ ...initialState, elements: elementsAdapter.getInitialState(), findings: findingsAdapter.getInitialState() }),
  reducers: {
    familySessionHydrated(state, action: PayloadAction<FamilySessionDetail>) {
      hydrate(state, action.payload);
    },
    familySessionReconciled(state, action: PayloadAction<FamilySessionDetail>) {
      hydrate(state, action.payload);
    },
    // Compatibility actions remain display-only for currently mounted legacy views.
    familySessionStarted(state, action: PayloadAction<FamilySession>) {
      state.session = action.payload;
      state.detectiveMode = true;
        state.revealedThrough = action.payload.revealed_up_to ?? -1;
    },
    familyMessagesLoaded(state, action: PayloadAction<FamilyMessage[] | { sessionId: number; messages: FamilyMessage[] }>) {
      const payload = Array.isArray(action.payload) ? action.payload : action.payload.messages;
      if (!Array.isArray(action.payload) && state.session?.id !== action.payload.sessionId) return;
      messagesAdapter.setAll(state, payload);
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
      const index = state.highlightedMessageIds.indexOf(action.payload);
      if (index >= 0) state.highlightedMessageIds.splice(index, 1);
      else state.highlightedMessageIds.push(action.payload);
    },
    tagAssignmentSet(state, action: PayloadAction<{ messageId: number; tag: string }>) {
      if (action.payload.tag.trim()) state.tagAssignments[action.payload.messageId] = action.payload.tag.trim();
      else delete state.tagAssignments[action.payload.messageId];
    },
    targetSelected(state, action: PayloadAction<string | null>) {
      state.selectedElementKey = action.payload;
    },
    flagAttemptReceived(state, action: PayloadAction<import("@/types").FlagAttempt>) {
      state.lastAttempt = action.payload;
      state.progress = action.payload.progress;
      for (const finding of action.payload.findings) {
        const findingId = finding.insight_key ?? (finding.element_key + ":" + finding.annotation_id);
        const existing = state.findings.entities[findingId];
        if (existing) {
          existing.element_keys = Array.from(new Set([...(existing.element_keys ?? [existing.element_key]), ...(finding.element_keys ?? [finding.element_key])]));
          existing.annotation_ids = Array.from(new Set([...(existing.annotation_ids ?? [existing.annotation_id]), ...(finding.annotation_ids ?? [finding.annotation_id])]));
        } else {
          findingsAdapter.addOne(state.findings, finding);
        }
      }
      state.pendingAttempt = false;
    },
    flagAttemptPending(state, action: PayloadAction<boolean>) {
      state.pendingAttempt = action.payload;
    },
    familySessionStreamStatusSet(state, action: PayloadAction<"idle" | "connecting" | "connected" | "reconnecting" | "offline">) {
      state.streamStatus = action.payload;
    },
    familySessionEventReceived(state, action: PayloadAction<FamilySessionEvent>) {
      const event = action.payload;
      if (event.id <= state.lastEventId) return;
      state.lastEventId = event.id;
      const payload = event.payload;
      if (event.event_type === "participant_presence" || event.event_type === "participant_left") {
        const memberRef = typeof payload.member_ref === "string" ? payload.member_ref : null;
        const participant = memberRef ? state.detail?.participants.find((item) => item.member_ref === memberRef) : undefined;
        if (participant) {
          participant.presence_status = event.event_type === "participant_left" ? "left" : payload.status === "online" ? "online" : "offline";
        }
      }
      if (event.event_type === "state_changed" || event.event_type === "reveal" || event.event_type === "completed") {
        const nextVersion = typeof payload.state_version === "number" ? payload.state_version : null;
        if (state.session && nextVersion !== null && nextVersion >= (state.session.state_version ?? 0)) {
          if (typeof payload.state === "string") state.session.state = payload.state as typeof state.session.state;
          state.session.state_version = nextVersion;
          if (typeof payload.revealed_up_to === "number") state.session.revealed_up_to = payload.revealed_up_to;
          state.revealedThrough = Math.max(state.revealedThrough, state.session.revealed_up_to ?? -1);
        }
      }
    },
  },
});

export const {
  checkpointActivated,
  checkpointCleared,
  checkpointResponseRecorded,
  familyMessagesLoaded,
  familySessionHydrated,
  familySessionReconciled,
  familySessionStarted,
  flagAttemptPending,
  flagAttemptReceived,
  familySessionEventReceived,
  familySessionStreamStatusSet,
  targetSelected,
  highlightedMessageToggled,
  participantTurnSet,
  revealThrough,
  tagAssignmentSet,
} = familySessionSlice.actions;

const messageSelectors = messagesAdapter.getSelectors<RootState>((state) => state.familySession);
const elementSelectors = elementsAdapter.getSelectors<RootState>((state) => state.familySession.elements);
const findingSelectors = findingsAdapter.getSelectors<RootState>((state) => state.familySession.findings);
export const selectFamilyMessages = messageSelectors.selectAll;
export const selectFamilySceneElements = elementSelectors.selectAll;
export const selectFamilyFindings = findingSelectors.selectAll;
export const selectVisibleFamilyMessages = createSelector(
  [selectFamilyMessages, (state: RootState) => state.familySession.revealedThrough],
  (messages, revealedThrough) => messages.filter((message) => message.sequence <= revealedThrough),
);
export const selectFamilySession = (state: RootState) => state.familySession.session;
export const selectFamilySessionDetail = (state: RootState) => state.familySession.detail;
export const selectFamilyCapabilities = (state: RootState) => state.familySession.capabilities;
export const selectFamilyDetectiveMode = (state: RootState) => state.familySession.detectiveMode;
export const selectSelectedElementKey = (state: RootState) => state.familySession.selectedElementKey;
export const selectLastFlagAttempt = (state: RootState) => state.familySession.lastAttempt;
export const selectFlagAttemptPending = (state: RootState) => state.familySession.pendingAttempt;
export const selectHighlightedMessageIds = (state: RootState) => state.familySession.highlightedMessageIds;
export const selectTagAssignments = (state: RootState) => state.familySession.tagAssignments;
export const selectActiveCheckpoint = (state: RootState) => state.familySession.activeCheckpoint;
export const selectParticipantTurn = (state: RootState) => state.familySession.participantTurn;
export const selectFamilySessionStreamStatus = (state: RootState) => state.familySession.streamStatus;
export const selectFamilySessionLastEventId = (state: RootState) => state.familySession.lastEventId;
export default familySessionSlice.reducer;
