import { useEffect, useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Grid, TextField, Button, IconButton,
  Chip, Divider, CircularProgress, List, ListItemButton, ListItemText,
  Tooltip, Dialog, DialogTitle, DialogContent, DialogActions,
  Slider, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { personasApi } from '@/api';
import type { PersonaDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY_PERSONA: PersonaDefinition = {
  id: '', display_name: '', description: '',
  tone: [], interests: [], background: '',
  manipulation_style: '', escalation_speed: 'slow',
  speaking_style: { emoji: false, slang: false, vocabulary_level: 'casual', sentence_length: 'short' },
};

const TONE_OPTIONS = ['friendly', 'casual', 'enthusiastic', 'helpful', 'knowledgeable', 'patient', 'laid_back', 'understanding', 'validating'];

export function PersonaEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [personas, setPersonas] = useState<PersonaDefinition[]>([]);
  const [selected, setSelected] = useState<PersonaDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newInterest, setNewInterest] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await personasApi.list();
      setPersonas(res.data);
    } catch { enqueueSnackbar('Failed to load personas', { variant: 'error' }); }
    finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isNew = !personas.find(p => p.id === selected.id);
      if (isNew) await personasApi.create(selected);
      else await personasApi.update(selected.id, selected);
      enqueueSnackbar('Persona saved', { variant: 'success' });
      load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? 'Save failed', { variant: 'error' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete persona "${id}"?`)) return;
    await personasApi.delete(id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const createNew = () => {
    if (!newId.trim()) return;
    setSelected({ ...EMPTY_PERSONA, id: newId.trim(), display_name: newName || newId });
    setNewDialog(false); setNewId(''); setNewName('');
  };

  const addInterest = () => {
    if (!newInterest.trim() || !selected) return;
    setSelected({ ...selected, interests: [...selected.interests, newInterest.trim()] });
    setNewInterest('');
  };

  const filtered = personas.filter(p =>
    p.display_name.toLowerCase().includes(search.toLowerCase()) || p.id.includes(search)
  );

  return (
    <AppShell onReload={load}>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* Persona list */}
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField size="small" fullWidth placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>}
            <List dense disablePadding>
              {filtered.map(p => (
                <ListItemButton key={p.id} selected={selected?.id === p.id} onClick={() => setSelected({ ...p })}>
                  <ListItemText
                    primary={p.display_name}
                    secondary={p.id}
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
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>
              New Persona
            </Button>
          </Box>
        </Box>

        {/* Editor */}
        {selected ? (
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600,  flex: 1 }}>{selected.display_name}</Typography>
              <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />}
                onClick={save} disabled={saving}>Save</Button>
            </Box>

            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Identity</Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <TextField label="ID" value={selected.id} onChange={e => setSelected({ ...selected, id: e.target.value })} />
                    <TextField label="Display Name" value={selected.display_name} onChange={e => setSelected({ ...selected, display_name: e.target.value })} />
                    <TextField label="Description" multiline rows={3} value={selected.description} onChange={e => setSelected({ ...selected, description: e.target.value })} />
                    <TextField label="Background Story" multiline rows={2} value={selected.background} onChange={e => setSelected({ ...selected, background: e.target.value })} />
                  </Box>
                </Paper>
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                  <Typography variant="h6" sx={{ mb: 2 }}>Tone Tags</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {TONE_OPTIONS.map(t => (
                      <Chip key={t} label={t} size="small"
                        color={selected.tone.includes(t) ? 'primary' : 'default'}
                        clickable
                        onClick={() => setSelected({
                          ...selected,
                          tone: selected.tone.includes(t)
                            ? selected.tone.filter(x => x !== t)
                            : [...selected.tone, t]
                        })}
                      />
                    ))}
                  </Box>
                </Paper>

                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Speaking Style</Typography>
                  <FormControlLabel control={
                    <Switch checked={selected.speaking_style.emoji}
                      onChange={e => setSelected({ ...selected, speaking_style: { ...selected.speaking_style, emoji: e.target.checked } })}
                    />} label="Uses emoji" />
                  <FormControlLabel control={
                    <Switch checked={selected.speaking_style.slang}
                      onChange={e => setSelected({ ...selected, speaking_style: { ...selected.speaking_style, slang: e.target.checked } })}
                    />} label="Uses slang" />
                </Paper>
              </Grid>

              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Interests</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1.5 }}>
                    {selected.interests.map(i => (
                      <Chip key={i} label={i} size="small" onDelete={() =>
                        setSelected({ ...selected, interests: selected.interests.filter(x => x !== i) })}
                      />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="Add interest…" value={newInterest}
                      onChange={e => setNewInterest(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addInterest()}
                    />
                    <Button variant="outlined" size="small" onClick={addInterest}>Add</Button>
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
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
          <TextField label="Persona ID" value={newId} onChange={e => setNewId(e.target.value)} />
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
