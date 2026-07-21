import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Typography, CircularProgress, Paper, Grid, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import {
  useListPersonasQuery,
  useCreatePersonaMutation, useUpdatePersonaMutation, useDeletePersonaMutation,
} from '@/store/api';
import type { PersonaDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY: PersonaDefinition = {
  id: '', display_name: '', description: '', tone: [], interests: [],
  speaking_style: { emoji: false, slang: false, vocabulary_level: 'medium', sentence_length: 'medium' },
  background: '', manipulation_style: '', escalation_speed: 'gradual',
};

export function PersonaEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<PersonaDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newTone, setNewTone] = useState('');
  const [newInterest, setNewInterest] = useState('');

  const { data: items = [], isLoading } = useListPersonasQuery();
  const [createPersona, { isLoading: creating }] = useCreatePersonaMutation();
  const [updatePersona, { isLoading: updating }] = useUpdatePersonaMutation();
  const [deletePersona] = useDeletePersonaMutation();

  const saving = creating || updating;

  const save = async () => {
    if (!selected) return;
    try {
      const isNew = !items.find(p => p.id === selected.id);
      if (isNew) await createPersona(selected).unwrap();
      else await updatePersona({ id: selected.id, body: selected }).unwrap();
      enqueueSnackbar('Saved', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.data?.detail ?? 'Save failed', { variant: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete persona "${id}"?`)) return;
    await deletePersona(id).unwrap();
    if (selected?.id === id) setSelected(null);
    enqueueSnackbar('Deleted', { variant: 'info' });
  };

  const filtered = items.filter(p =>
    p.display_name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
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
              {filtered.map(p => (
                <ListItemButton key={p.id} selected={selected?.id === p.id} onClick={() => setSelected({ ...p })}>
                  <ListItemText primary={p.display_name} secondary={p.id}
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true }, secondary: { sx: { fontSize: '0.7rem' } } }}
                  />
                  <Tooltip title="Delete">
                    <IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(p.id); }}>
                      <DeleteIcon sx={{ fontSize: 14 }} />
                    </IconButton>
                  </Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>New Persona</Button>
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
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={3} label="Background" value={selected.background} onChange={e => setSelected({ ...selected, background: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Manipulation Style" value={selected.manipulation_style} onChange={e => setSelected({ ...selected, manipulation_style: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Escalation Speed</InputLabel>
                  <Select value={selected.escalation_speed} label="Escalation Speed" onChange={e => setSelected({ ...selected, escalation_speed: e.target.value })}>
                    <MenuItem value="slow">Slow</MenuItem>
                    <MenuItem value="gradual">Gradual</MenuItem>
                    <MenuItem value="fast">Fast</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Tone</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.tone.map(t => (
                      <Chip key={t} label={t} size="small" onDelete={() => setSelected({ ...selected, tone: selected.tone.filter(x => x !== t) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="e.g. friendly" value={newTone} onChange={e => setNewTone(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newTone.trim()) { setSelected({ ...selected, tone: [...selected.tone, newTone.trim()] }); setNewTone(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newTone.trim()) { setSelected({ ...selected, tone: [...selected.tone, newTone.trim()] }); setNewTone(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Interests</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.interests.map(i => (
                      <Chip key={i} label={i} size="small" onDelete={() => setSelected({ ...selected, interests: selected.interests.filter(x => x !== i) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="e.g. gaming" value={newInterest} onChange={e => setNewInterest(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newInterest.trim()) { setSelected({ ...selected, interests: [...selected.interests, newInterest.trim()] }); setNewInterest(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newInterest.trim()) { setSelected({ ...selected, interests: [...selected.interests, newInterest.trim()] }); setNewInterest(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography color="text.secondary">Select or create a persona</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>New Persona</Button>
          </Box>
        )}
      </Box>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Persona</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Persona ID" value={newId} onChange={e => setNewId(e.target.value)} helperText="e.g. friendly_stranger" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim()} onClick={() => { setSelected({ ...EMPTY, id: newId.trim(), display_name: newId }); setNewDialog(false); setNewId(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
