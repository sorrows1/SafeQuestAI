import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import { useNavigate } from 'react-router-dom';
import { useCreateFamilySessionMutation, useGetFamilyScenariosQuery } from '@/store/api';
import type { FamilyScenarioQuery, PublishedFamilyScenario, RenderSkin } from '@/types';
const categories = ['grooming', 'cyberbullying', 'scam', 'image_request', 'oversharing'];
const difficulties = ['Easy', 'Medium', 'Hard'];
const skins: RenderSkin[] = ['chat', 'email', 'social_feed'];
const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());
export function FamilyScenarioLobby() {
  const navigate = useNavigate();
  const [input, setInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<string[]>([]);
  const [renderSkin, setRenderSkin] = useState<RenderSkin[]>([]);
  const [sort, setSort] = useState<FamilyScenarioQuery['sort']>('newest');
  const [page, setPage] = useState(1);
  const [drawer, setDrawer] = useState(false);
  const [selected, setSelected] = useState<PublishedFamilyScenario | null>(null);
  const [detectiveMode, setDetectiveMode] = useState(false);
  const [parentUserId, setParentUserId] = useState('');
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(input.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [input]);
  const filters = useMemo<FamilyScenarioQuery>(
    () => ({
      search: search || undefined,
      category: category.length ? category : undefined,
      difficulty: difficulty.length ? difficulty : undefined,
      render_skin: renderSkin.length ? renderSkin : undefined,
      sort,
      page,
      limit: 12,
    }),
    [search, category, difficulty, renderSkin, sort, page]
  );
  const { data, isLoading, isFetching, isError, refetch } = useGetFamilyScenariosQuery(filters);
  const [createSession, { isLoading: creating, error }] = useCreateFamilySessionMutation();
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const filtered = Boolean(search || category.length || difficulty.length || renderSkin.length || sort !== 'newest');
  const toggle = <T,>(current: T[], value: T, update: (next: T[]) => void) => {
    update(current.includes(value) ? current.filter((item) => item !== value) : [...current, value]);
    setPage(1);
  };
  const clear = () => {
    setInput('');
    setSearch('');
    setCategory([]);
    setDifficulty([]);
    setRenderSkin([]);
    setSort('newest');
    setPage(1);
  };
  const open = (item: PublishedFamilyScenario) => {
    setSelected(item);
    setDetectiveMode(false);
    setParentUserId('');
  };
  const start = async () => {
    if (!selected) return;
    const session = await createSession({
      transcriptId: selected.id,
      detective_mode: detectiveMode,
      ...(parentUserId ? { parent_user_id: Number(parentUserId) } : {}),
    }).unwrap();
    navigate('/family/scenarios/' + selected.id + '/sessions/' + session.id, { state: { session } });
  };
  const controls = (
    <Stack spacing={2} sx={{ p: { xs: 2, md: 0 } }}>
      <Box>
        <Typography variant="subtitle2">Difficulty</Typography>
        {difficulties.map((value) => (
          <Chip
            key={value}
            label={value}
            clickable
            color={difficulty.includes(value) ? 'primary' : 'default'}
            onClick={() => toggle(difficulty, value, setDifficulty)}
            sx={{ mr: 1, mt: 1 }}
          />
        ))}
      </Box>
      <Box>
        <Typography variant="subtitle2">Format</Typography>
        {skins.map((value) => (
          <Chip
            key={value}
            label={label(value)}
            clickable
            color={renderSkin.includes(value) ? 'primary' : 'default'}
            onClick={() => toggle(renderSkin, value, setRenderSkin)}
            sx={{ mr: 1, mt: 1 }}
          />
        ))}
      </Box>
      <FormControl size="small" fullWidth>
        <InputLabel id="sort-label">Sort scenarios</InputLabel>
        <Select
          labelId="sort-label"
          label="Sort scenarios"
          value={sort}
          onChange={(event) => {
            setSort(event.target.value as FamilyScenarioQuery['sort']);
            setPage(1);
          }}
        >
          <MenuItem value="newest">Newest</MenuItem>
          <MenuItem value="title">Title</MenuItem>
          <MenuItem value="difficulty">Difficulty</MenuItem>
          <MenuItem value="shortest">Shortest</MenuItem>
        </Select>
      </FormControl>
      {filtered && <Button onClick={clear}>Clear filters</Button>}
    </Stack>
  );
  return (
    <Box component="main" sx={{ maxWidth: 1180, mx: 'auto', p: { xs: 2, sm: 4 } }}>
      <Typography component="h1" variant="h3">
        Explore together
      </Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Reviewed situations for thoughtful family conversations. There are no scores or right-answer tests here.
      </Typography>
      <TextField
        fullWidth
        label="Search reviewed scenarios"
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder="Try privacy, pressure, or friendship"
      />
      <Box sx={{ display: { xs: 'flex', md: 'none' }, justifyContent: 'flex-end', mt: 1 }}>
        <Button startIcon={<FilterListIcon />} onClick={() => setDrawer(true)}>
          Filters
        </Button>
      </Box>
      <Drawer anchor="right" open={drawer} onClose={() => setDrawer(false)}>
        <Box sx={{ width: 300 }} role="dialog" aria-label="Scenario filters">
          {controls}
        </Box>
      </Drawer>
      <Stack direction="row" spacing={1} sx={{ mt: 3, flexWrap: 'wrap' }}>
        {categories.map((value) => (
          <Button key={value} variant={category.includes(value) ? 'contained' : 'outlined'} onClick={() => toggle(category, value, setCategory)}>
            {label(value)}
          </Button>
        ))}
      </Stack>
      <Box sx={{ display: { xs: 'none', md: 'block' }, mt: 3 }}>{controls}</Box>
      <Typography aria-live="polite" sx={{ mt: 3, mb: 2 }}>
        {isFetching ? 'Updating scenarios…' : total + ' reviewed ' + (total === 1 ? 'scenario' : 'scenarios') + ' found'}
      </Typography>
      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={() => refetch()}>
              Try again
            </Button>
          }
        >
          The reviewed scenario library could not be loaded.
        </Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2 }}>
          {[1, 2, 3].map((item) => (
            <Skeleton key={item} variant="rounded" height={250} />
          ))}
        </Box>
      ) : total === 0 ? (
        <Alert
          severity="info"
          action={
            filtered ? (
              <Button color="inherit" onClick={clear}>
                Clear filters
              </Button>
            ) : undefined
          }
        >
          {filtered
            ? 'No reviewed scenarios match these filters yet.'
            : 'Reviewed scenarios are being prepared. In the meantime, talk together about privacy, pressure, kindness, and asking a trusted adult for help.'}
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 2 }}>
            {items.map((item) => (
              <Card key={item.id} variant="outlined">
                <CardContent>
                  <Typography variant="h6">{item.title}</Typography>
                  <Typography color="text.secondary" sx={{ mt: 1 }}>
                    {item.summary}
                  </Typography>
                  <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap' }}>
                    <Chip size="small" label={label(item.category)} />
                    <Chip size="small" label={item.difficulty} />
                    <Chip size="small" label={label(item.render_skin)} />
                  </Stack>
                  <Typography variant="body2" sx={{ mt: 2 }}>
                    {item.tags.join(' · ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    {item.learning_objectives.join(' · ')}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    {item.message_count} messages · {item.checkpoint_count} discussion pauses
                  </Typography>
                </CardContent>
                <CardActions>
                  <Button onClick={() => open(item)} aria-label={'Learn more about ' + item.title}>
                    Learn more / start
                  </Button>
                </CardActions>
              </Card>
            ))}
          </Box>
          <Stack direction="row" spacing={1} sx={{ mt: 3, justifyContent: 'center' }}>
            <Button disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
              Previous
            </Button>
            <Button disabled={page * (data?.limit ?? 12) >= total} onClick={() => setPage((value) => value + 1)}>
              Next
            </Button>
          </Stack>
        </>
      )}
      <Dialog open={Boolean(selected)} onClose={() => !creating && setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>{selected?.title}</DialogTitle>
        <DialogContent>
          <Typography>{selected?.summary}</Typography>
          <Typography variant="subtitle2" sx={{ mt: 2 }}>
            What you can explore
          </Typography>
          <Typography color="text.secondary">{selected?.learning_objectives.join(' · ')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
            Choose a trusted parent to join, or use the companion flow. Both are designed for discussion, never scoring.
          </Typography>
          <TextField
            label="Linked parent account ID (optional)"
            value={parentUserId}
            onChange={(event) => setParentUserId(event.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            fullWidth
            sx={{ mt: 2 }}
          />
          <FormControlLabel
            control={<Switch checked={detectiveMode} onChange={(event) => setDetectiveMode(event.target.checked)} />}
            label="Detective mode: select messages to discuss"
          />
          {error && <Alert severity="error">The session could not be started. Check the linked parent ID and try again.</Alert>}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={creating}>
            Cancel
          </Button>
          <Button variant="contained" onClick={start} disabled={creating || (parentUserId !== '' && !Number(parentUserId))}>
            Start discussion
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
