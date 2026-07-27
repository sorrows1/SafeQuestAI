import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  AlertTitle,
  Box,
  Button,
  ButtonGroup,
  Card,
  CardContent,
  Checkbox,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import StopIcon from '@mui/icons-material/Stop';
import EditIcon from '@mui/icons-material/Edit';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningIcon from '@mui/icons-material/Warning';
import ErrorIcon from '@mui/icons-material/Error';
import InfoIcon from '@mui/icons-material/Info';
import BugReportIcon from '@mui/icons-material/BugReport';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ShieldIcon from '@mui/icons-material/Shield';
import FlagIcon from '@mui/icons-material/Flag';
import CodeIcon from '@mui/icons-material/Code';
import StorageIcon from '@mui/icons-material/Storage';
import SearchIcon from '@mui/icons-material/Search';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import CheckIcon from '@mui/icons-material/Check';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PublishIcon from '@mui/icons-material/Publish';
import ThumbUpIcon from '@mui/icons-material/ThumbUp';
import ThumbDownIcon from '@mui/icons-material/ThumbDown';
import SendIcon from '@mui/icons-material/Send';
import PsychologyIcon from '@mui/icons-material/Psychology';
import CloseIcon from '@mui/icons-material/Close';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
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
  selectLiveTacticTags,
  selectLiveRedFlagCount,
} from '@/features/simulation/simulationViewerSlice';
import type { SimulationMode, SimulationRun } from '@/types';

const speakerLabels: Record<string, string> = {
  initiator: 'Initiator',
  respondent: 'Respondent',
  authored_moment: 'Authoring draft',
  administrator: 'Administrator',
};

const canEdit = (status: string) => ['paused', 'awaiting_admin', 'ready_for_review', 'failed_retryable'].includes(status);

const STATUS_CHIP_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  running: 'primary',
  paused: 'default',
  awaiting_admin: 'warning',
  ready_for_review: 'info',
  approved: 'success',
  rejected: 'error',
  failed: 'error',
  failed_retryable: 'warning',
  failed_terminal: 'error',
  limit_reached: 'warning',
};

const CATEGORY_COLORS: Record<string, 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning'> = {
  lifecycle: 'primary',
  transcript: 'info',
  revision: 'secondary',
  resources: 'warning',
  safety: 'error',
  system: 'default',
};

function getNextActionBanner(status: string) {
  switch (status) {
    case 'running':
      return {
        severity: 'info' as const,
        title: 'Simulation in progress',
        message: 'Dual-agent execution is actively generating turns. You can pause at any time to inspect diagnostics or make edits.',
      };
    case 'awaiting_admin':
      return {
        severity: 'warning' as const,
        title: 'Admin intervention required',
        message: 'The simulation is in respondent mode. Enter a message below to advance the conversation.',
      };
    case 'paused':
      return {
        severity: 'info' as const,
        title: 'Simulation paused',
        message: 'Execution is paused. You can edit past messages, regenerate turns, or click Resume to continue.',
      };
    case 'limit_reached':
      return {
        severity: 'warning' as const,
        title: 'Resource limit reached',
        message: 'Message or time limit exceeded. Resume to extend limits or Stop to send to review queue.',
      };
    case 'ready_for_review':
      return {
        severity: 'info' as const,
        title: 'Ready for review',
        message: 'Simulation execution has finished. Inspect transcript quality and Approve or Reject the run.',
      };
    case 'approved':
      return {
        severity: 'success' as const,
        title: 'Run approved',
        message: 'This run has been approved. Publish the curated transcript to make it available in family scenario gameplay.',
      };
    case 'rejected':
      return {
        severity: 'error' as const,
        title: 'Run rejected',
        message: 'This run was rejected during review. Check safety findings and diagnostics before starting a new run.',
      };
    case 'failed_retryable':
      return {
        severity: 'warning' as const,
        title: 'Recovery needed',
        message: 'Generation retries were exhausted without saving a partial turn. Resume or regenerate from the last committed turn.',
      };
    case 'failed_terminal':
    case 'failed':
      return {
        severity: 'error' as const,
        title: 'Run execution failed',
        message: 'An error occurred during LLM generation or system execution. Review the event log for stack traces.',
      };
    default:
      return null;
  }
}

