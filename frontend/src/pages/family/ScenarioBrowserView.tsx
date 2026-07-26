import { useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Drawer,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
  useTheme,
  alpha,
} from '@mui/material';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import QrCodeOutlinedIcon from '@mui/icons-material/QrCodeOutlined';
import StarOutlinedIcon from '@mui/icons-material/StarOutlined';
import type { FamilyScenarioQuery, PublishedFamilyScenario, RenderSkin } from '@/types';
import { toScenarioCardViewModel } from './scenarioBrowserViewModels';

const categories = ['grooming', 'cyberbullying', 'scam', 'image_request', 'oversharing'];
const difficulties = ['Easy', 'Medium', 'Hard'];
const skins: RenderSkin[] = ['chat', 'email', 'social_feed'];

const label = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter: string) => letter.toUpperCase());

const getSkinIcon = (skin: RenderSkin) => {
  switch (skin) {
    case 'chat':
      return <ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 16 }} />;
    case 'email':
      return <MailOutlinedIcon sx={{ fontSize: 16 }} />;
    case 'social_feed':
      return <DynamicFeedIcon sx={{ fontSize: 16 }} />;
  }
};

export interface ScenarioBrowserViewProps {
  items: PublishedFamilyScenario[];
  total: number;
  page: number;
  input: string;
  onInputChange: (value: string) => void;
  category: string[];
  onToggleCategory: (value: string) => void;
  difficulty: string[];
  onToggleDifficulty: (value: string) => void;
  renderSkin: RenderSkin[];
  onToggleSkin: (value: RenderSkin) => void;
  sort: FamilyScenarioQuery['sort'];
  onSortChange: (value: FamilyScenarioQuery['sort']) => void;
  onPageChange: (value: number) => void;
  filtered: boolean;
  onClearFilters: () => void;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
  queryStatus?: number | string;
  onRefetch: () => void;
  selected: PublishedFamilyScenario | null;
  onSelectScenario: (item: PublishedFamilyScenario | null) => void;
  onStartSolo: () => void;
  creating: boolean;
  createError: boolean;
}

