import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Typography, CircularProgress, Paper, Grid, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import {
  useListConstraintsQuery,
  useCreateConstraintMutation, useUpdateConstraintMutation, useDeleteConstraintMutation,
} from '@/store/api';
import type { ConstraintDefinition, ViolationSeverity } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY: ConstraintDefinition = {
  id: '', description: '', forbidden_actions: [], forbidden_phrases: [], violation_severity: 'medium',
};

const SEVERITY_COLOR: Record<ViolationSeverity, 'default' | 'warning' | 'error' | 'info'> = {
  low: 'info', medium: 'warning', high: 'error', critical: 'error',
};

export function ConstraintEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<ConstraintDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newAction, setNewAction] = useState('');
  const [newPhrase, setNewPhrase] = useState('');

  const { data: items = [], isLoading } = useListConstraintsQuery();
  const [createConstraint, { isLoading: creating }] = useCreateConstraintMutation();
  const [updateConstraint, { isLoading: updating }] = useUpdateConstraintMutation();
  const [deleteConstraint] = useDeleteConstraintMutation();

  const saving = creating || updating;

  const save = async () => {
    if (!selected) return;
    try {
      const isNew = !items.find(x => x.id === selected.id);
      if (isNew) await createConstraint(selected).unwrap();
      else await updateConstraint({ id: selected.id, body: selected }).unwrap();
      enqueueSnackbar('Saved', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.data?.detail ?? 'Save failed', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete constraint "${id}"?`)) return;
    await deleteConstraint(id).unwrap();
    if (selected?.id === id) setSelected(null);
    enqueueSnackbar('Deleted', { variant: 'info' });
  };

  const filtered = items.filter(i => i.id.includes(search) || i.description.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField size="small" fullWidth placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {isLoading && <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>}
            <List dense disablePadding>
              {filtered.map(c => (
                <ListItemButton key={c.id} selected={selected?.id === c.id} onClick={() => setSelected({ ...c })}>
                  <ListItemText primary={c.id}
                    secondary={<Chip label={c.violation_severity} size="small" color={SEVERITY_COLOR[c.violation_severity]} sx={{ height: 16, fontSize: '0.65rem' }} />}
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true } }}
                  />
                  <Tooltip title="Delete"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(c.id); }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>New Constraint</Button>
          </Box>
        </Box>

        {selected ? (
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>{selected.id}</Typography>
              <Chip label={selected.violation_severity} size="small" color={SEVERITY_COLOR[selected.violation_severity]} />
              <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />} onClick={save} disabled={saving}>Save</Button>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="ID" value={selected.id} onChange={e => setSelected({ ...selected, id: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Severity</InputLabel>
                  <Select value={selected.violation_severity} label="Severity"
                    onChange={e => setSelected({ ...selected, violation_severity: e.target.value as ViolationSeverity })}>
                    <MenuItem value="low">Low</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="high">High</MenuItem>
                    <MenuItem value="critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} label="Description" value={selected.description} onChange={e => setSelected({ ...selected, description: e.target.value })} /></Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Forbidden Actions</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.forbidden_actions.map(a => (
                      <Chip key={a} label={a} size="small" onDelete={() => setSelected({ ...selected, forbidden_actions: selected.forbidden_actions.filter(x => x !== a) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="action_id" value={newAction} onChange={e => setNewAction(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newAction.trim()) { setSelected({ ...selected, forbidden_actions: [...selected.forbidden_actions, newAction.trim()] }); setNewAction(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newAction.trim()) { setSelected({ ...selected, forbidden_actions: [...selected.forbidden_actions, newAction.trim()] }); setNewAction(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Forbidden Phrases</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.forbidden_phrases.map(p => (
                      <Chip key={p} label={`"${p}"`} size="small" onDelete={() => setSelected({ ...selected, forbidden_phrases: selected.forbidden_phrases.filter(x => x !== p) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="forbidden phrase" value={newPhrase} onChange={e => setNewPhrase(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newPhrase.trim()) { setSelected({ ...selected, forbidden_phrases: [...selected.forbidden_phrases, newPhrase.trim()] }); setNewPhrase(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newPhrase.trim()) { setSelected({ ...selected, forbidden_phrases: [...selected.forbidden_phrases, newPhrase.trim()] }); setNewPhrase(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography color="text.secondary">Select or create a constraint</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>New Constraint</Button>
          </Box>
        )}
      </Box>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Constraint</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Constraint ID" value={newId} onChange={e => setNewId(e.target.value)} helperText="e.g. no_contact_request" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim()} onClick={() => { setSelected({ ...EMPTY, id: newId.trim() }); setNewDialog(false); setNewId(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
