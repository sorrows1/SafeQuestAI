import { useEffect, useState, useCallback } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Chip, Typography, CircularProgress, Paper, Grid, Tooltip,
  Select, MenuItem, FormControl, InputLabel, Dialog, DialogTitle,
  DialogContent, DialogActions, Slider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { objectivesApi } from '@/api';
import type { ObjectiveDefinition } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY_OBJ: ObjectiveDefinition = {
  id: '', display_name: '', description: '', priority: 5, tags: [],
  completion_rule: { type: 'llm' },
};

const ALL_TAGS = ['introduction', 'rapport', 'trust-building', 'information-gathering', 'risk', 'manipulation', 'escalation', 'platform-migration', 'grooming', 'isolation'];

export function ObjectiveEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<ObjectiveDefinition[]>([]);
  const [selected, setSelected] = useState<ObjectiveDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await objectivesApi.list(); setItems(r.data); }
    catch { enqueueSnackbar('Failed to load', { variant: 'error' }); }
    finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isNew = !items.find(x => x.id === selected.id);
      if (isNew) await objectivesApi.create(selected); else await objectivesApi.update(selected.id, selected);
      enqueueSnackbar('Saved', { variant: 'success' }); load();
    } catch (e: any) { enqueueSnackbar(e?.response?.data?.detail ?? 'Save failed', { variant: 'error' }); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(`Delete objective "${id}"?`)) return;
    await objectivesApi.delete(id);
    if (selected?.id === id) setSelected(null); load();
  };

  const toggleTag = (tag: string) => {
    if (!selected) return;
    const has = selected.tags.includes(tag);
    setSelected({ ...selected, tags: has ? selected.tags.filter(t => t !== tag) : [...selected.tags, tag] });
  };

  const filtered = items.filter(i => i.display_name.toLowerCase().includes(search.toLowerCase()) || i.id.includes(search));

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
              {filtered.map(o => (
                <ListItemButton key={o.id} selected={selected?.id === o.id} onClick={() => setSelected({ ...o })}>
                  <ListItemText primary={o.display_name} secondary={`P:${o.priority} | ${o.completion_rule.type}`}
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true }, secondary: { sx: { fontSize: '0.7rem' } } }}
                  />
                  <Tooltip title="Delete"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(o.id); }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>New Objective</Button>
          </Box>
        </Box>

        {selected ? (
          <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 1 }}>
              <Typography variant="h5" sx={{ fontWeight: 600,  flex: 1 }}>{selected.display_name || selected.id}</Typography>
              <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />} onClick={save} disabled={saving}>Save</Button>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="ID" value={selected.id} onChange={e => setSelected({ ...selected, id: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Display Name" value={selected.display_name} onChange={e => setSelected({ ...selected, display_name: e.target.value })} /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={3} label="Description" value={selected.description} onChange={e => setSelected({ ...selected, description: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="body2" gutterBottom>Priority: {selected.priority}</Typography>
                <Slider value={selected.priority} min={1} max={10} step={1} marks onChange={(_, v) => setSelected({ ...selected, priority: v as number })} />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Completion Rule</InputLabel>
                  <Select value={selected.completion_rule.type} label="Completion Rule"
                    onChange={e => setSelected({ ...selected, completion_rule: { type: e.target.value as any } })}>
                    <MenuItem value="llm">LLM (AI decides)</MenuItem>
                    <MenuItem value="keyword">Keyword Match</MenuItem>
                    <MenuItem value="always">Always Complete</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              {selected.completion_rule.type === 'keyword' && (
                <Grid size={{ xs: 12 }}>
                  <TextField fullWidth label="Keywords (comma-separated)"
                    value={selected.completion_rule.keywords?.join(', ') ?? ''}
                    onChange={e => setSelected({ ...selected, completion_rule: { ...selected.completion_rule, keywords: e.target.value.split(',').map(k => k.trim()) } })}
                  />
                </Grid>
              )}
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Tags</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {ALL_TAGS.map(t => (
                      <Chip key={t} label={t} size="small"
                        color={selected.tags.includes(t) ? 'primary' : 'default'}
                        clickable onClick={() => toggleTag(t)}
                      />
                    ))}
                  </Box>
                </Paper>
              </Grid>
            </Grid>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography color="text.secondary">Select or create an objective</Typography>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setNewDialog(true)}>New Objective</Button>
          </Box>
        )}
      </Box>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Objective</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Objective ID" value={newId} onChange={e => setNewId(e.target.value)} helperText="e.g. discover_hobby, request_platform_migration" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim()} onClick={() => { setSelected({ ...EMPTY_OBJ, id: newId.trim(), display_name: newId }); setNewDialog(false); setNewId(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
