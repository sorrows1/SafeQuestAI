import { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, List, ListItemButton, ListItemText,
  IconButton, TextField, Button, Chip, Divider, CircularProgress,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Tabs, Tab,
  Alert, Collapse, Grid,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SaveIcon from '@mui/icons-material/Save';
import { useSnackbar } from 'notistack';
import ReactFlow, {
  Background, Controls, MiniMap, addEdge,
  useNodesState, useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { scenariosApi, stagesApi, personasApi, objectivesApi, constraintsApi } from '@/api';
import type { ScenarioDefinition, StageDefinition, StageStep } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY_SCENARIO: ScenarioDefinition = {
  id: '', display_name: '', description: '', difficulty: 'Medium',
  persona: '', starting_stage: '', prompt_template: 'default_dialogue',
  version: '1.0.0', tags: [], learning_objectives: [],
  stage_sequence: [], difficulty_modifiers: {},
};

// ── Graph helpers ──────────────────────────────────────────────────────────
function scenarioToFlow(scenario: ScenarioDefinition) {
  const nodes = scenario.stage_sequence.map((step, i) => ({
    id: step.stage,
    data: { label: step.stage, objectives: step.objectives.length },
    position: { x: 200 * (i % 3), y: 150 * Math.floor(i / 3) },
    style: {
      background: '#21262d', border: '1px solid #30363d', borderRadius: 8,
      color: '#e6edf3', fontSize: 12, padding: 10, minWidth: 140,
    },
  }));

  const edges: { id: string; source: string; target: string; animated?: boolean }[] = [];
  for (let i = 0; i < scenario.stage_sequence.length - 1; i++) {
    const from = scenario.stage_sequence[i].stage;
    const to = scenario.stage_sequence[i + 1].stage;
    edges.push({ id: `${from}-${to}`, source: from, target: to, animated: true });
  }
  return { nodes, edges };
}

export function ScenarioEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [selected, setSelected] = useState<ScenarioDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [personas, setPersonas] = useState<string[]>([]);
  const [stages, setStages] = useState<StageDefinition[]>([]);
  const [objectives, setObjectives] = useState<string[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [sc, ps, st, ob, co] = await Promise.all([
        scenariosApi.list(), personasApi.list(), stagesApi.list(),
        objectivesApi.list(), constraintsApi.list(),
      ]);
      setScenarios(sc.data);
      setPersonas(ps.data.map(p => p.id));
      setStages(st.data);
      setObjectives(ob.data.map(o => o.id));
      setConstraints(co.data.map(c => c.id));
    } catch {
      enqueueSnackbar('Failed to load content', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [enqueueSnackbar]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const selectScenario = (s: ScenarioDefinition) => {
    setSelected({ ...s });
    const { nodes: n, edges: e } = scenarioToFlow(s);
    setNodes(n); setEdges(e);
  };

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isNew = !scenarios.find(s => s.id === selected.id);
      if (isNew) {
        await scenariosApi.create(selected);
      } else {
        await scenariosApi.update(selected.id, selected);
      }
      enqueueSnackbar('Scenario saved', { variant: 'success' });
      loadAll();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? 'Save failed', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete scenario "${id}"?`)) return;
    await scenariosApi.delete(id);
    enqueueSnackbar('Deleted', { variant: 'info' });
    if (selected?.id === id) setSelected(null);
    loadAll();
  };

  const handleDuplicate = async (id: string) => {
    await scenariosApi.duplicate(id);
    enqueueSnackbar('Duplicated', { variant: 'success' });
    loadAll();
  };

  const createNew = async () => {
    if (!newId.trim()) return;
    const s: ScenarioDefinition = { ...EMPTY_SCENARIO, id: newId.trim(), display_name: newName || newId };
    selectScenario(s);
    setNewDialog(false);
    setNewId(''); setNewName('');
  };

  const filtered = scenarios.filter(s =>
    s.display_name.toLowerCase().includes(search.toLowerCase()) ||
    s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell onReload={loadAll}>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* LEFT — scenario list */}
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small" fullWidth placeholder="Search scenarios…"
              value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}><CircularProgress size={20} /></Box>}
            <List dense disablePadding>
              {filtered.map(s => (
                <ListItemButton
                  key={s.id}
                  selected={selected?.id === s.id}
                  onClick={() => selectScenario(s)}
                  sx={{ pr: 0.5 }}
                >
                  <ListItemText
                    primary={s.display_name}
                    secondary={s.id}
                    slotProps={{
                      primary: {
                        sx: {
                          fontWeight: 700,
                          fontSize: "0.9rem",
                        },
                        noWrap:true
                      },
                      secondary: {
                        sx: {
                          fontSize: '0.7rem',
                        },
                        noWrap:true
                      }
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.25, opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 } }}>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={e => { e.stopPropagation(); handleDuplicate(s.id); }}>
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(s.id); }}>
                        <DeleteIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                  </Box>
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>
              New Scenario
            </Button>
          </Box>
        </Box>

        {/* CENTER — editor */}
        {selected ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600,  flex: 1 }}>{selected.display_name}</Typography>
              <Chip label={selected.difficulty} size="small"
                color={selected.difficulty === 'Hard' ? 'error' : selected.difficulty === 'Medium' ? 'warning' : 'success'}
              />
              <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />} onClick={save} disabled={saving}>
                Save
              </Button>
            </Box>

            <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
              <Tab label="Properties" icon={<CodeIcon fontSize="small" />} iconPosition="start" />
              <Tab label="Stage Graph" icon={<AccountTreeIcon fontSize="small" />} iconPosition="start" />
              <Tab label="JSON Preview" />
            </Tabs>

            {tab === 0 && (
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth label="ID" value={selected.id}
                      onChange={e => setSelected({ ...selected, id: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField fullWidth label="Display Name" value={selected.display_name}
                      onChange={e => setSelected({ ...selected, display_name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField fullWidth multiline rows={2} label="Description" value={selected.description}
                      onChange={e => setSelected({ ...selected, description: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Difficulty</InputLabel>
                      <Select value={selected.difficulty} label="Difficulty"
                        onChange={e => setSelected({ ...selected, difficulty: e.target.value as any })}>
                        <MenuItem value="Easy">Easy</MenuItem>
                        <MenuItem value="Medium">Medium</MenuItem>
                        <MenuItem value="Hard">Hard</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Persona</InputLabel>
                      <Select value={selected.persona} label="Persona"
                        onChange={e => setSelected({ ...selected, persona: e.target.value })}>
                        {personas.map(p => <MenuItem key={p} value={p}>{p}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Starting Stage</InputLabel>
                      <Select value={selected.starting_stage} label="Starting Stage"
                        onChange={e => setSelected({ ...selected, starting_stage: e.target.value })}>
                        {stages.map(s => <MenuItem key={s.id} value={s.id}>{s.display_name}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h6" gutterBottom>Stage Sequence</Typography>
                    {selected.stage_sequence.map((step, i) => (
                      <Paper key={i} variant="outlined" sx={{ p: 1.5, mb: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                          <Typography variant="body2" sx={{ fontWeight: 600,  flex: 1 }}>
                            Step {i + 1}: {step.stage}
                          </Typography>
                          <IconButton size="small" color="error"
                            onClick={() => setSelected({
                              ...selected,
                              stage_sequence: selected.stage_sequence.filter((_, j) => j !== i)
                            })}>
                            <DeleteIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Objectives: {step.objectives.join(', ') || 'none'} |{' '}
                          Constraints: {step.constraints.join(', ') || 'none'}
                        </Typography>
                      </Paper>
                    ))}
                    <Button size="small" startIcon={<AddIcon />}
                      onClick={() => setSelected({
                        ...selected,
                        stage_sequence: [...selected.stage_sequence, { stage: stages[0]?.id ?? '', objectives: [], constraints: [] }]
                      })}>
                      Add Stage Step
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ flex: 1, position: 'relative' }}>
                <ReactFlow
                  nodes={nodes} edges={edges}
                  onNodesChange={onNodesChange} onEdgesChange={onEdgesChange}
                  fitView
                >
                  <Background color="#30363d" />
                  <Controls />
                  <MiniMap style={{ background: '#161b22' }} />
                </ReactFlow>
              </Box>
            )}

            {tab === 2 && (
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography component="pre" sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                    {JSON.stringify(selected, null, 2)}
                  </Typography>
                </Paper>
              </Box>
            )}
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <AccountTreeIcon sx={{ fontSize: 64, opacity: 0.15 }} />
            <Typography color="text.secondary">Select a scenario or create a new one</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>
              New Scenario
            </Button>
          </Box>
        )}
      </Box>

      {/* New Scenario dialog */}
      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Scenario</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Scenario ID" value={newId} onChange={e => setNewId(e.target.value)}
            helperText="Lowercase, underscores only. e.g. helpful_stranger" />
          <TextField label="Display Name" value={newName} onChange={e => setNewName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createNew} disabled={!newId.trim()}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
