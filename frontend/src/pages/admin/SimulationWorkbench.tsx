import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useSnackbar } from 'notistack';
import { AppShell } from '@/components/common/AppShell';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  useCreateSimulationMutation,
  useDecideSimulationMutation,
  useEditSimulationMessageMutation,
  useGetSimulationQuery,
  useListScenariosQuery,
  useListSimulationsQuery,
  usePauseSimulationMutation,
  usePublishCuratedTranscriptMutation,
  useRegenerateSimulationLastTurnMutation,
  useRespondToSimulationMutation,
  useResumeSimulationMutation,
  useStopSimulationMutation,
} from '@/store/api';
import {
  connectionStatusChanged,
  eventCursorUpdated,
  messageReceived,
  runHydrated,
  runStarted,
  runStatusChanged,
  typingStarted,
  typingStopped,
  selectSimulationConnectionStatus,
  selectSimulationLastEventId,
  selectSimulationMessages,
  selectSimulationRunStatus,
  selectSimulationTyping,
} from '@/features/simulation/simulationViewerSlice';
import type { SimulationMode, SimulationRun } from '@/types';

const labels: Record<string, string> = { initiator: 'Initiator', respondent: 'Respondent', authored_moment: 'Authoring draft' };
const canEdit = (status: string) => ['paused', 'awaiting_admin', 'ready_for_review'].includes(status);
function DetailPanel({ run }: { run: SimulationRun }) {
  const [tab, setTab] = useState(0);
  const diagnostic = useMemo(
    () => ({
      progression: run.diagnostics?.progression ?? {},
      objectives: run.diagnostics?.objectives ?? [],
      safety_flags: run.diagnostics?.flags ?? [],
      personas: run.personas ?? {},
      prompts: run.prompts ?? {},
      usage: run.usage ?? {},
      worker: run.worker_status ?? {},
      revisions: run.revisions ?? [],
    }),
    [run]
  );
  return (
    <Paper variant="outlined" sx={{ minWidth: { lg: 330 }, maxWidth: { lg: 440 }, overflow: 'hidden' }}>
      <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
        <Tab label="Overview" />
        <Tab label="Progress" />
        <Tab label="Safety" />
        <Tab label="Prompts" />
        <Tab label="Usage" />
      </Tabs>
      <Box sx={{ p: 2, maxHeight: 560, overflow: 'auto' }}>
        {tab === 0 && (
          <>
            <Typography variant="subtitle2">Run {run.id}</Typography>
            <Typography variant="body2">Scenario: {run.scenario_id}</Typography>
            <Typography variant="body2">Mode: {run.mode}</Typography>
            <Typography variant="body2">Active branch: {String(run.progress?.active_branch ?? 'main')}</Typography>
          </>
        )}
        {tab === 1 && <pre>{JSON.stringify({ progression: diagnostic.progression, objectives: diagnostic.objectives }, null, 2)}</pre>}
        {tab === 2 && <pre>{JSON.stringify(diagnostic.safety_flags, null, 2)}</pre>}
        {tab === 3 && <pre>{JSON.stringify({ personas: diagnostic.personas, rendered_prompt_layers: diagnostic.prompts }, null, 2)}</pre>}
        {tab === 4 && <pre>{JSON.stringify({ usage: diagnostic.usage, worker: diagnostic.worker, revisions: diagnostic.revisions }, null, 2)}</pre>}
      </Box>
    </Paper>
  );
}
export function SimulationWorkbench() {
  const { runId: routeRunId } = useParams<{ runId?: string }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();
  const token = useAppSelector((state) => state.auth.accessToken);
  const messages = useAppSelector(selectSimulationMessages);
  const status = useAppSelector(selectSimulationRunStatus);
  const typing = useAppSelector(selectSimulationTyping);
  const connection = useAppSelector(selectSimulationConnectionStatus);
  const persistedCursor = useAppSelector(selectSimulationLastEventId);
  const [selectedRunId, setSelectedRunId] = useState<number | null>(routeRunId ? Number(routeRunId) : null);
  const [scenarioId, setScenarioId] = useState('');
  const [mode, setMode] = useState<SimulationMode>('ai_vs_ai');
  const [autoScroll, setAutoScroll] = useState(true);
  const [adminText, setAdminText] = useState('');
  const [edit, setEdit] = useState<{ id: number; content: string } | null>(null);
  const [reason, setReason] = useState('');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [eventLog, setEventLog] = useState<Array<{ id: number; event: string; payload: unknown }>>([]);
  const [transcriptId, setTranscriptId] = useState<number | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(persistedCursor);
  const abortRef = useRef<AbortController | null>(null);
  const { data: scenarios = [] } = useListScenariosQuery();
  const { data: savedRuns = [] } = useListSimulationsQuery();
  const {
    data: run,
    isFetching: loadingRun,
    error: runError,
    refetch,
  } = useGetSimulationQuery({ runId: selectedRunId ?? 0, debug: true }, { skip: selectedRunId === null });
  const [createRun, { isLoading: creating }] = useCreateSimulationMutation();
  const [pauseRun] = usePauseSimulationMutation();
  const [resumeRun] = useResumeSimulationMutation();
  const [stopRun] = useStopSimulationMutation();
  const [respond] = useRespondToSimulationMutation();
  const [editMessage] = useEditSimulationMessageMutation();
  const [regenerate] = useRegenerateSimulationLastTurnMutation();
  const [decide] = useDecideSimulationMutation();
  const [publish] = usePublishCuratedTranscriptMutation();
  useEffect(() => {
    if (!scenarioId && scenarios[0]) setScenarioId(scenarios[0].id);
  }, [scenarioId, scenarios]);
  useEffect(() => {
    setSelectedRunId(routeRunId ? Number(routeRunId) : null);
  }, [routeRunId]);
  useEffect(() => {
    if (run) {
      dispatch(runHydrated(run));
      cursorRef.current = 0;
      setTranscriptId(null);
    }
  }, [dispatch, run]);
  useEffect(() => {
    cursorRef.current = persistedCursor;
  }, [persistedCursor]);
  useEffect(() => {
    if (autoScroll) timelineRef.current?.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'smooth' });
  }, [autoScroll, messages, typing]);
  const reportError = (error: any, fallback: string) => enqueueSnackbar(error?.data?.detail ?? fallback, { variant: 'error' });
  const openStream = useCallback(() => {
    if (!selectedRunId || !token) return;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    dispatch(connectionStatusChanged('connecting'));
    void (async () => {
      try {
        const response = await fetch(`/api/admin/simulations/${selectedRunId}/events`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'text/event-stream', 'Last-Event-ID': String(cursorRef.current) },
          signal: abort.signal,
        });
        if (!response.ok || !response.body) throw new Error('stream unavailable');
        dispatch(connectionStatusChanged('connected'));
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!abort.signal.aborted) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split('\n\n');
          buffer = frames.pop() ?? '';
          for (const frame of frames) {
            const id = Number(frame.match(/^id:\s*(\d+)/m)?.[1] ?? 0);
            const event = frame.match(/^event:\s*(.+)$/m)?.[1];
            const raw = frame.match(/^data:\s*(.+)$/m)?.[1];
            if (!event || !raw) continue;
            const payload = JSON.parse(raw) as any;
            if (id) {
              cursorRef.current = id;
              dispatch(eventCursorUpdated(id));
            }
            setEventLog((items) => [...items.slice(-49), { id, event, payload }]);
            if (event === 'message')
              dispatch(
                messageReceived({ id: payload.id, sequence: payload.sequence, sender: payload.sender, content: payload.content, pace: 'normal' })
              );
            if (event === 'run_status') {
              dispatch(runStatusChanged(payload.status));
              if (payload.status === 'running') dispatch(typingStarted());
              else dispatch(typingStopped());
              void refetch();
            }
            if (event === 'message_revised') void refetch();
          }
        }
        if (!abort.signal.aborted) dispatch(connectionStatusChanged('disconnected'));
      } catch {
        if (!abort.signal.aborted) {
          dispatch(connectionStatusChanged('error'));
          dispatch(typingStopped());
        }
      }
    })();
  }, [dispatch, refetch, selectedRunId, token]);
  useEffect(() => {
    openStream();
    return () => abortRef.current?.abort();
  }, [openStream, reconnectNonce]);
  const start = async () => {
    const scenario = scenarios.find((item) => item.id === scenarioId);
    if (!scenario) return;
    const requiredMode: SimulationMode = scenario.generation_mode === 'single_pass' ? 'single_pass' : mode;
    if (scenario.generation_mode === 'single_pass' && mode !== 'single_pass') {
      enqueueSnackbar('This oversharing scenario must run in single-pass mode.', { variant: 'error' });
      return;
    }
    try {
      const created = await createRun({ scenario_id: scenarioId, mode: requiredMode }).unwrap();
      dispatch(runStarted(created.id));
      cursorRef.current = 0;
      setSelectedRunId(created.id);
      navigate(`/admin/simulator/${created.id}`);
    } catch (error) {
      reportError(error, 'Could not start simulation');
    }
  };
  const control = async (operation: () => Promise<unknown>, success: string) => {
    try {
      await operation();
      await refetch();
      enqueueSnackbar(success, { variant: 'success' });
    } catch (error) {
      reportError(error, 'Simulation control failed');
    }
  };
  const submitAdmin = async () => {
    if (!selectedRunId || !adminText.trim()) return;
    await control(() => respond({ runId: selectedRunId, content: adminText.trim() }).unwrap(), 'Response submitted');
    setAdminText('');
  };
  const saveEdit = async () => {
    if (!selectedRunId || !edit?.content.trim()) return;
    try {
      const changed = await editMessage({
        runId: selectedRunId,
        messageId: edit.id,
        content: edit.content.trim(),
        reason: reason.trim() || undefined,
      }).unwrap();
      dispatch(runHydrated(changed));
      setEdit(null);
      setReason('');
      enqueueSnackbar('Created a new revision and paused the run.', { variant: 'success' });
    } catch (error) {
      reportError(error, 'Edit was not accepted; refresh and try again.');
    }
  };
  const review = async (reviewStatus: 'approved' | 'rejected') => {
    if (!selectedRunId) return;
    try {
      const result = await decide({ runId: selectedRunId, status: reviewStatus }).unwrap();
      dispatch(runStatusChanged(result.status));
      setTranscriptId(result.curated_transcript_id);
      enqueueSnackbar(`Run ${reviewStatus}`, { variant: 'success' });
    } catch (error) {
      reportError(error, 'Review decision failed');
    }
  };
  const currentScenario = scenarios.find((item) => item.id === scenarioId);
  return (
    <AppShell>
      <Box sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Box>
          <Typography variant="h5">Simulation Workbench</Typography>
          <Typography color="text.secondary">Durable admin-only runtime with reconnectable event history.</Typography>
        </Box>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={1}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Scenario</InputLabel>
              <Select
                label="Scenario"
                value={scenarioId}
                onChange={(event) => {
                  const value = event.target.value;
                  setScenarioId(value);
                  const next = scenarios.find((scenario) => scenario.id === value);
                  if (next?.generation_mode === 'single_pass') setMode('single_pass');
                }}
              >
                <MenuItem value="">Choose a scenario</MenuItem>
                {scenarios.map((scenario) => (
                  <MenuItem key={scenario.id} value={scenario.id}>
                    {scenario.display_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Mode</InputLabel>
              <Select
                label="Mode"
                value={mode}
                onChange={(event) => setMode(event.target.value as SimulationMode)}
                disabled={currentScenario?.generation_mode === 'single_pass'}
              >
                <MenuItem value="ai_vs_ai">AI vs AI</MenuItem>
                <MenuItem value="admin_as_respondent">Admin as respondent</MenuItem>
                <MenuItem value="single_pass">Single pass</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" onClick={start} disabled={!scenarioId || creating}>
              Start
            </Button>
            <Divider flexItem orientation="vertical" />
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Saved run</InputLabel>
              <Select label="Saved run" value={selectedRunId ?? ''} onChange={(event) => navigate(`/admin/simulator/${event.target.value}`)}>
                <MenuItem value="">No saved run</MenuItem>
                {savedRuns.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    #{item.id} · {item.scenario_id} · {item.status}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <Chip size="small" label={`${status} · ${connection}`} color={connection === 'error' ? 'error' : 'default'} />
            <Button size="small" startIcon={<RefreshIcon />} onClick={() => setReconnectNonce((value) => value + 1)} disabled={!selectedRunId}>
              Reconnect
            </Button>
          </Stack>
        </Paper>
        {runError && <Alert severity="error">Could not restore this saved run. Use Reconnect or choose another run.</Alert>}
        {run?.status === 'limit_reached' && (
          <Alert severity="warning">Resource limit reached. Resume with an explicit limit extension or stop for review.</Alert>
        )}
        {run && (
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
            <Button startIcon={<PauseIcon />} onClick={() => control(() => pauseRun(run.id).unwrap(), 'Paused')} disabled={run.status !== 'running'}>
              Pause
            </Button>
            <Button
              startIcon={<PlayArrowIcon />}
              onClick={() => control(() => resumeRun({ runId: run.id, extend_limits: run.status === 'limit_reached' }).unwrap(), 'Resumed')}
              disabled={!['paused', 'awaiting_admin', 'limit_reached'].includes(run.status)}
            >
              Resume
            </Button>
            <Button
              startIcon={<StopIcon />}
              onClick={() => control(() => stopRun(run.id).unwrap(), 'Ready for review')}
              disabled={!['running', 'paused', 'awaiting_admin', 'limit_reached'].includes(run.status)}
            >
              Stop
            </Button>
            <Button
              startIcon={<RestartAltIcon />}
              onClick={() => control(() => regenerate(run.id).unwrap(), 'Regenerating last turn')}
              disabled={!canEdit(run.status) || !messages.length}
            >
              Regenerate last turn
            </Button>
            <Button onClick={() => review('approved')} disabled={run.status !== 'ready_for_review'}>
              Approve
            </Button>
            <Button color="error" onClick={() => review('rejected')} disabled={run.status !== 'ready_for_review'}>
              Reject
            </Button>
            <Button onClick={() => transcriptId && control(() => publish(transcriptId).unwrap(), 'Published')} disabled={!transcriptId}>
              Publish approved transcript
            </Button>
          </Stack>
        )}
        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ flex: 1, minHeight: 0 }}>
          <Paper ref={timelineRef} variant="outlined" sx={{ p: 2, flex: 1, minHeight: 360, overflow: 'auto' }}>
            {loadingRun && (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <CircularProgress size={24} />
              </Box>
            )}
            {!loadingRun && !run && (
              <Typography color="text.secondary">
                Start a simulation or select a saved run. This panel stays responsive while events arrive.
              </Typography>
            )}
            {messages.map((message) => (
              <Box key={message.id} sx={{ position: 'relative' }}>
                <MessageBubble
                  content={message.content}
                  speakerLabel={labels[message.sender] ?? message.sender}
                  side={message.sender === 'respondent' ? 'right' : 'left'}
                  pace={message.pace}
                  selectable
                />
                {run && canEdit(run.status) && (
                  <Button size="small" startIcon={<EditIcon />} sx={{ mb: 1 }} onClick={() => setEdit({ id: message.id, content: message.content })}>
                    Edit · {String(message.metadata?.revision_id ? 'revised branch' : 'main')}
                  </Button>
                )}
              </Box>
            ))}
            <TypingIndicator typing={typing && status === 'running'} />
            <FormControlLabel
              control={<Checkbox checked={autoScroll} onChange={(event) => setAutoScroll(event.target.checked)} />}
              label="Auto-scroll"
            />
            {run?.status === 'awaiting_admin' && (
              <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                <TextField
                  fullWidth
                  size="small"
                  label="Respond as administrator"
                  value={adminText}
                  onChange={(event) => setAdminText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      void submitAdmin();
                    }
                  }}
                />
                <Button variant="contained" onClick={submitAdmin}>
                  Send
                </Button>
              </Stack>
            )}
          </Paper>
          {run && <DetailPanel run={run} />}
        </Stack>
        {run && (
          <Paper variant="outlined" sx={{ p: 1.5, maxHeight: 160, overflow: 'auto' }}>
            <Typography variant="subtitle2">Event log</Typography>
            {eventLog.length ? (
              eventLog.map((event) => (
                <Typography key={`${event.id}-${event.event}`} component="pre" variant="caption">
                  #{event.id} {event.event} {JSON.stringify(event.payload)}
                </Typography>
              ))
            ) : (
              <Typography variant="caption" color="text.secondary">
                No live events yet. Persisted messages were restored before the stream opened.
              </Typography>
            )}
          </Paper>
        )}
        <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
          <DialogTitle>Edit active message</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              multiline
              minRows={4}
              fullWidth
              margin="dense"
              label="Message"
              value={edit?.content ?? ''}
              onChange={(event) => setEdit((value) => (value ? { ...value, content: event.target.value } : value))}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Reason for revision"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              helperText="The backend records this audit reason and supersedes downstream turns."
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setEdit(null)}>Cancel</Button>
            <Button variant="contained" onClick={saveEdit}>
              Save revision
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </AppShell>
  );
}
