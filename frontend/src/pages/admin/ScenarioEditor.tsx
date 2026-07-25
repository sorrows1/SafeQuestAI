import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  TextField,
  Button,
  Chip,
  CircularProgress,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tabs,
  Tab,
  Grid,
  Autocomplete,
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SearchIcon from '@mui/icons-material/Search';
import CodeIcon from '@mui/icons-material/Code';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import SaveIcon from '@mui/icons-material/Save';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useSnackbar } from 'notistack';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ReactFlow, { Background, Controls, MiniMap, useNodesState, useEdgesState } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  useListScenariosQuery,
  useListPersonasQuery,
  useListStagesQuery,
  useListObjectivesQuery,
  useListConstraintsQuery,
  useListPromptsQuery,
  useCreateScenarioMutation,
  useUpdateScenarioMutation,
  useDeleteScenarioMutation,
  useDuplicateScenarioMutation,
} from '@/store/api';
import type { ScenarioDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY_SCENARIO: ScenarioDefinition = {
  id: '',
  display_name: '',
  description: '',
  difficulty: 'Medium',
  starting_stage: '',
  version: '1.0.0',
  tags: [],
  learning_objectives: [],
  stage_sequence: [],
  difficulty_modifiers: {},
  category: 'grooming',
  render_skin: 'chat',
  generation_mode: 'dual_agent',
};

function scenarioToFlow(scenario: ScenarioDefinition) {
  const nodes = scenario.stage_sequence.map((step, i) => ({
    id: step.stage,
    data: { label: step.stage, objectives: step.mandatory_objectives.length + step.optional_objectives.length },
    position: { x: 200 * (i % 3), y: 150 * Math.floor(i / 3) },
    style: {
      background: '#21262d',
      border: '1px solid #30363d',
      borderRadius: 8,
      color: '#e6edf3',
      fontSize: 12,
      padding: 10,
      minWidth: 140,
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

function SortableStageStep({
  step,
  index,
  onDelete,
  onUpdate,
  objectives,
  constraints,
}: {
  step: any;
  index: number;
  onDelete: (idx: number) => void;
  onUpdate: (idx: number, step: any) => void;
  objectives: any[];
  constraints: any[];
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: `step-${index}` });
  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <Paper ref={setNodeRef} style={style} variant="outlined" sx={{ p: 1.5, mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <IconButton {...attributes} {...listeners} size="small" sx={{ cursor: 'grab' }}>
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
        <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
          Step {index + 1}: {step.stage}
        </Typography>
        <IconButton size="small" color="error" onClick={() => onDelete(index)}>
          <DeleteIcon sx={{ fontSize: 14 }} />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mt: 1 }}>
        <Autocomplete
          multiple
          size="small"
          options={objectives.filter((o) => !step.mandatory_objectives.includes(o.id) && !step.optional_objectives.includes(o.id))}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.display_name} (${opt.id})`)}
          value={step.mandatory_objectives.map((id: string) => objectives.find((o) => o.id === id) || id)}
          onChange={(_, val) => onUpdate(index, { ...step, mandatory_objectives: val.map((v: any) => (typeof v === 'string' ? v : v.id)) })}
          renderInput={(params) => <TextField {...params} label="Mandatory Objectives" />}
        />
        <Autocomplete
          multiple
          size="small"
          options={objectives.filter((o) => !step.mandatory_objectives.includes(o.id) && !step.optional_objectives.includes(o.id))}
          getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.display_name} (${opt.id})`)}
          value={step.optional_objectives.map((id: string) => objectives.find((o) => o.id === id) || id)}
          onChange={(_, val) => onUpdate(index, { ...step, optional_objectives: val.map((v: any) => (typeof v === 'string' ? v : v.id)) })}
          renderInput={(params) => <TextField {...params} label="Optional Objectives" />}
        />
      </Box>
      <Autocomplete
        multiple
        size="small"
        options={constraints}
        getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.id} — ${opt.description}`)}
        value={step.constraints.map((id: string) => constraints.find((item) => item.id === id) || id)}
        onChange={(_, val) => onUpdate(index, { ...step, constraints: val.map((value: any) => (typeof value === 'string' ? value : value.id)) })}
        renderInput={(params) => (
          <TextField {...params} label="Safety constraints (required)" helperText="Constraints are explicit per stage, not hidden JSON." />
        )}
      />
    </Paper>
  );
}

export function ScenarioEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const { id: urlId } = useParams<{ id?: string }>();
  const [selected, setSelected] = useState<ScenarioDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0);
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  // ── RTK Query ──────────────────────────────────────────────────────────────
  const { data: scenarios = [], isLoading } = useListScenariosQuery();
  const { data: personaList = [] } = useListPersonasQuery();
  const { data: stageList = [] } = useListStagesQuery();
  const { data: objectiveList = [] } = useListObjectivesQuery();
  const { data: constraintList = [] } = useListConstraintsQuery();
  const { data: promptList = [] } = useListPromptsQuery();

  const [createScenario, { isLoading: creating }] = useCreateScenarioMutation();
  const [updateScenario, { isLoading: updating }] = useUpdateScenarioMutation();
  const [deleteScenario] = useDeleteScenarioMutation();
  const [duplicateScenario] = useDuplicateScenarioMutation();

  const saving = creating || updating;

  const stages = stageList;

  const bindingIssues = selected
    ? (() => {
        const bindings: Array<[string, ScenarioDefinition['initiator']]> =
          selected.generation_mode === 'single_pass'
            ? [['authoring', selected.authoring]]
            : [
                ['initiator', selected.initiator],
                ['respondent', selected.respondent],
              ];
        return bindings.flatMap(([role, binding]) => {
          if (!binding?.persona_id || !binding.dialogue_prompt_id) return [`${role} persona and dialogue prompt are required`];
          if (!personaList.some((persona) => persona.id === binding.persona_id)) return [`${role} persona reference is missing`];
          const prompt = promptList.find((entry) => entry.name === binding.dialogue_prompt_id);
          if (!prompt) return [`${role} dialogue prompt reference is missing`];
          if (prompt.kind === 'system' || !(prompt.role_scope === role || prompt.role_scope === 'either'))
            return [`${role} prompt has an incompatible kind or role scope`];
          return [];
        });
      })()
    : [];

  useEffect(() => {
    if (urlId && scenarios.length > 0 && !selected) {
      const match = scenarios.find((s) => s.id === urlId);
      if (match) {
        selectScenario(match);
      }
    }
  }, [urlId, scenarios, selected]);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const selectScenario = (s: ScenarioDefinition) => {
    setSelected({ ...s });
    const { nodes: n, edges: e } = scenarioToFlow(s);
    setNodes(n);
    setEdges(e);
  };

  const save = async () => {
    if (!selected) return;
    try {
      if (bindingIssues.length) {
        enqueueSnackbar(bindingIssues[0], { variant: 'error' });
        return;
      }
      const isNew = !scenarios.find((s) => s.id === selected.id);
      if (isNew) {
        await createScenario(selected).unwrap();
      } else {
        await updateScenario({ id: selected.id, body: selected }).unwrap();
      }
      enqueueSnackbar('Scenario saved', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.data?.detail ?? 'Save failed', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete scenario "${id}"?`)) return;
    await deleteScenario(id).unwrap();
    enqueueSnackbar('Deleted', { variant: 'info' });
    if (selected?.id === id) setSelected(null);
  };

  const handleDuplicate = async (id: string) => {
    await duplicateScenario(id).unwrap();
    enqueueSnackbar('Duplicated', { variant: 'success' });
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id && selected) {
      const oldIndex = parseInt((active.id as string).split('-')[1], 10);
      const newIndex = parseInt((over.id as string).split('-')[1], 10);

      const newSeq = arrayMove(selected.stage_sequence, oldIndex, newIndex);

      // Validate transition logic
      let isValid = true;
      let errorMsg = '';
      for (let i = 0; i < newSeq.length - 1; i++) {
        const fromStage = stageList.find((s) => s.id === newSeq[i].stage);
        if (fromStage && !fromStage.allowed_next.includes(newSeq[i + 1].stage)) {
          isValid = false;
          errorMsg = `Cannot place '${newSeq[i + 1].stage}' after '${newSeq[i].stage}' because it is not in its allowed next stages.`;
          break;
        }
      }

      if (!isValid) {
        enqueueSnackbar(errorMsg, { variant: 'error' });
        return;
      }

      const updated = { ...selected, stage_sequence: newSeq };
      setSelected(updated);
      const { nodes: n, edges: e } = scenarioToFlow(updated);
      setNodes(n);
      setEdges(e);
    }
  };

  const createNew = () => {
    if (!newId.trim()) return;
    const s: ScenarioDefinition = { ...EMPTY_SCENARIO, id: newId.trim(), display_name: newName || newId };
    selectScenario(s);
    setNewDialog(false);
    setNewId('');
    setNewName('');
  };

  const filtered = scenarios.filter(
    (s) => s.display_name.toLowerCase().includes(search.toLowerCase()) || s.id.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* LEFT — scenario list */}
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search scenarios…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {isLoading && (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 2 }}>
                <CircularProgress size={20} />
              </Box>
            )}
            <List dense disablePadding>
              {filtered.map((s) => (
                <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => selectScenario(s)} sx={{ pr: 0.5 }}>
                  <ListItemText
                    primary={s.display_name}
                    secondary={s.id}
                    slotProps={{
                      primary: { sx: { fontWeight: 700, fontSize: '0.875rem' }, noWrap: true },
                      secondary: { sx: { fontSize: '0.7rem' }, noWrap: true },
                    }}
                  />
                  <Box sx={{ display: 'flex', gap: 0.25, opacity: 0, '.MuiListItemButton-root:hover &': { opacity: 1 } }}>
                    <Tooltip title="Duplicate">
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicate(s.id);
                        }}
                      >
                        <ContentCopyIcon sx={{ fontSize: 14 }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton
                        size="small"
                        color="error"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(s.id);
                        }}
                      >
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
              <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                {selected.display_name}
              </Typography>
              <Chip
                label={selected.difficulty}
                size="small"
                color={selected.difficulty === 'Hard' ? 'error' : selected.difficulty === 'Medium' ? 'warning' : 'success'}
              />
              <Button
                size="small"
                variant="contained"
                startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />}
                onClick={save}
                disabled={saving || bindingIssues.length > 0}
              >
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
                    <TextField fullWidth label="ID" value={selected.id} onChange={(e) => setSelected({ ...selected, id: e.target.value })} />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      label="Display Name"
                      value={selected.display_name}
                      onChange={(e) => setSelected({ ...selected, display_name: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      label="Description"
                      value={selected.description}
                      onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Difficulty</InputLabel>
                      <Select
                        value={selected.difficulty}
                        label="Difficulty"
                        onChange={(e) => setSelected({ ...selected, difficulty: e.target.value as any })}
                      >
                        <MenuItem value="Easy">Easy</MenuItem>
                        <MenuItem value="Medium">Medium</MenuItem>
                        <MenuItem value="Hard">Hard</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Category</InputLabel>
                      <Select
                        label="Category"
                        value={selected.category}
                        onChange={(e) => {
                          const category = e.target.value as ScenarioDefinition['category'];
                          setSelected({ ...selected, category, generation_mode: category === 'oversharing' ? 'single_pass' : 'dual_agent' });
                        }}
                      >
                        <MenuItem value="grooming">Grooming</MenuItem>
                        <MenuItem value="cyberbullying">Cyberbullying</MenuItem>
                        <MenuItem value="scam">Scam</MenuItem>
                        <MenuItem value="image_request">Image request</MenuItem>
                        <MenuItem value="oversharing">Oversharing</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Render skin</InputLabel>
                      <Select
                        label="Render skin"
                        value={selected.render_skin}
                        onChange={(e) => setSelected({ ...selected, render_skin: e.target.value as ScenarioDefinition['render_skin'] })}
                      >
                        <MenuItem value="chat">Chat</MenuItem>
                        <MenuItem value="email">Email</MenuItem>
                        <MenuItem value="social_feed">Social feed</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Generation mode</InputLabel>
                      <Select
                        label="Generation mode"
                        value={selected.generation_mode}
                        disabled={selected.category === 'oversharing'}
                        onChange={(e) => setSelected({ ...selected, generation_mode: e.target.value as ScenarioDefinition['generation_mode'] })}
                      >
                        <MenuItem value="dual_agent">Dual agent</MenuItem>
                        <MenuItem value="single_pass">Single pass</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Version"
                      value={selected.version}
                      onChange={(e) => setSelected({ ...selected, version: e.target.value })}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <TextField
                      fullWidth
                      size="small"
                      label="Difficulty modifiers (JSON)"
                      value={JSON.stringify(selected.difficulty_modifiers)}
                      onChange={(e) => {
                        try {
                          setSelected({ ...selected, difficulty_modifiers: JSON.parse(e.target.value) });
                        } catch {
                          /* retain last valid object */
                        }
                      }}
                      helperText="Trust, escalation speed, and red-flag visibility modifiers."
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={[]}
                      freeSolo
                      value={selected.tags || []}
                      onChange={(_, val) => setSelected({ ...selected, tags: val })}
                      renderInput={(params) => <TextField {...params} label="Tags" placeholder="Add tag..." />}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Autocomplete
                      multiple
                      size="small"
                      options={[]}
                      freeSolo
                      value={selected.learning_objectives || []}
                      onChange={(_, val) => setSelected({ ...selected, learning_objectives: val })}
                      renderInput={(params) => <TextField {...params} label="Learning Objectives" placeholder="Add objective..." />}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h6">Role setup</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Every actor uses an explicit persona and compatible dialogue prompt. Reusable system instructions are selected by the runtime.
                    </Typography>
                  </Grid>
                  {(selected.generation_mode === 'single_pass' ? ['authoring'] : ['initiator', 'respondent']).map((role) => {
                    const binding = selected[role as 'initiator' | 'respondent' | 'authoring'];
                    const promptKind = role === 'authoring' ? 'single_pass' : 'dialogue';
                    const compatible = promptList.filter(
                      (prompt) => prompt.kind === promptKind && (prompt.role_scope === role || prompt.role_scope === 'either')
                    );
                    const update = (change: Record<string, string>) =>
                      setSelected({
                        ...selected,
                        [role]: { persona_id: binding?.persona_id ?? '', dialogue_prompt_id: binding?.dialogue_prompt_id ?? '', ...change },
                      });
                    return (
                      <Grid key={role} size={{ xs: 12, md: 6 }}>
                        <Paper variant="outlined" sx={{ p: 1.5 }}>
                          <Typography variant="subtitle2" sx={{ textTransform: 'capitalize' }}>
                            {role}
                          </Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <FormControl fullWidth size="small">
                              <InputLabel>Persona</InputLabel>
                              <Select label="Persona" value={binding?.persona_id ?? ''} onChange={(e) => update({ persona_id: e.target.value })}>
                                {personaList.map((persona) => (
                                  <MenuItem key={persona.id} value={persona.id}>
                                    {persona.display_name}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                            <FormControl fullWidth size="small">
                              <InputLabel>Prompt</InputLabel>
                              <Select
                                label="Prompt"
                                value={binding?.dialogue_prompt_id ?? ''}
                                onChange={(e) => update({ dialogue_prompt_id: e.target.value })}
                              >
                                {compatible.map((prompt) => (
                                  <MenuItem key={prompt.name} value={prompt.name}>
                                    {prompt.name} · {prompt.version}
                                  </MenuItem>
                                ))}
                              </Select>
                            </FormControl>
                          </Stack>
                          <Typography variant="caption" color="text.secondary">
                            {binding?.persona_id || 'Select persona'} · {binding?.dialogue_prompt_id || 'Select compatible prompt'}
                          </Typography>
                        </Paper>
                      </Grid>
                    );
                  })}
                  {bindingIssues.length > 0 && (
                    <Grid size={{ xs: 12 }}>
                      <Paper variant="outlined" sx={{ p: 1, borderColor: 'error.main' }}>
                        <Typography color="error" variant="body2">
                          {bindingIssues.join('; ')}
                        </Typography>
                      </Paper>
                    </Grid>
                  )}
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Taxonomy and category safety checks are enforced by the backend runtime. Image-request scenarios use non-visual boundary
                      pressure only.
                    </Typography>
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Starting Stage</InputLabel>
                      <Select
                        value={selected.starting_stage}
                        label="Starting Stage"
                        onChange={(e) => setSelected({ ...selected, starting_stage: e.target.value })}
                      >
                        {stages.map((s) => (
                          <MenuItem key={s.id} value={s.id}>
                            {s.display_name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12 }}>
                    <Typography variant="h6" gutterBottom>
                      Stage Sequence
                    </Typography>
                    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                      <SortableContext items={selected.stage_sequence.map((_, i) => `step-${i}`)} strategy={verticalListSortingStrategy}>
                        {selected.stage_sequence.map((step, i) => (
                          <SortableStageStep
                            key={`step-${i}`}
                            step={step}
                            index={i}
                            objectives={objectiveList}
                            constraints={constraintList}
                            onDelete={(idx) => {
                              setSelected({
                                ...selected,
                                stage_sequence: selected.stage_sequence.filter((_, j) => j !== idx),
                              });
                            }}
                            onUpdate={(idx, newStep) => {
                              const newSeq = [...selected.stage_sequence];
                              newSeq[idx] = newStep;
                              setSelected({ ...selected, stage_sequence: newSeq });
                            }}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                    <Box sx={{ mt: 2 }}>
                      <Autocomplete
                        size="small"
                        options={stages.filter((s) => !selected.stage_sequence.find((seq) => seq.stage === s.id))}
                        getOptionLabel={(opt) => (typeof opt === 'string' ? opt : `${opt.display_name} (${opt.id})`)}
                        value={null}
                        onChange={(_, val) => {
                          if (val) {
                            setSelected({
                              ...selected,
                              stage_sequence: [
                                ...selected.stage_sequence,
                                { stage: typeof val === 'string' ? val : val.id, mandatory_objectives: [], optional_objectives: [], constraints: [] },
                              ],
                            });
                          }
                        }}
                        renderInput={(params) => <TextField {...params} label="Add Stage Step..." />}
                      />
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            )}

            {tab === 1 && (
              <Box sx={{ flex: 1, position: 'relative' }}>
                <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} fitView>
                  <Background color="#30363d" />
                  <Controls />
                  <MiniMap style={{ background: '#161b22' }} />
                </ReactFlow>
              </Box>
            )}

            {tab === 2 && (
              <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography
                    component="pre"
                    sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}
                  >
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

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Scenario</DialogTitle>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField
            label="Scenario ID"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            helperText="Lowercase, underscores only. e.g. helpful_stranger"
          />
          <TextField label="Display Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" onClick={createNew} disabled={!newId.trim()}>
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
