import { useState } from 'react';
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  IconButton,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Paper,
  Grid,
  Tooltip,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { useListObjectivesQuery, useCreateObjectiveMutation, useUpdateObjectiveMutation, useDeleteObjectiveMutation } from '@/store/api';
import type { ObjectiveDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY: ObjectiveDefinition = {
  id: '',
  display_name: '',
  description: '',
  priority: 0.5,
  hidden_intent: '',
  natural_triggers: [],
  patience: 5,
  success_signals: [],
};

function StringArrayEditor({ title, items, onChange }: { title: string; items: string[]; onChange: (items: string[]) => void }) {
  const [val, setVal] = useState('');
  return (
    <Paper variant="outlined" sx={{ p: 2, height: '100%' }}>
      <Typography variant="h6" sx={{ mb: 1 }}>
        {title}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
        {items.map((t, i) => (
          <Chip key={i} label={t} size="small" onDelete={() => onChange(items.filter((_, idx) => idx !== i))} />
        ))}
      </Box>
      <Box sx={{ display: 'flex', gap: 1 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="Add item..."
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && val.trim()) {
              onChange([...items, val.trim()]);
              setVal('');
            }
          }}
        />
        <Button
          size="small"
          onClick={() => {
            if (val.trim()) {
              onChange([...items, val.trim()]);
              setVal('');
            }
          }}
        >
          Add
        </Button>
      </Box>
    </Paper>
  );
}

export function ObjectiveEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<ObjectiveDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');

  const { data: items = [], isLoading } = useListObjectivesQuery();
  const [createObjective, { isLoading: creating }] = useCreateObjectiveMutation();
  const [updateObjective, { isLoading: updating }] = useUpdateObjectiveMutation();
  const [deleteObjective] = useDeleteObjectiveMutation();

  const saving = creating || updating;

  const save = async () => {
    if (!selected) return;
    try {
      const isNew = !items.find((o) => o.id === selected.id);
      if (isNew) await createObjective(selected).unwrap();
      else await updateObjective({ id: selected.id, body: selected }).unwrap();
      enqueueSnackbar('Saved', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.data?.detail ?? 'Save failed', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete objective "${id}"?`)) return;
    await deleteObjective(id).unwrap();
    if (selected?.id === id) setSelected(null);
    enqueueSnackbar('Deleted', { variant: 'info' });
  };

  const filtered = items.filter((o) => o.display_name.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search));

  return (
    <AppShell>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {isLoading && (
              <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}>
                <CircularProgress size={20} />
              </Box>
            )}
            <List dense disablePadding>
              {filtered.map((o) => (
                <ListItemButton key={o.id} selected={selected?.id === o.id} onClick={() => setSelected({ ...o })}>
                  <ListItemText
                    primary={o.display_name}
                    secondary={`Priority: ${o.priority} | Patience: ${o.patience}`}
                    slotProps={{
                      primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true },
                      secondary: { sx: { fontSize: '0.7rem' } },
                    }}
                  />
                  <Tooltip title="Delete">
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(o.id);
                      }}
                    >
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>
              New Objective
            </Button>
          </Box>
        </Box>

        {selected ? (
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>
                {selected.display_name || selected.id}
              </Typography>
              <Button
                variant="contained"
                size="small"
                startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />}
                onClick={save}
                disabled={saving}
              >
                Save
              </Button>
            </Box>
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
                  label="Description (Admin Only)"
                  value={selected.description}
                  onChange={(e) => setSelected({ ...selected, description: e.target.value })}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <TextField
                  fullWidth
                  multiline
                  rows={3}
                  label="Hidden Intent"
                  value={selected.hidden_intent}
                  onChange={(e) => setSelected({ ...selected, hidden_intent: e.target.value })}
                  helperText="What the LLM sees — background desire, not task"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Priority (0.0 to 1.0)"
                  value={selected.priority}
                  onChange={(e) => setSelected({ ...selected, priority: Number(e.target.value) })}
                  slotProps={{ htmlInput: { step: 0.1, min: 0, max: 1 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  type="number"
                  label="Patience (Turns)"
                  value={selected.patience}
                  onChange={(e) => setSelected({ ...selected, patience: Number(e.target.value) })}
                  slotProps={{ htmlInput: { step: 1, min: 0 } }}
                  helperText="Number of turns before urgency automatically increases"
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <StringArrayEditor
                  title="Natural Triggers"
                  items={selected.natural_triggers}
                  onChange={(v) => setSelected({ ...selected, natural_triggers: v })}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <StringArrayEditor
                  title="Success Signals"
                  items={selected.success_signals}
                  onChange={(v) => setSelected({ ...selected, success_signals: v })}
                />
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography color="text.secondary">Select or create an objective</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>
              New Objective
            </Button>
          </Box>
        )}
      </Box>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Objective</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Objective ID" value={newId} onChange={(e) => setNewId(e.target.value)} helperText="e.g. discover_name" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            disabled={!newId.trim()}
            onClick={() => {
              setSelected({ ...EMPTY, id: newId.trim(), display_name: newId });
              setNewDialog(false);
              setNewId('');
            }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
