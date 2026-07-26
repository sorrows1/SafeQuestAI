import { useCallback, useEffect, useMemo, useRef, useState, type UIEvent } from "react";
import { Alert, Box, Button, Chip, Container, Grid, Skeleton, Typography } from "@mui/material";
import { useParams } from "react-router-dom";
import { CheckpointPause } from "@/components/family/CheckpointPause";
import { ConversationGuideView } from "@/components/family/ConversationGuideView";
import { HelpSeekingBeat } from "@/components/family/HelpSeekingBeat";
import { FamilyGameplayView } from "./FamilyGameplayView";
import {
  checkpointResponseRecorded,
  familySessionHydrated,
  familySessionReconciled,
  flagAttemptPending,
  flagAttemptReceived,
  targetSelected,
  highlightedMessageToggled,
  selectActiveCheckpoint,
  selectFamilyCapabilities,
  selectFamilyFindings,
  selectFamilyMessages,
  selectFamilySession,
  selectFlagAttemptPending,
  selectHighlightedMessageIds,
  selectLastFlagAttempt,
  selectTagAssignments,
  selectVisibleFamilyMessages,
  tagAssignmentSet,
} from "@/features/family/familySessionSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  useCommandFamilySessionMutation,
  useExplainWithCompanionMutation,
  useRequestCompanionHintMutation,
  useSubmitFlagAttemptMutation,
  useGetFamilySessionQuery,
  useSubmitCheckpointResponseMutation,
  useSubmitCompanionCheckpointMutation,
} from "@/store/api";
import type { FamilySessionCommandType, ParticipantRole } from "@/types";
import type { ScenePanelNavigation } from "@/components/scenario-render/types";
import type { ClaimType } from "@/components/family/FlagInspectorRail";

