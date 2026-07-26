import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import ScenarioIcon from '@mui/icons-material/Article';
import PersonaIcon from '@mui/icons-material/Person';
import StageIcon from '@mui/icons-material/AccountTree';
import ObjectiveIcon from '@mui/icons-material/TrackChanges';
import ConstraintIcon from '@mui/icons-material/Shield';
import PromptIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import RateReviewIcon from '@mui/icons-material/RateReview';
import PublishIcon from '@mui/icons-material/Publish';
import ErrorIcon from '@mui/icons-material/Error';
import StorageIcon from '@mui/icons-material/Storage';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import LaunchIcon from '@mui/icons-material/Launch';
import { useGetSummaryQuery, useLazyValidateAllQuery } from '@/store/api';
import { AppShell } from '@/components/common/AppShell';

const DIFF_COLOR: Record<string, 'success' | 'warning' | 'error'> = {
  Easy: 'success',
  Medium: 'warning',
  Hard: 'error',
};

function StatCard({ icon, label, value, onClick }: { icon: React.ReactNode; label: string; value: number; onClick?: () => void }) {
  return (
    <Paper
      variant="outlined"
      onClick={onClick}
      sx={{
        p: 2.5,
        cursor: onClick ? 'pointer' : 'default',
        transition: 'all 0.15s',
        '&:hover': onClick ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
        display: 'flex',
        alignItems: 'center',
        gap: 2,
      }}
    >
      <Box
        sx={{
          width: 44,
          height: 44,
          borderRadius: 2,
          bgcolor: 'primary.main',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: 0.9,
        }}
      >
        {icon}
      </Box>
      <Box>
        <Typography sx={{ fontSize: '1.75rem', fontWeight: 700, lineHeight: 1 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Box>
    </Paper>
  );
}

function ActionCard({
  title,
  subtitle,
  count,
  color,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  count: number;
  color: 'info' | 'success' | 'warning' | 'error' | 'primary';
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Card
      variant="outlined"
      onClick={onClick}
      sx={{
        cursor: 'pointer',
        transition: 'all 0.15s ease-in-out',
        '&:hover': { borderColor: `${color}.main`, transform: 'translateY(-2px)' },
      }}
    >
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {icon}
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
              {title}
            </Typography>
          </Box>
          <Chip label={count} color={color} size="small" sx={{ fontWeight: 700, px: 0.5 }} />
        </Stack>
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          {subtitle}
        </Typography>
        <Box sx={{ mt: 1.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="primary" sx={{ fontWeight: 600 }}>
            Take action
          </Typography>
          <LaunchIcon sx={{ fontSize: 12, color: 'primary.main' }} />
        </Box>
      </CardContent>
    </Card>
  );
}

export function Dashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading, error } = useGetSummaryQuery();
  const [triggerValidation, { data: validationResult, isFetching: validating }] = useLazyValidateAllQuery();

  const obs = summary?.observability ?? {
    review_ready_count: 0,
    unpublished_approved_transcript_count: 0,
    active_run_count: 0,
    failed_run_count: 0,
    limited_run_count: 0,
    validation_blocker_count: 0,
    recently_published: [],
    system_health: { database: 'available' as const, llm: 'available' as const },
  };

  return (
    <AppShell>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
              Platform Dashboard & Observability
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Safe Quest Scenario Authoring, Simulation Observability & Operational Health
            </Typography>
          </Box>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              icon={<StorageIcon />}
              label={`Database: ${obs.system_health.database}`}
              color={obs.system_health.database === 'available' ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
            <Chip
              icon={<SmartToyIcon />}
              label={`LLM Engine: ${obs.system_health.llm}`}
              color={obs.system_health.llm === 'available' ? 'success' : 'error'}
              variant="outlined"
              size="small"
            />
          </Stack>
        </Box>

        {isLoading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load config summary. Is the backend running?
          </Alert>
        )}

        {summary && (
          <>
            {/* Operational Action Cards */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Action Required & Workflow Queues
            </Typography>

            <Grid container spacing={2} sx={{ mb: 4 }}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <ActionCard
                  title="Review Ready"
                  subtitle="Simulations waiting for admin approval or rejection decision"
                  count={obs.review_ready_count}
                  color="info"
                  icon={<RateReviewIcon color="info" fontSize="small" />}
                  onClick={() => navigate('/admin/review-queue')}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <ActionCard
                  title="Unpublished Approved"
                  subtitle="Approved transcripts ready to publish into player scenarios"
                  count={obs.unpublished_approved_transcript_count}
                  color="success"
                  icon={<PublishIcon color="success" fontSize="small" />}
                  onClick={() => navigate('/admin/review-queue')}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <ActionCard
                  title="Failed / Limited Runs"
                  subtitle="Simulations with execution failures or resource limits"
                  count={obs.failed_run_count + obs.limited_run_count}
                  color="warning"
                  icon={<WarningIcon color="warning" fontSize="small" />}
                  onClick={() => navigate('/admin/simulator')}
                />
              </Grid>

              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <ActionCard
                  title="Validation Blockers"
                  subtitle="Content definitions with syntax, broken link or schema errors"
                  count={obs.validation_blocker_count}
                  color="error"
                  icon={<ErrorIcon color="error" fontSize="small" />}
                  onClick={() => navigate('/admin/validation')}
                />
              </Grid>
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* Inventory Statistics */}
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Content Inventory Overview
            </Typography>

            <Grid container spacing={2} sx={{ mb: 4 }}>
              {[
                {
                  icon: <ScenarioIcon sx={{ color: '#fff', fontSize: 22 }} />,
                  label: 'Scenarios',
                  value: summary.scenarios.length,
                  path: '/admin/scenarios',
                },
                {
                  icon: <PersonaIcon sx={{ color: '#fff', fontSize: 22 }} />,
                  label: 'Personas',
                  value: summary.personas.length,
                  path: '/admin/personas',
                },
                { icon: <StageIcon sx={{ color: '#fff', fontSize: 22 }} />, label: 'Stages', value: summary.stages.length, path: '/admin/stages' },
                {
                  icon: <ObjectiveIcon sx={{ color: '#fff', fontSize: 22 }} />,
                  label: 'Objectives',
                  value: summary.objectives.length,
                  path: '/admin/objectives',
                },
                {
                  icon: <ConstraintIcon sx={{ color: '#fff', fontSize: 22 }} />,
                  label: 'Constraints',
                  value: summary.constraints.length,
                  path: '/admin/constraints',
                },
                {
                  icon: <PromptIcon sx={{ color: '#fff', fontSize: 22 }} />,
                  label: 'Prompt Templates',
                  value: summary.prompt_templates.length,
                  path: '/admin/prompts',
                },
              ].map((s) => (
                <Grid key={s.label} size={{ xs: 12, sm: 6, md: 4 }}>
                  <StatCard {...s} value={s.value} onClick={() => navigate(s.path)} />
                </Grid>
              ))}
            </Grid>

            <Divider sx={{ mb: 3 }} />

            {/* Recently Published & Validation Console Trigger */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
              <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
                Scenarios & Validation Status
              </Typography>
              <Button
                size="small"
                startIcon={validating ? <CircularProgress size={14} /> : <PlayArrowIcon />}
                variant="outlined"
                onClick={() => triggerValidation()}
                disabled={validating}
              >
                Validate All
              </Button>
            </Box>

            {validationResult && (
              <Alert
                severity={validationResult.valid ? 'success' : 'error'}
                icon={validationResult.valid ? <CheckCircleIcon /> : <WarningIcon />}
                sx={{ mb: 2 }}
                action={
                  <Button size="small" onClick={() => navigate('/admin/validation')}>
                    View Details
                  </Button>
                }
              >
                {validationResult.valid
                  ? 'All scenario content and prompt references are valid.'
                  : `${validationResult.errors.length} error(s), ${validationResult.warnings.length} warning(s) found.`}
              </Alert>
            )}

            <Grid container spacing={2}>
              {summary.scenarios.map((s) => (
                <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
                    }}
                    onClick={() => navigate(`/admin/scenarios/${s.id}`)}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, flex: 1 }}>
                        {s.display_name}
                      </Typography>
                      <Chip label={s.difficulty} size="small" color={DIFF_COLOR[s.difficulty]} sx={{ height: 18, fontSize: '0.65rem' }} />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                      ID: {s.id}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Box>
    </AppShell>
  );
}