// ── Failure & Recovery Observability Component ──────────────────────────────
function FailureRecoveryCard({
  run,
  onResume,
  onRegenerate,
}: {
  run: SimulationRun;
  onResume: () => void;
  onRegenerate: () => void;
}) {
  const isRetryable = run.status === 'failed_retryable';
  const rawDiag: any = run.diagnostics ?? {};
  const retryInfo = rawDiag.retry_telemetry ?? {
    attempts: rawDiag.attempts ?? (isRetryable ? 3 : 1),
    max_retries: rawDiag.max_retries ?? 3,
    last_error_category: rawDiag.last_error_category ?? (isRetryable ? 'provider_timeout' : 'terminal_error'),
    last_error_message: rawDiag.last_error_message ?? run.stop_reason ?? 'Generation halted due to system error or moderation check.',
    next_backoff_seconds: rawDiag.next_backoff_seconds ?? 5,
  };

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderColor: isRetryable ? 'warning.main' : 'error.main',
        bgcolor: isRetryable ? 'action.hover' : 'error.50',
      }}
    >
      <Stack spacing={1.5}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {isRetryable ? <WarningIcon color="warning" /> : <ErrorIcon color="error" />}
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
              {isRetryable ? 'Execution Recovery Available' : 'Terminal Execution Failure'}
            </Typography>
          </Stack>
          <Chip
            label={run.status.toUpperCase()}
            size="small"
            color={isRetryable ? 'warning' : 'error'}
            sx={{ fontWeight: 700, fontFamily: 'monospace' }}
          />
        </Stack>

        <Typography variant="body2" sx={{ fontFamily: 'monospace', bgcolor: 'background.paper', p: 1, borderRadius: 1, border: 1, borderColor: 'divider' }}>
          <strong>Category:</strong> {retryInfo.last_error_category} | <strong>Attempts:</strong> {retryInfo.attempts}/{retryInfo.max_retries}
        </Typography>

        <Typography variant="caption" sx={{ color: 'text.primary', whiteSpace: 'pre-wrap' }}>
          {retryInfo.last_error_message}
        </Typography>

        {isRetryable && (
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Button size="small" variant="contained" color="warning" startIcon={<PlayArrowIcon />} onClick={onResume}>
              Resume Run (Retry Turn)
            </Button>
            <Button size="small" variant="outlined" color="warning" startIcon={<RestartAltIcon />} onClick={onRegenerate}>
              Regenerate Last Turn
            </Button>
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}

// ── Prompt Provenance & Context Drawer ─────────────────────────────────────
function PromptProvenanceDrawer({
  open,
  onClose,
  run,
}: {
  open: boolean;
  onClose: () => void;
  run: SimulationRun | null | undefined;
}) {
  const [tab, setTab] = useState(0);

  if (!run) return null;

  const rawDiag: any = run.diagnostics ?? {};
  const provenance: any[] = rawDiag.prompt_provenance ?? [];
  const prompts: Record<string, any> = run.prompts ?? {};

  return (
    <Drawer anchor="right" open={open} onClose={onClose} slotProps={{ paper: { sx: { width: { xs: '100%', sm: 540 }, p: 2.5 } } }}>
      <Stack spacing={2} sx={{ height: '100%' }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
            <PsychologyIcon color="primary" /> Prompt Provenance & Context
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Stack>

        <Alert severity="info" sx={{ py: 0.5 }}>
          Respondent prompt isolation enforced. Respondent agent does NOT receive initiator hidden goals.
        </Alert>

        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="fullWidth">
          <Tab label={`Provenance (${provenance.length})`} />
          <Tab label="Rendered Layers" />
        </Tabs>

        <Box sx={{ flex: 1, overflowY: 'auto' }}>
          {tab === 0 && (
            <Stack spacing={1.5}>
              {provenance.length ? (
                provenance.map((p: any, idx: number) => (
                  <Card key={p.id || idx} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                          {p.name || p.id}
                        </Typography>
                        <Chip label={p.role || p.role_scope || 'system'} size="small" color={p.role === 'initiator' ? 'primary' : 'secondary'} />
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', display: 'block' }}>
                        Version: {p.version || '1.0'} | Hash: {p.hash ? String(p.hash).substring(0, 8) : 'N/A'}
                      </Typography>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No prompt provenance records attached to this run.
                </Typography>
              )}
            </Stack>
          )}

          {tab === 1 && (
            <Stack spacing={1.5}>
              {Object.keys(prompts).length ? (
                Object.entries(prompts).map(([key, val]) => (
                  <Box key={key}>
                    <Typography variant="caption" color="primary" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>
                      LAYER: {key}
                    </Typography>
                    <Paper variant="outlined" sx={{ p: 1.5, mt: 0.5, bgcolor: 'action.hover', maxHeight: 200, overflowY: 'auto' }}>
                      <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
                        {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                      </Typography>
                    </Paper>
                  </Box>
                ))
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
                  No rendered prompt layer text captured.
                </Typography>
              )}
            </Stack>
          )}
        </Box>
      </Stack>
    </Drawer>
  );
}

// ── Diagnostic Detail Panel ──────────────────────────────────────────────────
function DiagnosticDetailPanel({ run, events, liveTacticTags, liveRedFlagCount }: {
  run: SimulationRun;
  events: Array<{ id: number; event: string; payload: any; }>;
  liveTacticTags: string[];
  liveRedFlagCount: number;
}) {
  const [tab, setTab] = useState(0);
  const [showRawPrompts, setShowRawPrompts] = useState(false);
  const { enqueueSnackbar } = useSnackbar();

  const copyRawJson = () => {
    if (!run) return;
    navigator.clipboard.writeText(JSON.stringify(run, null, 2));
    enqueueSnackbar('Copied raw JSON to clipboard', { variant: 'info' });
  };

  const downloadRawJson = () => {
    if (!run) return;
    const blob = new Blob([JSON.stringify(run, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `simulation-run-${run.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const diagnostics = useMemo(() => {
    const rawDiag: any = run.diagnostics ?? {};
    return {
      progression: rawDiag.progression ?? (run.progress?.progression as any) ?? {},
      objectives: rawDiag.objectives ?? {
        current: (run.progress?.current_objective as string) ?? null,
        completed: (run.progress?.completed_objectives as string[]) ?? [],
        pending: (run.progress?.pending_objectives as string[]) ?? [],
      },
      warnings: rawDiag.warnings ?? [],
      safety_findings: rawDiag.safety_findings ?? rawDiag.flags?.map((f: string) => ({ code: f, message: f, severity: 'warning', source: 'safety' })) ?? [],
      tactic_tags: rawDiag.tactic_tags ?? (run.progress?.tactic_tags as string[]) ?? [],
      prompt_provenance: rawDiag.prompt_provenance ?? [],
      flags: rawDiag.flags ?? [],
    };
  }, [run]);

  const usage = useMemo(() => {
    const u: any = run.resource_usage ?? run.usage ?? {};
    return {
      messages: Number(u.messages ?? 0),
      message_limit: Number(u.message_limit ?? 30),
      message_percent: Number(u.message_percent ?? 0),
      running_seconds: Number(u.running_seconds ?? 0),
      minute_limit: Number(u.minute_limit ?? 600),
      time_percent: Number(u.time_percent ?? 0),
      llm_calls: Number(u.llm_calls ?? 0),
      prompt_tokens: Number(u.prompt_tokens ?? 0),
      completion_tokens: Number(u.completion_tokens ?? 0),
    };
  }, [run]);

  const worker: any = run.worker_lease ?? (run.worker_status as any) ?? {};
  const branchSummary = run.branch_summary ?? {
    active_branch: (run.progress?.active_branch as string) ?? 'main',
    branch_count: 1,
    revision_count: run.revisions?.length ?? 0,
    latest_revision_id: run.revisions?.[run.revisions.length - 1]?.id ?? null,
  };

  const prompts = run.prompts ?? {};

  return (
    <Paper variant="outlined" sx={{ width: { xs: '100%', lg: 420 }, minWidth: { lg: 380 }, height: '100%', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <Tabs
        value={tab}
        onChange={(_, value) => setTab(value)}
        variant="scrollable"
        scrollButtons="auto"
        sx={{ borderBottom: 1, borderColor: 'divider', bgcolor: 'background.paper', flexShrink: 0 }}
      >
        <Tab label="Overview" />
        <Tab label="Progress" />
        <Tab label={`Safety (${diagnostics.safety_findings.length + diagnostics.warnings.length})`} />
        <Tab label={`Events (${events.length})`} />
        <Tab label="Prompts" />
        <Tab label="Usage" />
        <Tab label="Raw JSON" />
      </Tabs>

      <Box sx={{ p: 2, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {/* Tab 0: Overview */}
        {tab === 0 && (
          <Stack spacing={2}>
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  RUN DETAILS
                </Typography>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  Run #{run.id}
                </Typography>
                <Grid container spacing={1} sx={{ mt: 0.5 }}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Scenario
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {run.scenario_id ?? 'Custom'}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Mode
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {run.mode}
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Status
                    </Typography>
                    <Box sx={{ mt: 0.2 }}>
                      <Chip label={run.status} size="small" color={STATUS_CHIP_COLORS[run.status] || 'default'} />
                    </Box>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="caption" color="text.secondary">
                      Created At
                    </Typography>
                    <Typography variant="body2">{new Date(run.created_at).toLocaleTimeString()}</Typography>
                  </Grid>
                </Grid>

                {run.stop_reason && (
                  <Alert severity="info" sx={{ mt: 1.5, py: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600 }}>
                      Stop Reason:
                    </Typography>{' '}
                    <Typography variant="caption">{run.stop_reason}</Typography>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Worker Lease Card */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">
                    WORKER LEASE STATUS
                  </Typography>
                  <Chip
                    label={worker.healthy ? 'Healthy' : worker.state ? worker.state : 'No worker'}
                    size="small"
                    color={worker.healthy ? 'success' : 'default'}
                  />
                </Stack>
                <Typography variant="body2">
                  <strong>Worker ID:</strong> {worker.worker_id ?? 'Unassigned'}
                </Typography>
                {worker.leased_until && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    Leased until: {new Date(worker.leased_until).toLocaleTimeString()}
                  </Typography>
                )}
              </CardContent>
            </Card>

            {/* Branch Summary Card */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  BRANCH & REVISION SUMMARY
                </Typography>
                <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Active Branch
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {branchSummary.active_branch}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Branches
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {branchSummary.branch_count}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary">
                      Revisions
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {branchSummary.revision_count}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Tab 1: Progress */}
        {tab === 1 && (
          <Stack spacing={2}>
            {/* Stages */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  STAGE PROGRESSION
                </Typography>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mt: 1 }}>
                  <Chip
                    icon={<AccountTreeIcon />}
                    label={`Current: ${diagnostics.progression.current_stage ?? 'Initial'}`}
                    color="primary"
                    variant="filled"
                    size="small"
                  />
                  {diagnostics.progression.next_stage && (
                    <Chip label={`Next: ${diagnostics.progression.next_stage}`} variant="outlined" size="small" />
                  )}
                </Stack>
              </CardContent>
            </Card>

            {/* Objectives */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary">
                  OBJECTIVES
                </Typography>

                {diagnostics.objectives.current && (
                  <Alert severity="info" icon={<HourglassEmptyIcon />} sx={{ mt: 1, py: 0.5 }}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                      Active Objective:
                    </Typography>
                    <Typography variant="body2">{diagnostics.objectives.current}</Typography>
                  </Alert>
                )}

                <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                  Completed Objectives ({diagnostics.objectives.completed?.length ?? 0})
                </Typography>
                {diagnostics.objectives.completed?.length ? (
                  <List dense disablePadding>
                    {diagnostics.objectives.completed.map((obj: string, i: number) => (
                      <ListItem key={i} disableGutters sx={{ py: 0.2 }}>
                        <ListItemIcon sx={{ minWidth: 24 }}>
                          <CheckIcon color="success" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText primary={<Typography variant="body2">{obj}</Typography>} />
                      </ListItem>
                    ))}
                  </List>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>
                    None completed yet.
                  </Typography>
                )}

                {Boolean(diagnostics.objectives.pending?.length) && (
                  <>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
                      Pending Objectives ({diagnostics.objectives.pending.length})
                    </Typography>
                    <List dense disablePadding>
                      {diagnostics.objectives.pending.map((obj: string, i: number) => (
                        <ListItem key={i} disableGutters sx={{ py: 0.2 }}>
                          <ListItemIcon sx={{ minWidth: 24 }}>
                            <HourglassEmptyIcon color="action" fontSize="small" />
                          </ListItemIcon>
                          <ListItemText primary={<Typography variant="body2" color="text.secondary">{obj}</Typography>} />
                        </ListItem>
                      ))}
                    </List>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Tactic Tags */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    DETECTED TACTIC TAGS
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                    Red flags: {liveRedFlagCount} / {
                      (() => {
                        const modifiers = run.config_snapshot?.scenario?.difficulty_modifiers;
                        const difficulty = run.config_snapshot?.scenario?.difficulty ?? 'Medium';
                        const max = modifiers?.[difficulty]?.max_suspicious_targets ?? modifiers?.['Medium']?.max_suspicious_targets ?? 3;
                        return typeof max === 'number' ? max : 3;
                      })()
                    }
                  </Typography>
                </Box>
                {liveTacticTags.length ? (
                  <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                    {liveTacticTags.map((tag: string) => (
                      <Chip key={tag} label={tag} size="small" variant="outlined" color="secondary" />
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', display: 'block' }}>
                    No tactics recorded yet.
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Tab 2: Safety */}
        {tab === 2 && (
          <Stack spacing={2}>
            {/* Safety Findings */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ShieldIcon color="warning" fontSize="small" />
                Safety Findings ({diagnostics.safety_findings.length})
              </Typography>
              {diagnostics.safety_findings.length ? (
                <Stack spacing={1}>
                  {diagnostics.safety_findings.map((item: any, idx: number) => (
                    <Alert key={idx} severity={item.severity === 'error' ? 'error' : item.severity === 'info' ? 'info' : 'warning'} sx={{ py: 0.5 }}>
                      <AlertTitle sx={{ fontSize: '0.85rem', fontWeight: 600, mb: 0 }}>
                        {item.code || item.message}
                      </AlertTitle>
                      <Typography variant="caption" sx={{ display: 'block' }}>
                        {item.message}
                      </Typography>
                      {item.source && (
                        <Chip label={`Source: ${item.source}`} size="small" variant="outlined" sx={{ height: 16, fontSize: '0.65rem', mt: 0.5 }} />
                      )}
                    </Alert>
                  ))}
                </Stack>
              ) : (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    No safety findings reported for this run.
                  </Typography>
                </Paper>
              )}
            </Box>

            {/* Diagnostic Warnings */}
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon color="action" fontSize="small" />
                Diagnostic Warnings ({diagnostics.warnings.length})
              </Typography>
              {diagnostics.warnings.length ? (
                <Stack spacing={1}>
                  {diagnostics.warnings.map((w: any, idx: number) => (
                    <Paper key={idx} variant="outlined" sx={{ p: 1.5, borderColor: 'warning.light' }}>
                      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="caption" sx={{ fontWeight: 600 }}>
                          {w.code || 'Warning'}
                        </Typography>
                        <Chip label={w.severity || 'warning'} size="small" color={w.severity === 'error' ? 'error' : 'warning'} />
                      </Stack>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        {w.message}
                      </Typography>
                      {w.source && (
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                          Source: {w.source}
                        </Typography>
                      )}
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    No diagnostic warnings recorded.
                  </Typography>
                </Paper>
              )}
            </Box>

            {/* Flags */}
            {Boolean(diagnostics.flags.length) && (
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Flags ({diagnostics.flags.length})
                </Typography>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {diagnostics.flags.map((flag: string, i: number) => (
                    <Chip key={i} icon={<FlagIcon />} label={flag} size="small" color="error" variant="outlined" />
                  ))}
                </Stack>
              </Box>
            )}
          </Stack>
        )}

        {/* Tab 3: Events */}
        {tab === 3 && (
          <ChronologicalEventLog events={events} embedded />
        )}

        {/* Tab 4: Prompts */}
        {tab === 4 && (
          <Stack spacing={2}>
            <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2">Prompt Provenance</Typography>
              <Button
                size="small"
                startIcon={<BugReportIcon />}
                onClick={() => setShowRawPrompts((v) => !v)}
              >
                {showRawPrompts ? 'Hide Rendered Text' : 'Inspect Prompt Text'}
              </Button>
            </Stack>

            {diagnostics.prompt_provenance.length ? (
              <Stack spacing={1}>
                {diagnostics.prompt_provenance.map((p: any) => (
                  <Card key={p.id || p.name} variant="outlined">
                    <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {p.name || p.id}
                        </Typography>
                        <Chip label={p.role || p.role_scope || 'template'} size="small" variant="outlined" />
                      </Stack>
                      <Stack direction="row" spacing={2} sx={{ mt: 0.5 }}>
                        {p.version && (
                          <Typography variant="caption" color="text.secondary">
                            v{p.version}
                          </Typography>
                        )}
                        {p.hash && (
                          <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                            hash: {String(p.hash).substring(0, 8)}
                          </Typography>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            ) : (
              <Paper variant="outlined" sx={{ p: 2, textAlign: 'center' }}>
                <Typography variant="caption" color="text.secondary">
                  No prompt provenance records attached.
                </Typography>
              </Paper>
            )}

            <Collapse in={showRawPrompts}>
              <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover' }}>
                <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  RENDERED PROMPT LAYERS (Debug Authorization Gated)
                </Typography>
                {Object.keys(prompts).length ? (
                  <Stack spacing={1}>
                    {Object.entries(prompts).map(([key, val]) => (
                      <Box key={key}>
                        <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
                          {key}:
                        </Typography>
                        <Paper variant="outlined" sx={{ p: 1, mt: 0.5, bgcolor: 'background.paper', maxHeight: 150, overflow: 'auto' }}>
                          <Typography variant="caption" component="pre" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace' }}>
                            {typeof val === 'string' ? val : JSON.stringify(val, null, 2)}
                          </Typography>
                        </Paper>
                      </Box>
                    ))}
                  </Stack>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    No rendered prompt text captured for this run.
                  </Typography>
                )}
              </Paper>
            </Collapse>
          </Stack>
        )}

        {/* Tab 5: Usage */}
        {tab === 5 && (
          <Stack spacing={2}>
            {/* Message Budget Meter */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    MESSAGE BUDGET
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {usage.messages} / {usage.message_limit} ({Math.round(usage.message_percent)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, usage.message_percent)}
                  color={usage.message_percent > 85 ? 'warning' : 'primary'}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </CardContent>
            </Card>

            {/* Time Limit Meter */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    EXECUTION TIME
                  </Typography>
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    {usage.running_seconds}s / {usage.minute_limit}s ({Math.round(usage.time_percent)}%)
                  </Typography>
                </Stack>
                <LinearProgress
                  variant="determinate"
                  value={Math.min(100, usage.time_percent)}
                  color={usage.time_percent > 85 ? 'warning' : 'primary'}
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </CardContent>
            </Card>

            {/* Token and LLM Statistics */}
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  LLM CALL METRICS
                </Typography>
                <Grid container spacing={1.5}>
                  <Grid size={{ xs: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                      <Typography variant="h6">{usage.llm_calls}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        LLM Calls
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                      <Typography variant="h6">{usage.prompt_tokens}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Prompt Tokens
                      </Typography>
                    </Paper>
                  </Grid>
                  <Grid size={{ xs: 4 }}>
                    <Paper variant="outlined" sx={{ p: 1, textAlign: 'center' }}>
                      <Typography variant="h6">{usage.completion_tokens}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Comp. Tokens
                      </Typography>
                    </Paper>
                  </Grid>
                </Grid>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Tab 6: Raw JSON */}
        {tab === 6 && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1}>
              <Button size="small" variant="outlined" startIcon={<ContentCopyIcon />} onClick={copyRawJson}>
                Copy JSON
              </Button>
              <Button size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={downloadRawJson}>
                Download JSON
              </Button>
            </Stack>
            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', maxHeight: 400, overflow: 'auto' }}>
              <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
                {JSON.stringify(run, null, 2)}
              </Typography>
            </Paper>
          </Stack>
        )}
      </Box>
    </Paper>
  );
}

// ── Chronological Event Log Timeline ─────────────────────────────────────────
function ChronologicalEventLog({ events, embedded = false }: { events: Array<{ id: number; event: string; payload: any; }>; embedded?: boolean; }) {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      const cat = e.payload?.category || 'system';
      if (filterCategory !== 'all' && cat !== filterCategory) return false;
      if (searchQuery.trim()) {
        const str = JSON.stringify(e).toLowerCase();
        if (!str.includes(searchQuery.toLowerCase())) return false;
      }
      return true;
    });
  }, [events, filterCategory, searchQuery]);

  const body = (
    <Stack spacing={1.5}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
        {!embedded && (
          <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <StorageIcon fontSize="small" /> Event Log Timeline ({events.length})
          </Typography>
        )}

        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
          <TextField
            size="small"
            placeholder="Filter events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ flex: 1, minWidth: 120 }}
          />
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <Select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="lifecycle">Lifecycle</MenuItem>
              <MenuItem value="transcript">Transcript</MenuItem>
              <MenuItem value="revision">Revision</MenuItem>
              <MenuItem value="resources">Resources</MenuItem>
              <MenuItem value="safety">Safety</MenuItem>
              <MenuItem value="system">System</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      <Box sx={{ overflow: 'auto' }}>
        {filteredEvents.length ? (
          <List dense disablePadding>
            {filteredEvents.map((evt, idx) => {
              const category = evt.payload?.category || 'system';
              const label = evt.payload?.label || evt.event;
              const severity = evt.payload?.severity || 'info';

              return (
                <Accordion key={`${evt.id}-${evt.event}-${idx}`} variant="outlined" sx={{ '&:before': { display: 'none' }, mb: 0.5 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />} sx={{ minHeight: 36, px: 1.5, py: 0 }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', width: '100%' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace', minWidth: 40 }}>
                        #{evt.id || idx + 1}
                      </Typography>
                      <Chip label={category} size="small" color={CATEGORY_COLORS[category] || 'default'} sx={{ height: 18, fontSize: '0.65rem' }} />
                      {severity === 'error' && <ErrorIcon color="error" sx={{ fontSize: 16 }} />}
                      {severity === 'warning' && <WarningIcon color="warning" sx={{ fontSize: 16 }} />}
                      <Typography variant="caption" sx={{ fontWeight: 500, flex: 1 }} noWrap>
                        {label}
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                    <Typography variant="caption" component="pre" sx={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', m: 0 }}>
                      {JSON.stringify(evt.payload, null, 2)}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </List>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ py: 2, display: 'block', textAlign: 'center' }}>
            No events match the current filter.
          </Typography>
        )}
      </Box>
    </Stack>
  );

  if (embedded) return body;
  return <Paper variant="outlined" sx={{ p: 2 }}>{body}</Paper>;
}

// ── Main Simulation Workbench Component ──────────────────────────────────────
export function SimulationWorkbench() {
  const { runId: routeRunId } = useParams<{ runId?: string; }>();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { enqueueSnackbar } = useSnackbar();

  const token = useAppSelector((state) => state.auth.accessToken);
  const messages = useAppSelector(selectSimulationMessages);
  const status = useAppSelector(selectSimulationRunStatus);
  const typing = useAppSelector(selectSimulationTyping);
  const connection = useAppSelector(selectSimulationConnectionStatus);
  const persistedCursor = useAppSelector(selectSimulationLastEventId);
  const liveTacticTags = useAppSelector(selectLiveTacticTags);
  const liveRedFlagCount = useAppSelector(selectLiveRedFlagCount);

  const [selectedRunId, setSelectedRunId] = useState<number | null>(routeRunId ? Number(routeRunId) : null);
  const [scenarioId, setScenarioId] = useState('');
  const [mode, setMode] = useState<SimulationMode>('ai_vs_ai');
  const [autoScroll, setAutoScroll] = useState(true);
  const [userScrolledUp, setUserScrolledUp] = useState(false);
  const [unreadEventsCount, setUnreadEventsCount] = useState(0);
  const [promptDrawerOpen, setPromptDrawerOpen] = useState(false);
  const [adminText, setAdminText] = useState('');
  const [edit, setEdit] = useState<{ id: number; content: string; } | null>(null);
  const [reason, setReason] = useState('');
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [eventLog, setEventLog] = useState<Array<{ id: number; event: string; payload: unknown; }>>([]);
  const [transcriptId, setTranscriptId] = useState<number | null>(null);

  const timelineRef = useRef<HTMLDivElement>(null);
  const cursorRef = useRef(persistedCursor);
  const abortRef = useRef<AbortController | null>(null);
  const prevMessagesCountRef = useRef(messages.length);

  const { data: scenarios = [] } = useListScenariosQuery();
  const { data: savedRuns = [] } = useListSimulationsQuery();
  const {
    data: run,
    isFetching: loadingRun,
    error: runError,
    refetch,
  } = useGetSimulationQuery({ runId: selectedRunId ?? 0 }, { skip: selectedRunId === null });

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

  const handleTimelineScroll = useCallback(() => {
    if (!timelineRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = timelineRef.current;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 40;
    if (isAtBottom) {
      setUserScrolledUp(false);
      setUnreadEventsCount(0);
    } else {
      setUserScrolledUp(true);
    }
  }, []);

  useEffect(() => {
    if (messages.length > prevMessagesCountRef.current) {
      if (userScrolledUp) {
        setUnreadEventsCount((prev) => prev + (messages.length - prevMessagesCountRef.current));
      }
    }

    if (autoScroll && !userScrolledUp && timelineRef.current) {
      timelineRef.current.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'auto' });
    }

    prevMessagesCountRef.current = messages.length;
  }, [messages, typing, autoScroll, userScrolledUp]);

  const scrollToBottom = () => {
    if (timelineRef.current) {
      timelineRef.current.scrollTo({ top: timelineRef.current.scrollHeight, behavior: 'auto' });
    }
    setUserScrolledUp(false);
    setUnreadEventsCount(0);
    setAutoScroll(true);
  };

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
            let normalized: any;
            try {
              normalized = JSON.parse(raw);
            } catch (err) {
              console.error('Failed to parse SSE JSON payload', raw);
              continue;
            }
            const payload = normalized.payload ?? normalized;

            if (id) {
              cursorRef.current = id;
              dispatch(eventCursorUpdated(id));
            }
            setEventLog((items) => [...items.slice(-49), { id, event, payload: normalized }]);

            if (event === 'message')
              dispatch(
                messageReceived({
                  id: payload.id,
                  sequence: payload.sequence,
                  sender: payload.sender,
                  content: payload.content,
                  pace: 'normal',
                  tactic_tags: Array.isArray(payload.tactic_tags) ? payload.tactic_tags : [],
                  metadata: {
                    tactic_tags: Array.isArray(payload.tactic_tags) ? payload.tactic_tags : [],
                    is_checkpoint: payload.is_checkpoint ?? false,
                    child_safe_explanation: payload.child_safe_explanation ?? null,
                    tiered_hints: payload.tiered_hints ?? [],
                  },
                })
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
      if (reviewStatus === 'approved' && result.curated_transcript_id) {
        enqueueSnackbar('Simulation approved. Review scene content and annotations before publication.', { variant: 'success' });
        navigate(`/admin/curated-transcripts/${result.curated_transcript_id}/review`);
      } else {
        enqueueSnackbar(`Run ${reviewStatus}`, { variant: 'success' });
      }
    } catch (error) {
      reportError(error, 'Review decision failed');
    }
  };

  const currentScenario = scenarios.find((item) => item.id === scenarioId);
  const nextActionBanner = run ? getNextActionBanner(run.status) : null;

  return (
    <AppShell>
      <Box sx={{ p: 2.5, pb: 6, display: 'flex', flexDirection: 'column', gap: 2, height: { xs: 'auto', lg: '100%' }, minHeight: '100%' }}>
        {/* Page Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, flexShrink: 0 }}>
          <Box>
            <Typography variant="h5" sx={{ fontWeight: 700 }}>
              Simulation Workbench
            </Typography>
            <Typography color="text.secondary" variant="body2">
              Durable multi-agent execution, human-in-the-loop interventions, and diagnostic observability.
            </Typography>
          </Box>

          {run && (
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<PsychologyIcon />}
                onClick={() => setPromptDrawerOpen(true)}
              >
                Inspect Context & Prompts
              </Button>
              <Chip
                label={`Status: ${run.status}`}
                color={STATUS_CHIP_COLORS[run.status] || 'default'}
                sx={{ fontWeight: 600 }}
              />
              <Chip
                label={`SSE: ${connection}`}
                color={connection === 'connected' ? 'success' : connection === 'error' ? 'error' : 'default'}
                variant="outlined"
              />
              <Button size="small" startIcon={<RefreshIcon />} onClick={() => setReconnectNonce((v) => v + 1)}>
                Reconnect
              </Button>
            </Stack>
          )}
        </Box>

        {/* Start / Select Run Header Panel */}
        <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper', flexShrink: 0 }}>
          <Grid container spacing={2} sx={{ alignItems: 'center' }}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
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
            </Grid>

            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <FormControl fullWidth size="small">
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
            </Grid>

            <Grid size={{ xs: 6, md: 2 }}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<PlayCircleIcon />}
                onClick={start}
                disabled={!scenarioId || creating}
              >
                Start Run
              </Button>
            </Grid>

            <Grid size={{ xs: 12, md: 4 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Saved run</InputLabel>
                <Select
                  label="Saved run"
                  value={selectedRunId ?? ''}
                  onChange={(event) => navigate(`/admin/simulator/${event.target.value}`)}
                >
                  <MenuItem value="">Select saved simulation run...</MenuItem>
                  {savedRuns.map((item) => (
                    <MenuItem key={item.id} value={item.id}>
                      #{item.id} · {item.scenario_id} · {item.status}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>
        </Paper>

        {/* Onboarding View when no run is selected */}
        {!selectedRunId && !run && (
          <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'action.hover', flex: 1 }}>
            <Box sx={{ maxWidth: 500, mx: 'auto', py: 4 }}>
              <AccountTreeIcon color="primary" sx={{ fontSize: 48, mb: 1 }} />
              <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                No active simulation selected
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Select a scenario and execution mode above to launch a new multi-turn AI simulation, or select a previously saved run to inspect its transcripts, diagnostic state, and events.
              </Typography>

              <Stack direction="row" spacing={2} sx={{ justifyContent: 'center' }}>
                <Button variant="contained" onClick={start} disabled={!scenarioId || creating}>
                  Start New Simulation
                </Button>
                {Boolean(savedRuns.length) && (
                  <Button variant="outlined" onClick={() => navigate(`/admin/simulator/${savedRuns[0].id}`)}>
                    Open Recent Run (#{savedRuns[0].id})
                  </Button>
                )}
              </Stack>
            </Box>
          </Paper>
        )}

        {/* Error Alert */}
        {runError && (
          <Alert severity="error" sx={{ flexShrink: 0 }}>
            Could not restore saved run #{selectedRunId}. Use Reconnect or select another run.
          </Alert>
        )}

        {/* Active Run Banner & Action Callout */}
        {run && (
          <Stack spacing={1.5} sx={{ flexShrink: 0 }}>
            {/* Failure & Recovery Component if failed */}
            {(run.status.startsWith('failed') || run.status === 'failed_retryable') && (
              <FailureRecoveryCard
                run={run}
                onResume={() => control(() => resumeRun({ runId: run.id, extend_limits: false }).unwrap(), 'Simulation resumed')}
                onRegenerate={() => control(() => regenerate(run.id).unwrap(), 'Regenerating last turn')}
              />
            )}

            {/* Recommended Next Action Banner */}
            {nextActionBanner && !run.status.startsWith('failed') && (
              <Alert severity={nextActionBanner.severity} icon={<InfoIcon />}>
                <AlertTitle sx={{ fontWeight: 700 }}>{nextActionBanner.title}</AlertTitle>
                {nextActionBanner.message}
              </Alert>
            )}

            {/* Sticky Grouped Controls Bar */}
            <Paper variant="outlined" sx={{ p: 1.5, position: 'sticky', top: 0, zIndex: 10, bgcolor: 'background.paper' }}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
                  {/* Group 1: Lifecycle */}
                  <ButtonGroup size="small" variant="outlined">
                    <Button
                      startIcon={<PauseIcon />}
                      onClick={() => control(() => pauseRun(run.id).unwrap(), 'Simulation paused')}
                      disabled={run.status !== 'running'}
                    >
                      Pause
                    </Button>
                    <Button
                      startIcon={<PlayArrowIcon />}
                      onClick={() => control(() => resumeRun({ runId: run.id, extend_limits: run.status === 'limit_reached' }).unwrap(), 'Simulation resumed')}
                      disabled={!['paused', 'awaiting_admin', 'limit_reached', 'failed_retryable'].includes(run.status)}
                    >
                      Resume
                    </Button>
                    <Button
                      startIcon={<StopIcon />}
                      color="warning"
                      onClick={() => control(() => stopRun(run.id).unwrap(), 'Simulation stopped')}
                      disabled={!['running', 'paused', 'awaiting_admin', 'limit_reached', 'failed_retryable'].includes(run.status)}
                    >
                      Stop
                    </Button>
                  </ButtonGroup>

                  <Divider flexItem orientation="vertical" />

                  {/* Group 2: Interventions */}
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    onClick={() => control(() => regenerate(run.id).unwrap(), 'Regenerating last turn')}
                    disabled={!canEdit(run.status) || !messages.length}
                  >
                    Regenerate Turn
                  </Button>

                  <Divider flexItem orientation="vertical" />

                  {/* Group 3: Review & Publication */}
                  <ButtonGroup size="small">
                    <Button
                      variant="contained"
                      color="success"
                      startIcon={<ThumbUpIcon />}
                      onClick={() => review('approved')}
                      disabled={run.status !== 'ready_for_review'}
                    >
                      Approve
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<ThumbDownIcon />}
                      onClick={() => review('rejected')}
                      disabled={run.status !== 'ready_for_review'}
                    >
                      Reject
                    </Button>
                  </ButtonGroup>

                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<PublishIcon />}
                    onClick={() => transcriptId && control(() => publish(transcriptId).unwrap(), 'Published curated transcript')}
                    disabled={!transcriptId}
                  >
                    Publish Transcript
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        )}

        {/* Main Content Area: Transcript Timeline + Diagnostic Panel */}
        {run && (
          <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2} sx={{ flex: 1, minHeight: 480, height: { xs: 'auto', lg: '100%' } }}>
            {/* Left: Transcript Timeline */}
            <Paper variant="outlined" sx={{ p: 2, flex: 1, minHeight: 480, height: { xs: 500, lg: '100%' }, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Box sx={{ pb: 1, borderBottom: 1, borderColor: 'divider', mb: 1.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Transcript Timeline ({messages.length} turns)
                </Typography>
                <FormControlLabel
                  control={<Checkbox size="small" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />}
                  label={<Typography variant="caption">Auto-scroll</Typography>}
                />
              </Box>

              <Box ref={timelineRef} onScroll={handleTimelineScroll} sx={{ flex: 1, minHeight: 0, overflowY: 'auto', pr: 1, position: 'relative' }}>
                {loadingRun && (
                  <Box sx={{ textAlign: 'center', py: 6 }}>
                    <CircularProgress size={32} />
                  </Box>
                )}

                {!loadingRun && messages.length === 0 && (
                  <Box sx={{ py: 6, textAlign: 'center' }}>
                    <Typography color="text.secondary" variant="body2">
                      No messages generated yet in this run. Click Resume or enter admin input to begin.
                    </Typography>
                  </Box>
                )}

                <Box sx={{ flex: 1 }}>
                  {messages.map((message) => {
                    const tacticTags = (message.metadata?.tactic_tags as string[]) ?? [];
                    const isCheckpoint = Boolean(message.metadata?.is_checkpoint);
                    const stageId = message.metadata?.stage_id as string | undefined;
                    const objectiveId = message.metadata?.objective_id as string | undefined;
                    const revisionId = message.metadata?.revision_id as number | undefined;
                    const isSuperseded = Boolean(message.metadata?.superseded);

                    return (
                      <Box key={message.id} sx={{ mb: 2, opacity: isSuperseded ? 0.6 : 1.0 }}>
                        {/* Message Metadata Header Bar */}
                        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
                          <Chip
                            label={speakerLabels[message.sender] ?? message.sender}
                            size="small"
                            color={message.sender === 'respondent' ? 'secondary' : 'primary'}
                            sx={{ height: 20, fontSize: '0.7rem' }}
                          />
                          {stageId && (
                            <Chip label={`Stage: ${stageId}`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          {objectiveId && (
                            <Chip label={`Obj: ${objectiveId}`} size="small" variant="outlined" color="info" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          {isCheckpoint && (
                            <Chip label="Checkpoint" size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          {revisionId && (
                            <Chip label={`Rev #${revisionId}`} size="small" variant="outlined" color="secondary" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                          {isSuperseded && (
                            <Chip label="Superseded" size="small" color="default" sx={{ height: 18, fontSize: '0.65rem' }} />
                          )}
                        </Stack>

                        {/* Tactic Chips */}
                        {Boolean(tacticTags.length) && (
                          <Stack direction="row" spacing={0.5} useFlexGap sx={{ mb: 0.5, flexWrap: 'wrap' }}>
                            {tacticTags.map((tag) => (
                              <Chip key={tag} label={tag} size="small" variant="outlined" color="secondary" sx={{ height: 18, fontSize: '0.65rem' }} />
                            ))}
                          </Stack>
                        )}

                        <MessageBubble
                          content={message.content}
                          speakerLabel={speakerLabels[message.sender] ?? message.sender}
                          side={message.sender === 'respondent' ? 'right' : 'left'}
                          selectable
                        />

                        {run && canEdit(run.status) && (
                          <Button
                            size="small"
                            startIcon={<EditIcon />}
                            sx={{ mt: 0.5, fontSize: '0.75rem' }}
                            onClick={() => setEdit({ id: message.id, content: message.content })}
                          >
                            Edit turn
                          </Button>
                        )}
                      </Box>
                    );
                  })}
                </Box>

                <TypingIndicator typing={typing && status === 'running'} />
              </Box>

              {/* Floating new events button when user is scrolled up */}
              {userScrolledUp && unreadEventsCount > 0 && (
                <Box sx={{ textAlign: 'center', py: 0.5, flexShrink: 0 }}>
                  <Button
                    size="small"
                    variant="contained"
                    color="primary"
                    startIcon={<KeyboardArrowDownIcon />}
                    onClick={scrollToBottom}
                    sx={{ borderRadius: 4, boxShadow: 2, fontWeight: 700 }}
                  >
                    {unreadEventsCount} new message{unreadEventsCount > 1 ? 's' : ''} below
                  </Button>
                </Box>
              )}

              {/* Admin Respondent Input Bar */}
              {run?.status === 'awaiting_admin' && (
                <Paper variant="outlined" sx={{ p: 1.5, mt: 1, bgcolor: 'action.hover', flexShrink: 0 }}>
                  <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                    ADMIN RESPONDENT INTERVENTION
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Respond as administrator..."
                      value={adminText}
                      onChange={(event) => setAdminText(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          void submitAdmin();
                        }
                      }}
                    />
                    <Button variant="contained" startIcon={<SendIcon />} onClick={submitAdmin}>
                      Send
                    </Button>
                  </Stack>
                </Paper>
              )}
            </Paper>

            {/* Right: Diagnostic Detail Panel */}
            <DiagnosticDetailPanel run={run} events={eventLog} liveTacticTags={liveTacticTags} liveRedFlagCount={liveRedFlagCount} />
          </Stack>
        )}

        {/* Edit Revision Dialog */}
        <Dialog open={Boolean(edit)} onClose={() => setEdit(null)} fullWidth maxWidth="sm">
          <DialogTitle>Edit active message turn</DialogTitle>
          <DialogContent>
            <TextField
              autoFocus
              multiline
              minRows={4}
              fullWidth
              margin="dense"
              label="Revised Message Content"
              value={edit?.content ?? ''}
              onChange={(event) => setEdit((value) => (value ? { ...value, content: event.target.value } : value))}
            />
            <TextField
              fullWidth
              margin="dense"
              label="Reason for revision (Audit Trail)"
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

        {/* Prompt Provenance & Context Drawer */}
        <PromptProvenanceDrawer open={promptDrawerOpen} onClose={() => setPromptDrawerOpen(false)} run={run} />
      </Box>
    </AppShell>
  );
}