const commandId = () => globalThis.crypto?.randomUUID?.() ?? `command-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export function FamilyScenarioPlayer() {
  const { sessionId: sessionIdParam } = useParams();
  const sessionId = Number(sessionIdParam);
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const { data: detail, isLoading, isError, refetch } = useGetFamilySessionQuery(sessionId, { skip: !sessionId });
  const [command, { isLoading: commandLoading }] = useCommandFamilySessionMutation();
  const [submitCheckpoint, { isLoading: submitting }] = useSubmitCheckpointResponseMutation();
  const [submitCompanionCheckpoint, { isLoading: companionSubmitting }] = useSubmitCompanionCheckpointMutation();
  const [explainWithCompanion, { isLoading: explaining }] = useExplainWithCompanionMutation();
  const [submitFlagAttempt, { isLoading: attemptSubmitting }] = useSubmitFlagAttemptMutation();
  const [requestCompanionHint] = useRequestCompanionHintMutation();
  const session = useAppSelector(selectFamilySession);
  const capabilities = useAppSelector(selectFamilyCapabilities);
  const allMessages = useAppSelector(selectFamilyMessages);
  const visibleMessages = useAppSelector(selectVisibleFamilyMessages);
  const highlightedMessageIds = useAppSelector(selectHighlightedMessageIds);
  const tagAssignments = useAppSelector(selectTagAssignments);
  const activeCheckpoint = useAppSelector(selectActiveCheckpoint);
  const lastAttempt = useAppSelector(selectLastFlagAttempt);
  const pendingAttempt = useAppSelector(selectFlagAttemptPending);
  const validatedFindings = useAppSelector(selectFamilyFindings);
  const [actionError, setActionError] = useState<string | null>(null);
  const [hintNotice, setHintNotice] = useState<string | null>(null);
  const [hintLevel, setHintLevel] = useState(0);
  const [companionNotice, setCompanionNotice] = useState<{ text: string; disclosure: boolean; resources: Array<{ label: string; href: string }> } | null>(null);
  const [showNewContent, setShowNewContent] = useState(false);
  const [selectedElementKey, setSelectedElementKey] = useState<string | null>(null);
  const [selectedElementKeys, setSelectedElementKeys] = useState<string[]>([]);
  // This UI-only history intentionally never enters the session state machine.
  const [panelHistory, setPanelHistory] = useState<string[]>([]);
  const sceneRef = useRef<HTMLDivElement>(null);
  const atBottom = useRef(true);
  const priorVisibleCount = useRef(0);

  useEffect(() => {
    if (detail) dispatch(familySessionHydrated(detail));
  }, [detail, dispatch]);

  const sendCommand = useCallback(async (kind: FamilySessionCommandType) => {
    if (!session) return;
    setActionError(null);
    try {
      const next = await command({
        sessionId: session.id,
        command: kind,
        expected_state_version: session.state_version ?? 1,
        client_command_id: commandId(),
      }).unwrap();
      dispatch(familySessionReconciled(next));
    } catch {
      setActionError("This activity changed or could not be saved. Refreshing its current state lets you retry.");
      void refetch();
    }
  }, [command, dispatch, refetch, session]);

  useEffect(() => {
    if (!session || commandLoading || activeCheckpoint) return;
    if (capabilities?.can_reveal_next) {
      const timer = window.setTimeout(() => void sendCommand("reveal_next"), 520);
      return () => window.clearTimeout(timer);
    }
    if (capabilities?.can_enter_completion_review) {
      const timer = window.setTimeout(() => void sendCommand("enter_completion_review"), 0);
      return () => window.clearTimeout(timer);
    }
  }, [activeCheckpoint, capabilities, commandLoading, sendCommand, session]);

  useEffect(() => {
    if (visibleMessages.length <= priorVisibleCount.current) {
      priorVisibleCount.current = visibleMessages.length;
      return;
    }
    priorVisibleCount.current = visibleMessages.length;
    if (atBottom.current) requestAnimationFrame(() => sceneRef.current?.scrollTo({ top: sceneRef.current.scrollHeight, behavior: "smooth" }));
    else setShowNewContent(true);
  }, [visibleMessages.length]);

  const onSceneScroll = (event: UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    atBottom.current = node.scrollHeight - node.scrollTop - node.clientHeight < 32;
    if (atBottom.current) setShowNewContent(false);
  };
  const jumpToNewest = () => {
    sceneRef.current?.scrollTo({ top: sceneRef.current.scrollHeight, behavior: "smooth" });
    setShowNewContent(false);
  };

  const submit = async (responseText: string, tacticTagGuess: string) => {
    if (!session || !activeCheckpoint) return;
    setActionError(null);
    try {
      if (session.companion_mode) {
        const result = await submitCompanionCheckpoint({
          sessionId: session.id,
          checkpoint_message_id: activeCheckpoint.messageId,
          child_response_text: responseText,
          flagged_message_ids: highlightedMessageIds,
          tactic_tag_guess: tacticTagGuess || null,
        }).unwrap();
        dispatch(checkpointResponseRecorded(result.child_response));
        dispatch(checkpointResponseRecorded(result.checkpoint_response));
        setCompanionNotice({ text: result.response_text, disclosure: result.disclosure_triggered, resources: result.support_resources });
      } else {
        const response = await submitCheckpoint({
          sessionId: session.id,
          checkpoint_message_id: activeCheckpoint.messageId,
          responder_role: responderRole,
          response_text: responseText,
          flagged_message_ids: highlightedMessageIds,
          tactic_tag_guess: tacticTagGuess || null,
        }).unwrap();
        dispatch(checkpointResponseRecorded(response));
      }
      await sendCommand("continue_checkpoint");
    } catch {
      setActionError("Your reflection could not be saved. It is still here so you can retry.");
      void refetch();
    }
  };

  const handleSubmitAttempt = async ({ element_key, claim, reasoning }: { element_key: string; claim: ClaimType; reasoning: string }) => {
    if (!session) return;
    setActionError(null);
    dispatch(flagAttemptPending(true));
    try {
      const result = await submitFlagAttempt({
        sessionId: session.id,
        element_key,
        reasoning,
        claim,
        client_command_id: commandId(),
      }).unwrap();
      dispatch(flagAttemptReceived(result));
      void refetch();
    } catch {
      dispatch(flagAttemptPending(false));
      setActionError("Your evaluation could not be checked right now. You can retry your submission.");
    }
  };

  const handleAskCompanion = async (text: string) => {
    if (!session || !text.trim()) return;
    setActionError(null);
    try {
      if (selectedElementKey && capabilities?.can_submit_flag_attempt) {
        await handleSubmitAttempt({ element_key: selectedElementKey, claim: "unsure", reasoning: text.trim() });
      } else {
        const result = await explainWithCompanion({ sessionId: session.id, message: text.trim() }).unwrap();
        setCompanionNotice({ text: result.response_text, disclosure: result.disclosure_triggered, resources: result.support_resources });
      }
      void refetch();
    } catch {
      dispatch(flagAttemptPending(false));
      setActionError("The guide could not reply just now. You can retry your message.");
    }
  };

  const handleHint = async () => {
    if (!session || !selectedElementKey || !capabilities?.can_request_hint) {
      setHintNotice("Select an item first, then ask for a hint.");
      return;
    }
    try {
      const result = await requestCompanionHint({ sessionId: session.id, element_key: selectedElementKey, client_command_id: commandId() }).unwrap();
      setHintNotice(result.hint);
      if (typeof result.hint_level === 'number') {
        setHintLevel(result.hint_level);
      } else {
        setHintLevel((prev) => prev + 1);
      }
    } catch {
      setHintNotice("A hint is unavailable right now. Keep looking closely at the item.");
    }
  };

  const handleReset = () => {
    void sendCommand("reset");
  };

  const updateTag = (tag: string) => highlightedMessageIds.forEach((messageId) => dispatch(tagAssignmentSet({ messageId, tag })));
  const selectedTag = useMemo(() => Object.values(tagAssignments).find(Boolean) ?? "", [tagAssignments]);
  const responderRole: ParticipantRole = session?.companion_mode ? "child" : currentUser?.id === session?.parent_user_id ? "parent" : "child";
  const panelNavigation: ScenePanelNavigation = {
    activeElementKey: panelHistory[panelHistory.length - 1] ?? null,
    canGoBack: panelHistory.length > 1,
    openPanel: (elementKey) => setPanelHistory((current) => current[current.length - 1] === elementKey ? current : [...current, elementKey]),
    closePanel: () => setPanelHistory([]),
    goBack: () => setPanelHistory((current) => current.slice(0, -1)),
  };

  if (!sessionId) return <Alert severity="error">This scenario link is incomplete.</Alert>;
  if (isLoading || !session || session.id !== sessionId) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Skeleton variant="rounded" height={80} sx={{ mb: 3, borderRadius: 3 }} />
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: '7fr 5fr' }, gap: 3 }}>
          <Skeleton variant="rounded" height={420} sx={{ borderRadius: 3 }} />
          <Skeleton variant="rounded" height={420} sx={{ borderRadius: 3 }} />
        </Box>
      </Container>
    );
  }
  if (isError) return <Alert severity="error" sx={{ m: 3 }} action={<Button color="inherit" size="small" onClick={() => void refetch()}>Retry</Button>}>This family session could not be loaded. Please retry.</Alert>;
  if (session.state === "completed") return <ConversationGuideView sessionId={session.id} />;
  if (session.state === "help_and_resources") return <HelpSeekingBeat category="oversharing" onContinue={() => void sendCommand("complete")} />;
  if (session.state === "paused_for_support") {
    return (
      <Container maxWidth="md" sx={{ py: 6 }}>
        <Alert severity="warning" sx={{ p: 3, borderRadius: 3 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>Activity Paused for Support</Typography>
          <Typography variant="body2" sx={{ mt: 1 }}>
            This activity is paused to give you and your family space and privacy. Take all the time and support you need; it will not resume automatically without your decision.
          </Typography>
        </Alert>
      </Container>
    );
  }

  const checkpoint = activeCheckpoint ? <CheckpointPause prompt={activeCheckpoint.prompt} selectedCount={highlightedMessageIds.length} companionMode={session.companion_mode} submitting={submitting || companionSubmitting || commandLoading || attemptSubmitting} onSubmit={submit} onTagChange={updateTag} /> : null;

  return (
    <FamilyGameplayView
      renderSkin={detail?.scene.render_skin ?? "chat"}
      scene={detail?.scene ?? { scene_schema_version: 1, skin_version: "1.0", render_skin: "chat", elements: [], messages: [] }}
      messages={visibleMessages}
      highlightedMessageIds={highlightedMessageIds}
      selectedElementKeys={selectedElementKeys}
      panelNavigation={panelNavigation}
      tagAssignments={tagAssignments}
      onSelectElement={(key) => {
        const element = detail?.scene.elements.find((item) => item.element_key === key);
        if (!element?.selectable) return;
        setSelectedElementKeys((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
        setSelectedElementKey(key);
        dispatch(targetSelected(key));
        if (element.source_message_id) dispatch(highlightedMessageToggled(element.source_message_id));
      }}
      onToggleMessage={(messageId) => {
        dispatch(highlightedMessageToggled(messageId));
        const key = detail?.scene.elements.find((item) => item.source_message_id === messageId && item.selectable)?.element_key ?? "legacy-" + messageId;
        setSelectedElementKey(key);
        dispatch(targetSelected(key));
      }}
      onSceneScroll={onSceneScroll}
      sceneRef={sceneRef}
      showNewContent={showNewContent}
      onJumpToNewest={jumpToNewest}
      checkpoint={checkpoint}
      title="Family Safety Scenario"
      state={session.state}
      totalCount={allMessages.length}
      hintLevel={hintLevel}
      onHint={handleHint}
      onReset={handleReset}
      isResetting={commandLoading}
      selectedElementKey={selectedElementKey}
      companionNotice={companionNotice}
      onAskCompanion={handleAskCompanion}
      onSubmitAttempt={handleSubmitAttempt}
      pendingAttempt={pendingAttempt || attemptSubmitting}
      lastAttempt={lastAttempt}
      validatedFindings={validatedFindings}
      isExplaining={explaining}
      completionModalOpen={session.state === "completion_review"}
      completionAcknowledged={Boolean(session.completion_acknowledged_at)}
      commandLoading={commandLoading}
      actionError={actionError}
      onAcknowledgeCompletion={() => void sendCommand("acknowledge_completion")}
      onOpenHelp={() => void sendCommand("open_help")}
      onFinishCompletion={() => void sendCommand("complete")}
      onRetryAction={() => void refetch()}
    >
      {hintNotice && (
        <Alert severity="info" onClose={() => setHintNotice(null)} sx={{ mt: 2, borderRadius: 2 }}>
          {hintNotice}
        </Alert>
      )}

      <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, alignItems: "center", flexWrap: "wrap", mt: 2 }}>
        <Typography color="text.secondary" variant="body2">
          Discuss, pause, and decide who could help together. There is no score or timer.
        </Typography>
        <Chip color="primary" size="small" label="Select items to discuss" />
      </Box>

      {selectedTag && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          Current discussion tag: {selectedTag}
        </Typography>
      )}

      {actionError && (
        <Alert severity="error" sx={{ mt: 2 }} action={<Button color="inherit" size="small" onClick={() => void refetch()}>Retry</Button>}>
          {actionError}
        </Alert>
      )}

      {responderRole === "parent" && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
          It is your turn to add a shared reflection.
        </Typography>
      )}
    </FamilyGameplayView>
  );
}