export function ScenarioBrowserView({
  items,
  total,
  page,
  input,
  onInputChange,
  category,
  onToggleCategory,
  difficulty,
  onToggleDifficulty,
  renderSkin,
  onToggleSkin,
  sort,
  onSortChange,
  onPageChange,
  filtered,
  onClearFilters,
  isLoading,
  isFetching,
  isError,
  queryStatus,
  onRefetch,
  selected,
  onSelectScenario,
  onStartSolo,
  creating,
  createError,
}: ScenarioBrowserViewProps) {
  const theme = useTheme();
  const [drawer, setDrawer] = useState(false);
  const [participationChoice, setParticipationChoice] = useState<'solo_with_companion' | 'family_invite' | 'join_family'>('solo_with_companion');

  const featured = useMemo(() => items[0] ?? null, [items]);

  const filterControls = (
    <Stack spacing={2.5} sx={{ p: { xs: 2.5, md: 0 } }}>
      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Difficulty Level
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {difficulties.map((value) => (
            <Chip
              key={value}
              label={value}
              clickable
              color={difficulty.includes(value) ? 'primary' : 'default'}
              variant={difficulty.includes(value) ? 'filled' : 'outlined'}
              onClick={() => onToggleDifficulty(value)}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
          Format & Platform Skin
        </Typography>
        <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
          {skins.map((value) => (
            <Chip
              key={value}
              icon={getSkinIcon(value)}
              label={label(value)}
              clickable
              color={renderSkin.includes(value) ? 'primary' : 'default'}
              variant={renderSkin.includes(value) ? 'filled' : 'outlined'}
              onClick={() => onToggleSkin(value)}
              sx={{ fontWeight: 600 }}
            />
          ))}
        </Stack>
      </Box>

      <FormControl size="small" fullWidth>
        <InputLabel id="sort-label">Sort scenarios</InputLabel>
        <Select
          labelId="sort-label"
          label="Sort scenarios"
          value={sort}
          onChange={(event) => onSortChange(event.target.value as FamilyScenarioQuery['sort'])}
        >
          <MenuItem value="newest">Newest First</MenuItem>
          <MenuItem value="title">Title (A-Z)</MenuItem>
          <MenuItem value="difficulty">Difficulty Level</MenuItem>
          <MenuItem value="shortest">Shortest Length</MenuItem>
        </Select>
      </FormControl>

      {filtered && (
        <Button variant="outlined" color="inherit" onClick={onClearFilters} fullWidth>
          Clear all filters
        </Button>
      )}
    </Stack>
  );

  return (
    <Container maxWidth="xl" sx={{ py: { xs: 3, sm: 5 } }}>
      {/* Intro Header */}
      <Box sx={{ mb: 4 }}>
        <Typography component="h1" variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.02em' }}>
          Explore Together
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1, maxWidth: 700, fontSize: '1.05rem', lineHeight: 1.5 }}>
          Reviewed situations for thoughtful family conversations. There are no scores or right-answer tests here.
        </Typography>
      </Box>

      {/* Featured Banner (if available & no filter active) */}
      {!filtered && featured && !isLoading && !isError && (
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: { xs: 2.5, sm: 4 },
            mb: 4,
            borderRadius: 4,
            background: theme.palette.mode === 'dark'
              ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.9) 100%)'
              : 'linear-gradient(135deg, rgba(239, 246, 255, 0.9) 0%, rgba(240, 253, 244, 0.9) 100%)',
            borderColor: alpha(theme.palette.primary.main, 0.3),
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', md: 'center' } }}>
            <Box sx={{ maxWidth: 700 }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
                <Chip icon={<StarOutlinedIcon sx={{ fontSize: 16 }} />} label="Featured Scenario" size="small" color="primary" sx={{ fontWeight: 700 }} />
                <Chip size="small" label={label(featured.category)} variant="outlined" />
                <Chip size="small" label={featured.difficulty} variant="outlined" />
              </Stack>
              <Typography variant="h3" component="h2" sx={{ fontWeight: 800 }}>
                {featured.title}
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 1, fontSize: '0.95rem', lineHeight: 1.6 }}>
                {featured.summary}
              </Typography>
            </Box>
            <Button
              variant="contained"
              size="large"
              startIcon={<PlayArrowIcon />}
              onClick={() => onSelectScenario(featured)}
              aria-label={`Start featured activity for ${featured.title}`}
              sx={{ borderRadius: 3, px: 3, py: 1.2, fontWeight: 700, whitespace: 'nowrap' }}
            >
              Start Featured Activity
            </Button>
          </Stack>
        </Paper>
      )}

      {/* Toolbar: Search, Filters, Category Tabs */}
      <Stack spacing={2} sx={{ mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: 'center' }}>
          <TextField
            fullWidth
            label="Search reviewed scenarios"
            value={input}
            onChange={(event) => onInputChange(event.target.value)}
            placeholder="Try privacy, pressure, or friendship"
            slotProps={{
              input: {
                startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} />,
              },
            }}
          />

          <Button
            variant="outlined"
            startIcon={<FilterListIcon />}
            onClick={() => setDrawer(true)}
            sx={{ display: { xs: 'flex', md: 'none' }, whiteSpace: 'nowrap', width: { xs: '100%', sm: 'auto' } }}
          >
            Filters
          </Button>
        </Stack>

        {/* Category Pills */}
        <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 0.5, flexWrap: { xs: 'nowrap', md: 'wrap' } }}>
          <Button
            size="small"
            variant={category.length === 0 ? 'contained' : 'outlined'}
            onClick={onClearFilters}
            sx={{ borderRadius: '20px', px: 2, whiteSpace: 'nowrap' }}
          >
            All Categories
          </Button>
          {categories.map((value) => {
            const active = category.includes(value);
            return (
              <Button
                key={value}
                size="small"
                variant={active ? 'contained' : 'outlined'}
                onClick={() => onToggleCategory(value)}
                sx={{ borderRadius: '20px', px: 2, whiteSpace: 'nowrap' }}
              >
                {label(value)}
              </Button>
            );
          })}
        </Stack>

        {/* Desktop Filter Toolbar */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
            {filterControls}
          </Paper>
        </Box>
      </Stack>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={drawer} onClose={() => setDrawer(false)}>
        <Box sx={{ width: 320 }} role="dialog" aria-label="Scenario filters">
          <Typography variant="h6" sx={{ p: 2.5, pb: 0, fontWeight: 700 }}>
            Filter Scenarios
          </Typography>
          {filterControls}
        </Box>
      </Drawer>

      {/* Live Result Counter */}
      <Typography aria-live="polite" sx={{ mt: 2, mb: 2.5, fontWeight: 600, color: 'text.secondary' }}>
        {isFetching ? 'Updating scenarios…' : `${total} reviewed ${total === 1 ? 'scenario' : 'scenarios'} found`}
      </Typography>

      {/* States: Error, Loading, Empty, Grid */}
      {isError ? (
        <Alert
          severity="error"
          action={
            <Button color="inherit" onClick={onRefetch}>
              Try again
            </Button>
          }
          sx={{ borderRadius: 3 }}
        >
          {queryStatus === 'FETCH_ERROR'
            ? 'You appear to be offline. Reconnect and try again.'
            : queryStatus === 401
            ? 'Your session has ended. Please sign in again.'
            : 'The reviewed scenario library could not be loaded.'}
        </Alert>
      ) : isLoading ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
          {[1, 2, 3, 4, 5, 6].map((item) => (
            <Skeleton key={item} variant="rounded" height={280} sx={{ borderRadius: 4 }} />
          ))}
        </Box>
      ) : total === 0 ? (
        <Alert
          severity="info"
          action={
            filtered ? (
              <Button color="inherit" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
          sx={{ borderRadius: 3 }}
        >
          {filtered
            ? 'No reviewed scenarios match these filters yet.'
            : 'Reviewed scenarios are being prepared. In the meantime, talk together about privacy, pressure, kindness, and asking a trusted adult for help.'}
        </Alert>
      ) : (
        <>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 3 }}>
            {items.map((item) => {
              const vm = toScenarioCardViewModel(item);
              return (
                <Card
                  key={item.id}
                  variant="outlined"
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    borderRadius: 4,
                    borderColor: theme.palette.divider,
                    transition: 'all 0.2s ease-in-out',
                    '&:hover': {
                      borderColor: theme.palette.primary.main,
                      boxShadow: theme.palette.mode === 'dark' ? '0 12px 24px rgba(0,0,0,0.3)' : '0 12px 24px rgba(0,0,0,0.06)',
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, p: 2.5 }}>
                    <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', mb: 1.5 }}>
                      <Chip size="small" label={vm.categoryLabel} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                      <Chip size="small" label={item.difficulty} variant="outlined" />
                      <Chip size="small" icon={getSkinIcon(item.render_skin)} label={label(item.render_skin)} variant="outlined" />
                    </Stack>

                    <Typography variant="h5" component="h2" sx={{ fontWeight: 700, mb: 1 }}>
                      {vm.title}
                    </Typography>

                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, lineHeight: 1.5 }}>
                      {item.summary}
                    </Typography>

                    <Stack spacing={1} sx={{ mt: 'auto' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                        Learning Goals:
                      </Typography>
                      <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap' }}>
                        {item.learning_objectives.map((obj, i) => (
                          <Chip key={i} label={obj} size="small" sx={{ fontSize: '0.7rem', bgcolor: alpha(theme.palette.text.primary, 0.05) }} />
                        ))}
                      </Stack>

                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5 }}>
                        {vm.durationLabel} · {item.message_count} messages · {item.checkpoint_count} discussion pauses
                      </Typography>
                    </Stack>
                  </CardContent>

                  <CardActions sx={{ p: 2.5, pt: 0 }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      onClick={() => onSelectScenario(item)}
                      aria-label={`Learn more about ${item.title}`}
                      sx={{ borderRadius: 2.5, fontWeight: 600 }}
                    >
                      Learn more / start
                    </Button>
                  </CardActions>
                </Card>
              );
            })}
          </Box>

          {/* Pagination */}
          <Stack direction="row" spacing={2} sx={{ mt: 4, justifyContent: 'center', alignItems: 'center' }}>
            <Button variant="outlined" disabled={page === 1} onClick={() => onPageChange(page - 1)} sx={{ borderRadius: 2 }}>
              Previous
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
              Page {page} of {Math.max(1, Math.ceil(total / 12))}
            </Typography>
            <Button variant="outlined" disabled={page * 12 >= total} onClick={() => onPageChange(page + 1)} sx={{ borderRadius: 2 }}>
              Next
            </Button>
          </Stack>
        </>
      )}

      {/* Scenario Setup Modal */}
      <Dialog open={Boolean(selected)} onClose={() => !creating && onSelectScenario(null)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 800, pr: 6 }}>{selected?.title}</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5}>
            <Box>
              <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                {selected?.summary}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
              {selected && <Chip label={label(selected.category)} color="primary" size="small" />}
              {selected && <Chip label={`${selected.difficulty} difficulty`} size="small" />}
              {selected && <Chip icon={getSkinIcon(selected.render_skin)} label={`${label(selected.render_skin)} skin`} size="small" />}
            </Stack>

            <Box sx={{ p: 2, borderRadius: 3, bgcolor: alpha(theme.palette.primary.main, 0.06), border: `1px solid ${alpha(theme.palette.primary.main, 0.2)}` }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, color: 'primary.main' }}>
                What you will explore together
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selected?.learning_objectives.join(' · ')}
              </Typography>
            </Box>

            {/* Participation Choice Selector */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.5 }}>
                Choose Participation Mode
              </Typography>

              <Stack spacing={1.5}>
                {/* Mode 1: Solo with Companion */}
                <Paper
                  variant="outlined"
                  onClick={() => setParticipationChoice('solo_with_companion')}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    cursor: 'pointer',
                    borderColor: participationChoice === 'solo_with_companion' ? 'primary.main' : theme.palette.divider,
                    bgcolor: participationChoice === 'solo_with_companion' ? alpha(theme.palette.primary.main, 0.08) : 'transparent',
                    transition: 'all 0.15s ease-in-out',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <SmartToyOutlinedIcon color="primary" sx={{ mt: 0.2 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Solo Activity with AI Companion (Available Now)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Walk through the scenario with real-time guidance from your supportive Safe Quest AI companion.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Mode 2: Family Invite */}
                <Paper
                  variant="outlined"
                  onClick={() => setParticipationChoice('family_invite')}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    opacity: 0.75,
                    cursor: 'pointer',
                    borderColor: participationChoice === 'family_invite' ? 'primary.main' : theme.palette.divider,
                    bgcolor: participationChoice === 'family_invite' ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <PeopleOutlinedIcon color="action" sx={{ mt: 0.2 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Invite Family Member (Cooperative Lobby)
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Family invitations will appear here once linked family profiles are configured.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>

                {/* Mode 3: Join Existing Session */}
                <Paper
                  variant="outlined"
                  onClick={() => setParticipationChoice('join_family')}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    opacity: 0.75,
                    cursor: 'pointer',
                    borderColor: participationChoice === 'join_family' ? 'primary.main' : theme.palette.divider,
                    bgcolor: participationChoice === 'join_family' ? alpha(theme.palette.primary.main, 0.04) : 'transparent',
                  }}
                >
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <QrCodeOutlinedIcon color="action" sx={{ mt: 0.2 }} />
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Join Active Session
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Join codes and active session links will appear here once accounts can be linked.
                      </Typography>
                    </Box>
                  </Stack>
                </Paper>
              </Stack>
            </Box>

            {createError && <Alert severity="error">The solo session could not be started. Please try again.</Alert>}
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => onSelectScenario(null)} disabled={creating} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={onStartSolo}
            disabled={creating}
            startIcon={creating ? undefined : <PlayArrowIcon />}
            sx={{ borderRadius: 2.5, px: 3, fontWeight: 700 }}
          >
            {creating ? 'Starting session…' : 'Start solo activity'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
