import { useCallback, useEffect, useRef, useState } from 'react';
import { Box, Button, Chip, FormControl, InputLabel, MenuItem, Paper, Select, Stack, Typography } from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { useSnackbar } from 'notistack';
import { AppShell } from '@/components/common/AppShell';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  useDecideGenerationRunMutation, useListScenariosQuery, usePauseGenerationRunMutation,
  useRegenerateGenerationRunMutation, useResumeGenerationRunMutation, useStartGenerationRunMutation,
} from '@/store/api';
import { openGenerationStream } from '@/features/simulation/generationStream';
import { selectSimulationConnectionStatus, selectSimulationMessages, selectSimulationRunId, selectSimulationRunStatus, selectSimulationTyping, runStarted, runStatusChanged } from '@/features/simulation/simulationViewerSlice';
import { ReviewDecisionControls } from './ReviewDecisionControls';

const labels: Record<string, string> = { initiator: 'Initiator', respondent: 'Respondent' };

export function SimulationViewer() {
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const messages = useAppSelector(selectSimulationMessages);
  const runId = useAppSelector(selectSimulationRunId);
  const runStatus = useAppSelector(selectSimulationRunStatus);
  const connectionStatus = useAppSelector(selectSimulationConnectionStatus);
  const typing = useAppSelector(selectSimulationTyping);
  const { data: scenarios = [] } = useListScenariosQuery();
  const [scenarioId, setScenarioId] = useState('');
  const closeStream = useRef<(() => void) | null>(null);
  const [startRun] = useStartGenerationRunMutation();
  const [pauseRun] = usePauseGenerationRunMutation();
  const [resumeRun] = useResumeGenerationRunMutation();
  const [regenerateRun] = useRegenerateGenerationRunMutation();
  const [decideRun] = useDecideGenerationRunMutation();

  useEffect(() => { if (!scenarioId && scenarios[0]) setScenarioId(scenarios[0].id); }, [scenarioId, scenarios]);
  useEffect(() => () => closeStream.current?.(), []);

  const connect = useCallback((id: number) => {
    closeStream.current?.();
    if (!accessToken) return;
    closeStream.current = openGenerationStream(id, accessToken, dispatch);
  }, [accessToken, dispatch]);

  const handleStart = async () => {
    if (!scenarioId) return;
    try {
      const result = await startRun({ scenario_id: scenarioId }).unwrap();
      dispatch(runStarted(result.run_id));
      connect(result.run_id);
    } catch (error: any) { enqueueSnackbar(error?.data?.detail ?? 'Could not start generation', { variant: 'error' }); }
  };
  const withOptimisticStatus = async (status: 'paused' | 'running', request: () => Promise<unknown>) => {
    dispatch(runStatusChanged(status));
    try { await request(); } catch (error: any) { dispatch(runStatusChanged(status === 'paused' ? 'generating' : 'paused')); enqueueSnackbar(error?.data?.detail ?? 'Control failed', { variant: 'error' }); }
  };
  const handleRegenerate = async () => {
    if (!runId) return;
    dispatch(runStatusChanged('generating'));
    try { await regenerateRun(runId).unwrap(); connect(runId); } catch (error: any) { dispatch(runStatusChanged('pending')); enqueueSnackbar(error?.data?.detail ?? 'Could not regenerate the last turn', { variant: 'error' }); }
  };
  const handleDecision = async (status: 'approved' | 'rejected') => {
    if (!runId) return;
    dispatch(runStatusChanged(status));
    try { await decideRun({ runId, decision: { status } }).unwrap(); enqueueSnackbar(`Run ${status}`, { variant: 'success' }); }
    catch (error: any) { dispatch(runStatusChanged('pending')); enqueueSnackbar(error?.data?.detail ?? 'Review decision failed', { variant: 'error' }); }
  };
  const active = runStatus === 'running';
  const reviewable = runStatus === 'completed' && messages.length > 0;

  return (
    <AppShell>
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
          <Box><Typography variant="h5">Simulation Viewer</Typography><Typography color="text.secondary">Raw dual-agent generation feed</Typography></Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}><Chip size="small" label={`${runStatus} · ${connectionStatus}`} /><ReviewDecisionControls disabled={!reviewable} onDecision={handleDecision} /></Stack>
        </Box>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", alignItems: "center" }}>
            <FormControl size="small" sx={{ minWidth: 240 }}><InputLabel id="scenario-label">Scenario</InputLabel><Select labelId="scenario-label" label="Scenario" value={scenarioId} onChange={(event) => setScenarioId(event.target.value)}>{scenarios.map((scenario) => <MenuItem key={scenario.id} value={scenario.id}>{scenario.display_name}</MenuItem>)}</Select></FormControl>
            <Button variant="contained" onClick={handleStart} disabled={!scenarioId || active}>Start</Button>
            <Button startIcon={<PauseIcon />} onClick={() => runId && withOptimisticStatus('paused', () => pauseRun(runId).unwrap())} disabled={!runId || !active}>Pause</Button>
            <Button startIcon={<PlayArrowIcon />} onClick={() => runId && withOptimisticStatus('running', () => resumeRun(runId).unwrap())} disabled={!runId || runStatus !== 'paused'}>Resume</Button>
            <Button startIcon={<RestartAltIcon />} onClick={handleRegenerate} disabled={!runId || runStatus !== 'completed'}>Regenerate last turn</Button>
          </Stack>
        </Paper>
        <Paper variant="outlined" sx={{ flex: 1, minHeight: 280, overflow: 'auto', p: 3 }}>
          {messages.length === 0 && !typing && <Typography color="text.secondary">Start a scenario to view its generation stream.</Typography>}
          {messages.map((message) => <MessageBubble key={message.id} content={message.content} speakerLabel={labels[message.sender] ?? message.sender} side={message.sender === 'respondent' ? 'right' : 'left'} pace={message.pace} selectable />)}
          <TypingIndicator typing={typing} />
        </Paper>
      </Box>
    </AppShell>
  );
}
