import { useState, useRef, useEffect } from 'react';
import {
  Box, Paper, Typography, TextField, Button, IconButton, Grid,
  Chip, CircularProgress, Select, MenuItem, FormControl, InputLabel,
  Divider, LinearProgress, Tooltip, Switch, FormControlLabel, Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import BugReportIcon from '@mui/icons-material/BugReport';
import FlagIcon from '@mui/icons-material/Flag';
import { useSnackbar } from 'notistack';
import { useAppDispatch, useAppSelector } from '@/store';
import {
  startSession, addUserMessage, addAssistantMessage,
  setLoading, setDebugMode, resetSimulator,
} from '@/store/simulatorSlice';
import { simulatorApi, scenariosApi } from '@/api';
import type { ScenarioDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';
import { useEffect as useEffectOnce } from 'react';

export function Simulator() {
  const { enqueueSnackbar } = useSnackbar();
  const dispatch = useAppDispatch();
  const sim = useAppSelector(s => s.simulator);
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [selectedScenarioId, setSelectedScenarioId] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [message, setMessage] = useState('');
  const [starting, setStarting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scenariosApi.list().then(r => setScenarios(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [sim.messages]);

  const handleStart = async () => {
    if (!selectedScenarioId) return;
    setStarting(true);
    dispatch(resetSimulator());
    try {
      const r = await simulatorApi.start({ scenario_id: selectedScenarioId, difficulty });
      dispatch(startSession({
        sessionId: r.data.session_id,
        scenarioId: r.data.scenario_id,
        difficulty,
        initialMessage: r.data.initial_message,
      }));
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? 'Failed to start', { variant: 'error' });
    } finally { setStarting(false); }
  };

  const handleSend = async () => {
    if (!message.trim() || !sim.sessionId || sim.loading) return;
    const msg = message.trim();
    setMessage('');
    dispatch(addUserMessage(msg));
    try {
      const r = await simulatorApi.chat({ session_id: sim.sessionId, message: msg }, sim.debugMode);
      dispatch(addAssistantMessage(r.data));
    } catch (e: any) {
      dispatch(setLoading(false));
      enqueueSnackbar(e?.response?.data?.detail ?? 'Chat failed', { variant: 'error' });
    }
  };

  return (
    <AppShell>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* LEFT — chat */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Config bar */}
          <Box sx={{ px: 2, py: 1.5, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Scenario</InputLabel>
              <Select value={selectedScenarioId} label="Scenario" onChange={e => setSelectedScenarioId(e.target.value)}>
                {scenarios.map(s => <MenuItem key={s.id} value={s.id}>{s.display_name}</MenuItem>)}
              </Select>
            </FormControl>
            <FormControl size="small" sx={{ minWidth: 100 }}>
              <InputLabel>Difficulty</InputLabel>
              <Select value={difficulty} label="Difficulty" onChange={e => setDifficulty(e.target.value)}>
                <MenuItem value="Easy">Easy</MenuItem>
                <MenuItem value="Medium">Medium</MenuItem>
                <MenuItem value="Hard">Hard</MenuItem>
              </Select>
            </FormControl>
            <Button variant="contained" size="small" startIcon={starting ? <CircularProgress size={12} /> : <RestartAltIcon />}
              onClick={handleStart} disabled={!selectedScenarioId || starting}>
              {sim.sessionId ? 'Restart' : 'Start'}
            </Button>
            <Box sx={{ flex: 1 }} />
            <FormControlLabel
              control={<Switch size="small" checked={sim.debugMode} onChange={e => dispatch(setDebugMode(e.target.checked))} />}
              label={<Typography variant="caption">Debug</Typography>}
            />
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflow: 'auto', p: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {sim.messages.length === 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 1 }}>
                <Typography color="text.secondary" variant="body2">Select a scenario and press Start to begin the simulation.</Typography>
              </Box>
            )}
            {sim.messages.map(m => (
              <Box key={m.id} sx={{ display: 'flex', justifyContent: m.sender === 'user' ? 'flex-end' : 'flex-start' }}>
                <Paper sx={{
                  maxWidth: '75%', px: 2, py: 1.5, borderRadius: 2,
                  bgcolor: m.sender === 'user' ? 'primary.main' : 'background.paper',
                  border: '1px solid', borderColor: m.sender === 'user' ? 'transparent' : 'divider',
                }}>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{m.content}</Typography>
                  {m.sender === 'assistant' && m.metadata && (
                    <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {m.metadata.flags.map((f: string) => (
                        <Chip key={f} label={f} size="small" color="warning" icon={<FlagIcon />}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      ))}
                      <Chip label={`conf: ${m.metadata.confidence?.toFixed(2)}`} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                    </Box>
                  )}
                </Paper>
              </Box>
            ))}
            {sim.loading && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Paper sx={{ px: 2, py: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1s infinite' }} />
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1s infinite 0.2s' }} />
                    <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'primary.main', animation: 'pulse 1s infinite 0.4s' }} />
                  </Box>
                </Paper>
              </Box>
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', gap: 1 }}>
            <TextField
              fullWidth size="small" placeholder="Type your reply…"
              value={message} onChange={e => setMessage(e.target.value)}
              disabled={!sim.sessionId || sim.loading}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            />
            <Button variant="contained" size="small" onClick={handleSend}
              disabled={!sim.sessionId || sim.loading || !message.trim()}
              sx={{ minWidth: 48, px: 1.5 }}>
              <SendIcon fontSize="small" />
            </Button>
          </Box>
        </Box>

        {/* RIGHT — state panel */}
        <Box sx={{ width: 300, borderLeft: '1px solid', borderColor: 'divider', overflow: 'auto', p: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600,  mb: 2 }}>State Inspector</Typography>

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">SESSION</Typography>
            <Typography variant="body2">{sim.sessionId ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">SCENARIO</Typography>
            <Typography variant="body2">{sim.scenarioId ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">DIFFICULTY</Typography>
            <Typography variant="body2">{sim.difficulty}</Typography>
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary">STAGE</Typography>
            <Chip label={sim.currentStage || '—'} size="small" sx={{ display: 'block', mt: 0.5, width: 'fit-content' }} />
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>OBJECTIVE</Typography>
            <Chip label={sim.currentObjective || '—'} size="small" color="primary" sx={{ display: 'block', mt: 0.5, width: 'fit-content' }} />
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Trust</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }} color="success.main">{(sim.trust * 100).toFixed(0)}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={sim.trust * 100} color="success" sx={{ mb: 1.5, borderRadius: 1 }} />

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="caption">Suspicion</Typography>
              <Typography variant="caption" sx={{ fontWeight: 600 }} color="error.main">{(sim.suspicion * 100).toFixed(0)}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={sim.suspicion * 100} color="error" sx={{ borderRadius: 1 }} />
          </Box>

          <Divider sx={{ mb: 2 }} />

          <Typography variant="caption" color="text.secondary">COMPLETED OBJECTIVES</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 2 }}>
            {sim.completedObjectives.length === 0
              ? <Typography variant="caption" color="text.secondary">None yet</Typography>
              : sim.completedObjectives.map(o => <Chip key={o} label={o} size="small" color="success" sx={{ height: 18, fontSize: '0.65rem' }} />)
            }
          </Box>

          {sim.flags.length > 0 && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="caption" color="text.secondary">FLAGS RAISED</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5, mb: 2 }}>
                {sim.flags.map(f => <Chip key={f} label={f} size="small" color="warning" sx={{ height: 18, fontSize: '0.65rem' }} />)}
              </Box>
            </>
          )}

          {sim.debugMode && sim.lastPrompt && (
            <>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="caption" color="text.secondary">LAST BUILT PROMPT</Typography>
              <Paper variant="outlined" sx={{ mt: 0.5, p: 1, maxHeight: 300, overflow: 'auto' }}>
                <Typography component="pre" sx={{ fontFamily: 'monospace', fontSize: '0.65rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {sim.lastPrompt}
                </Typography>
              </Paper>
            </>
          )}
        </Box>
      </Box>
    </AppShell>
  );
}
