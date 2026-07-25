import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Link, TextField, Typography } from '@mui/material';
import { useLocation, useParams } from 'react-router-dom';
import { CheckpointPause } from '@/components/family/CheckpointPause';
import { ConversationGuideView } from '@/components/family/ConversationGuideView';
import { HelpSeekingBeat } from '@/components/family/HelpSeekingBeat';
import { SkinRouter } from '@/components/scenario-render/SkinRouter';
import {
  checkpointActivated,
  checkpointCleared,
  checkpointResponseRecorded,
  familyMessagesLoaded,
  familySessionStarted,
  highlightedMessageToggled,
  participantTurnSet,
  revealThrough,
  selectActiveCheckpoint,
  selectFamilyDetectiveMode,
  selectFamilyMessages,
  selectHighlightedMessageIds,
  selectParticipantTurn,
  selectTagAssignments,
  selectVisibleFamilyMessages,
  tagAssignmentSet,
} from '@/features/family/familySessionSlice';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  useCompleteFamilySessionMutation,
  useGetFamilyMessagesQuery,
  useGetFamilyScenarioQuery,
  useSubmitCheckpointResponseMutation,
  useSubmitCompanionCheckpointMutation,
  useExplainWithCompanionMutation,
} from '@/store/api';
import type { FamilySession, ParticipantRole } from '@/types';
function paceDelay(pace: string) {
  return pace === 'slow' ? 900 : pace === 'quick' ? 220 : 520;
}
export function FamilyScenarioPlayer() {
  const { transcriptId: transcriptIdParam, sessionId: sessionIdParam } = useParams();
  const transcriptId = Number(transcriptIdParam);
  const sessionId = Number(sessionIdParam);
  const location = useLocation();
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector((state) => state.auth.user);
  const locationSession = (location.state as { session?: FamilySession } | null)?.session;
  const session = locationSession ?? {
    id: sessionId,
    transcript_id: transcriptId,
    parent_user_id: null,
    companion_mode: true,
    detective_mode: false,
    started_at: '',
    completed_at: null,
  };
  const { data: scenario, isLoading: scenariosLoading } = useGetFamilyScenarioQuery(transcriptId, { skip: !transcriptId });
  const {
    data: replay = [],
    isLoading: messagesLoading,
    isError: messagesError,
  } = useGetFamilyMessagesQuery({ sessionId, upTo: scenario?.message_count ?? 0 }, { skip: !sessionId || !scenario });
  const [submitCheckpoint, { isLoading: submitting }] = useSubmitCheckpointResponseMutation();
  const [submitCompanionCheckpoint, { isLoading: companionSubmitting }] = useSubmitCompanionCheckpointMutation();
  const [explainWithCompanion, { isLoading: explaining }] = useExplainWithCompanionMutation();
  const [completeSession] = useCompleteFamilySessionMutation();
  const allMessages = useAppSelector(selectFamilyMessages);
  const visibleMessages = useAppSelector(selectVisibleFamilyMessages);
  const detectiveMode = useAppSelector(selectFamilyDetectiveMode);
  const highlightedMessageIds = useAppSelector(selectHighlightedMessageIds);
  const tagAssignments = useAppSelector(selectTagAssignments);
  const activeCheckpoint = useAppSelector(selectActiveCheckpoint);
  const participantTurn = useAppSelector(selectParticipantTurn);
  const [phase, setPhase] = useState<'play' | 'help' | 'guide' | 'support'>('play');
  const [explanation, setExplanation] = useState('');
  const [companionNotice, setCompanionNotice] = useState<{ text: string; disclosure: boolean; resources: Array<{ label: string; href: string }> } | null>(null);
  const responderRole: ParticipantRole = session.companion_mode ? 'child' : currentUser?.id === session.parent_user_id ? 'parent' : 'child';
  useEffect(() => {
    dispatch(familySessionStarted(session));
  }, [dispatch, session.id]);
  useEffect(() => {
    if (replay.length) dispatch(familyMessagesLoaded(replay));
  }, [dispatch, replay]);
  useEffect(() => {
    dispatch(participantTurnSet(responderRole));
  }, [dispatch, responderRole]);
  useEffect(() => {
    if (phase !== 'play' || activeCheckpoint || !allMessages.length) return;
    const next = allMessages.find((message) => message.sequence > (visibleMessages[visibleMessages.length - 1]?.sequence ?? 0));
    if (!next) {
      setPhase('help');
      return;
    }
    const timer = window.setTimeout(() => {
      dispatch(revealThrough(next.sequence));
      if (next.is_checkpoint)
        dispatch(checkpointActivated({ messageId: next.id, prompt: next.checkpoint_prompt ?? 'What would you like to talk about?' }));
    }, paceDelay(next.pace));
    return () => window.clearTimeout(timer);
  }, [activeCheckpoint, allMessages, dispatch, phase, visibleMessages]);
  const submit = async (responseText: string, tacticTagGuess: string) => {
    if (!activeCheckpoint) return;
    if (session.companion_mode) {
      const result = await submitCompanionCheckpoint({ sessionId, checkpoint_message_id: activeCheckpoint.messageId,
        child_response_text: responseText, flagged_message_ids: detectiveMode ? highlightedMessageIds : [],
        tactic_tag_guess: detectiveMode ? tacticTagGuess || null : null }).unwrap();
      dispatch(checkpointResponseRecorded(result.child_response));
      dispatch(checkpointResponseRecorded(result.checkpoint_response));
      setCompanionNotice({ text: result.response_text, disclosure: result.disclosure_triggered, resources: result.support_resources });
      dispatch(checkpointCleared());
      if (result.disclosure_triggered) setPhase("support");
      return;
    }
    const response = await submitCheckpoint({
      sessionId, checkpoint_message_id: activeCheckpoint.messageId, responder_role: participantTurn, response_text: responseText,
      flagged_message_ids: detectiveMode ? highlightedMessageIds : [], tactic_tag_guess: detectiveMode ? tacticTagGuess || null : null,
    }).unwrap();
    dispatch(checkpointResponseRecorded(response));
    dispatch(checkpointCleared());
  };
  const updateTag = (tag: string) => highlightedMessageIds.forEach((messageId) => dispatch(tagAssignmentSet({ messageId, tag })));
  const askCompanion = async () => {
    if (!explanation.trim()) return;
    const result = await explainWithCompanion({ sessionId, message: explanation.trim() }).unwrap();
    setExplanation('');
    setCompanionNotice({ text: result.response_text, disclosure: result.disclosure_triggered, resources: result.support_resources });
    if (result.disclosure_triggered) setPhase("support");
  };
  const finishHelpBeat = async () => {
    await completeSession(sessionId).unwrap();
    setPhase('guide');
  };
  const selectedTag = useMemo(() => Object.values(tagAssignments).find(Boolean) ?? '', [tagAssignments]);
  if (!sessionId || !transcriptId) return <Alert severity="error">This scenario link is incomplete.</Alert>;
  if (scenariosLoading || messagesLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  if (!scenario || messagesError)
    return <Alert severity="error">This family session could not be loaded. Return to the scenario list and try again.</Alert>;
  if (phase === "support" && companionNotice) return (
    <Box sx={{ maxWidth: 720, mx: "auto", mt: 4, p: { xs: 2, sm: 4 } }} aria-live="assertive">
      <Alert severity="warning">
        {companionNotice.text}
        {companionNotice.resources.map((resource) => <Link key={resource.href} href={resource.href} target="_blank" rel="noreferrer" sx={{ display: "block", mt: 1 }}>{resource.label}</Link>)}
      </Alert>
      <Typography sx={{ mt: 2 }}>This activity is paused. Take the time and support you need; it will not continue automatically.</Typography>
    </Box>
  );
  if (phase === 'guide') return <ConversationGuideView sessionId={sessionId} />;
  if (phase === 'help') return <HelpSeekingBeat category={scenario.category} onContinue={finishHelpBeat} />;
  return (
    <Box sx={{ maxWidth: 960, mx: 'auto', p: { xs: 2, sm: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <Box>
          <Typography variant="h4" sx={{ textTransform: 'capitalize' }}>
            {scenario.category.replace('_', ' ')}
          </Typography>
          <Typography color="text.secondary">Discuss, pause, and decide who could help. There is no score.</Typography>
        </Box>
        {detectiveMode && <Chip color="warning" label="Detective mode: select messages to discuss" />}
      </Box>
      <SkinRouter
        renderSkin={scenario.render_skin}
        messages={visibleMessages}
        detectiveMode={detectiveMode}
        highlightedMessageIds={highlightedMessageIds}
        onToggleMessage={(messageId) => dispatch(highlightedMessageToggled(messageId))}
      />
      {activeCheckpoint && (
        <CheckpointPause
          prompt={activeCheckpoint.prompt}
          detectiveMode={detectiveMode}
          selectedCount={highlightedMessageIds.length}
          companionMode={session.companion_mode}
          submitting={submitting || companionSubmitting}
          onSubmit={submit}
          onTagChange={updateTag}
        />
      )}
      {currentUser?.id !== session.parent_user_id && (
        <Box component="section" aria-label="Explain your reasoning" sx={{ mt: 3 }}>
          <Typography variant="h6">Want to explain your thinking?</Typography>
          <TextField label="What did you notice or what would you do?" value={explanation} onChange={(event) => setExplanation(event.target.value)} fullWidth multiline minRows={2} sx={{ mt: 1 }} />
          <Button onClick={askCompanion} disabled={!explanation.trim() || explaining} sx={{ mt: 1 }}>Talk it through with the guide</Button>
        </Box>
      )}
      {companionNotice && <Alert severity={companionNotice.disclosure ? 'warning' : 'info'} sx={{ mt: 2 }}>
        {companionNotice.text}
        {companionNotice.resources.map((resource) => <Link key={resource.href} href={resource.href} target="_blank" rel="noreferrer" sx={{ display: 'block', mt: 1 }}>{resource.label}</Link>)}
      </Alert>}
      {detectiveMode && selectedTag && (
        <Typography variant="caption" color="text.secondary">
          Current discussion tag: {selectedTag}
        </Typography>
      )}
    </Box>
  );
}
