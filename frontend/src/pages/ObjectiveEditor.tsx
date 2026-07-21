import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Typography, CircularProgress, Paper, Grid, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Select, MenuItem, FormControl, InputLabel, Switch, FormControlLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import {
  useListObjectivesQuery,
  useCreateObjectiveMutation, useUpdateObjectiveMutation, useDeleteObjectiveMutation,
} from '@/store/api';
import type { ObjectiveDefinition, CompletionRuleType } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY: ObjectiveDefinition = {
  id: '', display_name: '', description: '', priority: 1, tags: [],
  completion_rule: { type: 'llm', keywords: [] },
};

export function ObjectiveEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<ObjectiveDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newTag, setNewTag] = useState('');
  const [newKeyword, setNewKeyword] = useState('');

  const { data: items = [], isLoading } = useListObjectivesQuery();
  const [createObjective, { isLoading: creating }] = useCreateObjectiveMutation();
  const [updateObjective, { isLoading: updating }] = useUpdateObjectiveMutation();
  const [deleteObjective] = useDeleteObjectiveMutation();

  const saving = creating || updating;

  const save = async () => {
    if (!selected) return;
    try {
      const isNew = !items.find(o => o.id === selected.id);
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

  const filtered = items.filter(o =>
    o.display_name.toLowerCase().includes(search.toLowerCase()) || o.id.includes(search)
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
              <Typography variant="h5" sx={{ fontWeight: 600, flex: 1 }}>{selected.display_name || selected.id}</Typography>
              <Button variant="contained" size="small" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />} onClick={save} disabled={saving}>Save</Button>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="ID" value={selected.id} onChange={e => setSelected({ ...selected, id: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Display Name" value={selected.display_name} onChange={e => setSelected({ ...selected, display_name: e.target.value })} /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} label="Description" value={selected.description} onChange={e => setSelected({ ...selected, description: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth type="number" label="Priority" value={selected.priority}
                  onChange={e => setSelected({ ...selected, priority: Number(e.target.value) })}
                  slotProps={{ htmlInput: { min: 1, max: 10 } }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth size="small">
                  <InputLabel>Completion Rule</InputLabel>
                  <Select value={selected.completion_rule.type} label="Completion Rule"
                    onChange={e => setSelected({ ...selected, completion_rule: { ...selected.completion_rule, type: e.target.value as CompletionRuleType } })}>
                    <MenuItem value="llm">LLM Evaluated</MenuItem>
                    <MenuItem value="keyword">Keyword Match</MenuItem>
                    <MenuItem value="always">Always Complete</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {selected.completion_rule.type === 'keyword' && (
                <Grid size={{ xs: 12 }}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="h6" sx={{ mb: 1 }}>Keywords</Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      {(selected.completion_rule.keywords ?? []).map(k => (
                        <Chip key={k} label={k} size="small" onDelete={() =>
                          setSelected({ ...selected, completion_rule: { ...selected.completion_rule, keywords: (selected.completion_rule.keywords ?? []).filter(x => x !== k) } })}
                        />
                      ))}
                    </Box>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField size="small" placeholder="keyword" value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && newKeyword.trim()) { setSelected({ ...selected, completion_rule: { ...selected.completion_rule, keywords: [...(selected.completion_rule.keywords ?? []), newKeyword.trim()] } }); setNewKeyword(''); } }}
                      />
                      <Button size="small" onClick={() => { if (newKeyword.trim()) { setSelected({ ...selected, completion_rule: { ...selected.completion_rule, keywords: [...(selected.completion_rule.keywords ?? []), newKeyword.trim()] } }); setNewKeyword(''); } }}>Add</Button>
                    </Box>
                  </Paper>
                </Grid>
              )}

              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="h6" sx={{ mb: 1 }}>Tags</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.tags.map(t => (
                      <Chip key={t} label={t} size="small" onDelete={() => setSelected({ ...selected, tags: selected.tags.filter(x => x !== t) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="tag" value={newTag} onChange={e => setNewTag(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newTag.trim()) { setSelected({ ...selected, tags: [...selected.tags, newTag.trim()] }); setNewTag(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newTag.trim()) { setSelected({ ...selected, tags: [...selected.tags, newTag.trim()] }); setNewTag(''); } }}>Add</Button>
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
          <TextField fullWidth label="Objective ID" value={newId} onChange={e => setNewId(e.target.value)} helperText="e.g. build_trust_phase1" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newId.trim()} onClick={() => { setSelected({ ...EMPTY, id: newId.trim(), display_name: newId }); setNewDialog(false); setNewId(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
