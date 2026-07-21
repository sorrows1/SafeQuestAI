import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Typography, CircularProgress, Paper, Grid, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import {
  useListStagesQuery,
  useCreateStageMutation, useUpdateStageMutation, useDeleteStageMutation,
} from '@/store/api';
import type { StageDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY: StageDefinition = {
  id: '', display_name: '', description: '', allowed_next: [], default_constraints: [],
};

export function StageEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<StageDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newNext, setNewNext] = useState('');
  const [newConstraint, setNewConstraint] = useState('');

  const { data: items = [], isLoading } = useListStagesQuery();
  const [createStage, { isLoading: creating }] = useCreateStageMutation();
  const [updateStage, { isLoading: updating }] = useUpdateStageMutation();
  const [deleteStage] = useDeleteStageMutation();

  const saving = creating || updating;

  const save = async () => {
    if (!selected) return;
    try {
      const isNew = !items.find(s => s.id === selected.id);
      if (isNew) await createStage(selected).unwrap();
      else await updateStage({ id: selected.id, body: selected }).unwrap();
      enqueueSnackbar('Saved', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.data?.detail ?? 'Save failed', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete stage "${id}"?`)) return;
    await deleteStage(id).unwrap();
    if (selected?.id === id) setSelected(null);
    enqueueSnackbar('Deleted', { variant: 'info' });
  };

  const filtered = items.filter(s =>
    s.display_name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  );

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
              {filtered.map(s => (
                <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => setSelected({ ...s })}>
                  <ListItemText primary={s.display_name} secondary={s.id}
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true }, secondary: { sx: { fontSize: '0.7rem' } } }}
                  />
                  <Tooltip title="Delete"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(s.id); }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>New Stage</Button>
          </Box>
        </Box>

        {selected ? (
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>{selected.display_name || selected.id}</Typography>
              <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />} onClick={save} disabled={saving}>Save</Button>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="ID" value={selected.id} onChange={e => setSelected({ ...selected, id: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Display Name" value={selected.display_name} onChange={e => setSelected({ ...selected, display_name: e.target.value })} /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={3} label="Description" value={selected.description} onChange={e => setSelected({ ...selected, description: e.target.value })} /></Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Allowed Next Stages</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.allowed_next.map(n => (
                      <Chip key={n} label={n} size="small" onDelete={() => setSelected({ ...selected, allowed_next: selected.allowed_next.filter(x => x !== n) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="stage_id" value={newNext} onChange={e => setNewNext(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newNext.trim()) { setSelected({ ...selected, allowed_next: [...selected.allowed_next, newNext.trim()] }); setNewNext(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newNext.trim()) { setSelected({ ...selected, allowed_next: [...selected.allowed_next, newNext.trim()] }); setNewNext(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Default Constraints</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.default_constraints.map(c => (
                      <Chip key={c} label={c} size="small" onDelete={() => setSelected({ ...selected, default_constraints: selected.default_constraints.filter(x => x !== c) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="constraint_id" value={newConstraint} onChange={e => setNewConstraint(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newConstraint.trim()) { setSelected({ ...selected, default_constraints: [...selected.default_constraints, newConstraint.trim()] }); setNewConstraint(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newConstraint.trim()) { setSelected({ ...selected, default_constraints: [...selected.default_constraints, newConstraint.trim()] }); setNewConstraint(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography color="text.secondary">Select or create a stage</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>New Stage</Button>
          </Box>
        )}
      </Box>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Stage</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Stage ID" value={newId} onChange={e => setNewId(e.target.value)} helperText="e.g. initial_contact" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim()} onClick={() => { setSelected({ ...EMPTY, id: newId.trim(), display_name: newId }); setNewDialog(false); setNewId(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
