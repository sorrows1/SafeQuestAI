import { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, List, ListItemButton, ListItemText, IconButton,
  TextField, Button, Chip, Grid, CircularProgress, Tooltip,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem, FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { stagesApi, constraintsApi } from '@/api';
import type { StageDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY_STAGE: StageDefinition = {
  id: '', display_name: '', description: '', allowed_next: [], default_constraints: [],
};

export function StageEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [stages, setStages] = useState<StageDefinition[]>([]);
  const [constraints, setConstraints] = useState<string[]>([]);
  const [selected, setSelected] = useState<StageDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [st, co] = await Promise.all([stagesApi.list(), constraintsApi.list()]);
      setStages(st.data);
      setConstraints(co.data.map(c => c.id));
    } catch { enqueueSnackbar('Failed to load', { variant: 'error' }); }
    finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isNew = !stages.find(s => s.id === selected.id);
      if (isNew) await stagesApi.create(selected);
      else await stagesApi.update(selected.id, selected);
      enqueueSnackbar('Stage saved', { variant: 'success' });
      load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? 'Save failed', { variant: 'error' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete stage "${id}"?`)) return;
    await stagesApi.delete(id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const toggleAllowedNext = (id: string) => {
    if (!selected) return;
    const has = selected.allowed_next.includes(id);
    setSelected({ ...selected, allowed_next: has ? selected.allowed_next.filter(x => x !== id) : [...selected.allowed_next, id] });
  };

  const toggleConstraint = (id: string) => {
    if (!selected) return;
    const has = selected.default_constraints.includes(id);
    setSelected({ ...selected, default_constraints: has ? selected.default_constraints.filter(x => x !== id) : [...selected.default_constraints, id] });
  };

  const filtered = stages.filter(s =>
    s.display_name.toLowerCase().includes(search.toLowerCase()) || s.id.includes(search)
  );

  return (
    <AppShell onReload={load}>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField size="small" fullWidth placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>}
            <List dense disablePadding>
              {filtered.map(s => (
                <ListItemButton key={s.id} selected={selected?.id === s.id} onClick={() => setSelected({ ...s })}>
                  <ListItemText primary={s.display_name} secondary={s.id}
                    slotProps={{
                      primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true },
                      secondary: { sx: { fontSize: '0.7rem' } }
                    }}
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
                  <Typography variant="h6" sx={{ mb: 1.5 }}>Allowed Next Stages</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {stages.map(s => (
                      <Chip key={s.id} label={s.display_name} size="small"
                        color={selected.allowed_next.includes(s.id) ? 'primary' : 'default'}
                        clickable onClick={() => toggleAllowedNext(s.id)}
                      />
                    ))}
                  </Box>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1.5 }}>Default Constraints</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {constraints.map(c => (
                      <Chip key={c} label={c} size="small"
                        color={selected.default_constraints.includes(c) ? 'error' : 'default'}
                        clickable onClick={() => toggleConstraint(c)}
                      />
                    ))}
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
          <TextField fullWidth label="Stage ID" value={newId} onChange={e => setNewId(e.target.value)} helperText="e.g. introduction, rapport, risk_assessment" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim()} onClick={() => { setSelected({ ...EMPTY_STAGE, id: newId.trim(), display_name: newId }); setNewDialog(false); setNewId(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
