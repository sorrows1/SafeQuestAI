import { useState } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Typography, CircularProgress, Paper, Grid, Tooltip, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Select, MenuItem,
  FormControl, InputLabel, Switch, FormControlLabel,
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
import type { PersonaDefinition, ConversationStyle } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const EMPTY_STYLE: ConversationStyle = {
  uses_lowercase: true,
  omits_end_punctuation: true,
  emoji_frequency: 0,
  average_message_length: 'short',
  double_texts: false,
  initiates_topic_changes: false,
  uses_slang: true,
  humour: 'playful',
  response_style: 'reactive',
};

const EMPTY: PersonaDefinition = {
  id: '', display_name: '', description: '', tone: [], interests: [],
  cover_story: '', claimed_age: 18, claimed_location: '', claimed_interests: [],
  conversation_style: EMPTY_STYLE,
  background: '', manipulation_style: '', escalation_speed: 'medium',
};

export function PersonaEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [selected, setSelected] = useState<PersonaDefinition | null>(null);
  const [search, setSearch] = useState('');
  const [newDialog, setNewDialog] = useState(false);
  const [newId, setNewId] = useState('');
  const [newTone, setNewTone] = useState('');
  const [newInterest, setNewInterest] = useState('');
  const [newClaimedInterest, setNewClaimedInterest] = useState('');

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
            
            <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>Basic Info</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="ID" value={selected.id} onChange={e => setSelected({ ...selected, id: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Display Name" value={selected.display_name} onChange={e => setSelected({ ...selected, display_name: e.target.value })} /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} label="Description (Admin Only)" value={selected.description} onChange={e => setSelected({ ...selected, description: e.target.value })} /></Grid>
              <Grid size={{ xs: 12 }}><TextField fullWidth multiline rows={2} label="Background (Legacy)" value={selected.background} onChange={e => setSelected({ ...selected, background: e.target.value })} /></Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>Cover Story & World Knowledge</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12 }}><TextField fullWidth label="Cover Story" value={selected.cover_story} onChange={e => setSelected({ ...selected, cover_story: e.target.value })} helperText="Summary of who the persona claims to be." /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth type="number" label="Claimed Age" value={selected.claimed_age} onChange={e => setSelected({ ...selected, claimed_age: Number(e.target.value) })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Claimed Location" value={selected.claimed_location} onChange={e => setSelected({ ...selected, claimed_location: e.target.value })} /></Grid>
              <Grid size={{ xs: 12 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Claimed Interests</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                    {selected.claimed_interests?.map(i => (
                      <Chip key={i} label={i} size="small" onDelete={() => setSelected({ ...selected, claimed_interests: selected.claimed_interests.filter(x => x !== i) })} />
                    ))}
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <TextField size="small" placeholder="e.g. Fortnite" value={newClaimedInterest} onChange={e => setNewClaimedInterest(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && newClaimedInterest.trim()) { setSelected({ ...selected, claimed_interests: [...(selected.claimed_interests || []), newClaimedInterest.trim()] }); setNewClaimedInterest(''); } }}
                    />
                    <Button size="small" onClick={() => { if (newClaimedInterest.trim()) { setSelected({ ...selected, claimed_interests: [...(selected.claimed_interests || []), newClaimedInterest.trim()] }); setNewClaimedInterest(''); } }}>Add</Button>
                  </Box>
                </Paper>
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>Manipulation Profile</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}><TextField fullWidth label="Manipulation Style" value={selected.manipulation_style} onChange={e => setSelected({ ...selected, manipulation_style: e.target.value })} /></Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Escalation Speed</InputLabel>
                  <Select value={selected.escalation_speed} label="Escalation Speed" onChange={e => setSelected({ ...selected, escalation_speed: e.target.value as any })}>
                    <MenuItem value="slow">Slow</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="fast">Fast</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>Conversation Style</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel control={<Switch checked={selected.conversation_style?.uses_lowercase ?? true} onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, uses_lowercase: e.target.checked } })} />} label="Uses Lowercase" />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel control={<Switch checked={selected.conversation_style?.omits_end_punctuation ?? true} onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, omits_end_punctuation: e.target.checked } })} />} label="Omits End Punctuation" />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel control={<Switch checked={selected.conversation_style?.double_texts ?? false} onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, double_texts: e.target.checked } })} />} label="Double Texts" />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel control={<Switch checked={selected.conversation_style?.initiates_topic_changes ?? false} onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, initiates_topic_changes: e.target.checked } })} />} label="Initiates Topic Changes" />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <FormControlLabel control={<Switch checked={selected.conversation_style?.uses_slang ?? true} onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, uses_slang: e.target.checked } })} />} label="Uses Slang" />
              </Grid>
              
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField fullWidth type="number" label="Emoji Frequency (0.0 - 1.0)" slotProps={{ htmlInput: { step: 0.1, min: 0, max: 1 } }} value={selected.conversation_style?.emoji_frequency ?? 0} onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, emoji_frequency: Number(e.target.value) } })} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Message Length</InputLabel>
                  <Select value={selected.conversation_style?.average_message_length ?? 'short'} label="Message Length" onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, average_message_length: e.target.value as any } })}>
                    <MenuItem value="very_short">Very Short</MenuItem>
                    <MenuItem value="short">Short</MenuItem>
                    <MenuItem value="medium">Medium</MenuItem>
                    <MenuItem value="long">Long</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Humour Style</InputLabel>
                  <Select value={selected.conversation_style?.humour ?? 'playful'} label="Humour Style" onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, humour: e.target.value as any } })}>
                    <MenuItem value="none">None</MenuItem>
                    <MenuItem value="dry">Dry</MenuItem>
                    <MenuItem value="playful">Playful</MenuItem>
                    <MenuItem value="sarcastic">Sarcastic</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <FormControl fullWidth>
                  <InputLabel>Response Style</InputLabel>
                  <Select value={selected.conversation_style?.response_style ?? 'reactive'} label="Response Style" onChange={e => setSelected({ ...selected, conversation_style: { ...selected.conversation_style, response_style: e.target.value as any } })}>
                    <MenuItem value="reactive">Reactive</MenuItem>
                    <MenuItem value="proactive">Proactive</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Typography variant="h6" sx={{ mb: 2, mt: 4 }}>Legacy Display (Tone & Interests)</Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Paper variant="outlined" sx={{ p: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Tone</Typography>
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
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Interests</Typography>
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
