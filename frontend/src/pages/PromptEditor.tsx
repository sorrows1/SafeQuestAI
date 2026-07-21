import { useEffect, useState, useCallback, lazy, Suspense } from 'react';
import {
  Box, List, ListItemButton, ListItemText, IconButton, TextField, Button,
  Typography, CircularProgress, Paper, Chip, Tooltip, Dialog, DialogTitle,
  DialogContent, DialogActions, Alert,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import PreviewIcon from '@mui/icons-material/Preview';
import SearchIcon from '@mui/icons-material/Search';
import { useSnackbar } from 'notistack';
import { promptsApi } from '@/api';
import type { PromptTemplate } from '@/types';
import { AppShell } from '@/components/common/AppShell';

// Lazy-load Monaco to avoid heavy upfront bundle
const MonacoEditor = lazy(() => import('@monaco-editor/react'));

const EMPTY: PromptTemplate = { name: '', content: '', variables: [], description: '' };

export function PromptEditor() {
  const { enqueueSnackbar } = useSnackbar();
  const [items, setItems] = useState<PromptTemplate[]>([]);
  const [selected, setSelected] = useState<PromptTemplate | null>(null);
  const [search, setSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [newDialog, setNewDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [preview, setPreview] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const r = await promptsApi.list(); setItems(r.data); }
    catch { enqueueSnackbar('Failed to load', { variant: 'error' }); }
    finally { setLoading(false); }
  }, [enqueueSnackbar]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const isNew = !items.find(x => x.name === selected.name);
      if (isNew) await promptsApi.create(selected); else await promptsApi.update(selected.name, selected);
      enqueueSnackbar('Saved', { variant: 'success' }); load();
    } catch (e: any) {
      enqueueSnackbar(e?.response?.data?.detail ?? 'Save failed', { variant: 'error' });
    } finally { setSaving(false); }
  };

  const handleDelete = async (name: string) => {
    if (name === 'default_dialogue') {
      enqueueSnackbar('Cannot delete the default template', { variant: 'error' }); return;
    }
    if (!confirm(`Delete template "${name}"?`)) return;
    await promptsApi.delete(name);
    if (selected?.name === name) setSelected(null); load();
  };

  const runPreview = async () => {
    if (!selected) return;
    try {
      const vars: Record<string, string> = {};
      (selected.variables ?? []).forEach(v => { vars[v] = `[${v}]`; });
      const r = await promptsApi.preview(selected.name, vars);
      setPreview(r.data.rendered);
    } catch { enqueueSnackbar('Preview failed', { variant: 'error' }); }
  };

  const filtered = items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <AppShell onReload={load}>
      <Box sx={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
        {/* List */}
        <Box sx={{ width: 240, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
          <Box sx={{ p: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
            <TextField size="small" fullWidth placeholder="Search…" value={search} onChange={e => setSearch(e.target.value)}
              slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
            />
          </Box>
          <Box sx={{ flex: 1, overflow: 'auto' }}>
            {loading && <Box sx={{ p: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>}
            <List dense disablePadding>
              {filtered.map(t => (
                <ListItemButton key={t.name} selected={selected?.name === t.name} onClick={() => { setSelected({ ...t }); setPreview(null); }}>
                  <ListItemText primary={t.name}
                    secondary={`${t.variables?.length ?? 0} vars`}
                    slotProps={{ primary: { sx: { fontSize: '0.8125rem', fontWeight: 500 }, noWrap: true }, secondary: { sx: { fontSize: '0.7rem' } } }}
                  />
                  {t.name !== 'default_dialogue' && (
                    <Tooltip title="Delete"><IconButton size="small" color="error" onClick={e => { e.stopPropagation(); handleDelete(t.name); }}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                  )}
                </ListItemButton>
              ))}
            </List>
          </Box>
          <Box sx={{ p: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Button fullWidth size="small" startIcon={<AddIcon />} variant="outlined" onClick={() => setNewDialog(true)}>New Template</Button>
          </Box>
        </Box>

        {/* Editor */}
        {selected ? (
          <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 600,  flex: 1 }}>{selected.name}.txt</Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {(selected.variables ?? []).map(v => (
                  <Chip key={v} label={`{{${v}}}`} size="small" sx={{ fontFamily: 'monospace', height: 20, fontSize: '0.7rem' }} />
                ))}
              </Box>
              <Tooltip title="Preview with placeholder values">
                <Button size="small" startIcon={<PreviewIcon />} onClick={runPreview} variant="outlined">Preview</Button>
              </Tooltip>
              <Button size="small" variant="contained" startIcon={saving ? <CircularProgress size={12} /> : <SaveIcon />} onClick={save} disabled={saving}>Save</Button>
            </Box>

            <Box sx={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              {/* Monaco */}
              <Box sx={{ flex: 1, overflow: 'hidden' }}>
                <Suspense fallback={<Box sx={{ p: 3, display: 'flex', justifyContent: 'center' }}><CircularProgress /></Box>}>
                  <MonacoEditor
                    height="100%"
                    defaultLanguage="markdown"
                    theme="vs-dark"
                    value={selected.content}
                    onChange={v => setSelected({ ...selected, content: v ?? '' })}
                    options={{
                      minimap: { enabled: false },
                      wordWrap: 'on',
                      fontSize: 13,
                      fontFamily: "'JetBrains Mono', monospace",
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                    }}
                  />
                </Suspense>
              </Box>

              {/* Preview panel */}
              {preview && (
                <Box sx={{ width: '40%', borderLeft: '1px solid', borderColor: 'divider', overflow: 'auto', p: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", mb: 1 }}>PREVIEW</Typography>
                  <Typography component="pre" sx={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {preview}
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        ) : (
          <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 2 }}>
            <Typography color="text.secondary">Select a prompt template to edit</Typography>
          </Box>
        )}
      </Box>

      <Dialog open={newDialog} onClose={() => setNewDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>New Prompt Template</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <TextField fullWidth label="Template Name" value={newName} onChange={e => setNewName(e.target.value)} helperText="e.g. advanced_dialogue (no .txt extension)" />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewDialog(false)}>Cancel</Button>
          <Button variant="contained" disabled={!newName.trim()} onClick={() => { setSelected({ ...EMPTY, name: newName.trim() }); setNewDialog(false); setNewName(''); }}>Create</Button>
        </DialogActions>
      </Dialog>
    </AppShell>
  );
}
