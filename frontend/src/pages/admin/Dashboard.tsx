import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Grid, Paper, Typography, Chip, CircularProgress, Alert, Button, Divider } from '@mui/material';
import ScenarioIcon from '@mui/icons-material/Article';
import PersonaIcon from '@mui/icons-material/Person';
import StageIcon from '@mui/icons-material/AccountTree';
import ObjectiveIcon from '@mui/icons-material/TrackChanges';
import ConstraintIcon from '@mui/icons-material/Shield';
import PromptIcon from '@mui/icons-material/Code';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
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

export function Dashboard() {
  const navigate = useNavigate();
  const { data: summary, isLoading, error } = useGetSummaryQuery();
  const [triggerValidation, { data: validationResult, isFetching: validating }] = useLazyValidateAllQuery();

  return (
    <AppShell>
      <Box sx={{ p: 3, maxWidth: 1100, mx: 'auto' }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>
            Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Safe Quest Scenario Authoring Platform — content overview
          </Typography>
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
            {/* Stats */}
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

            {/* Scenarios list */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2 }}>
              <Typography variant="h6" sx={{ flex: 1, fontWeight: 600 }}>
                Scenarios
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
                  ? 'All content is valid.'
                  : `${validationResult.errors.length} error(s), ${validationResult.warnings.length} warning(s) found.`}
              </Alert>
            )}

            <Grid container spacing={1.5}>
              {summary.scenarios.map((s) => (
                <Grid key={s.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      '&:hover': { borderColor: 'primary.main' },
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
                      {s.id}
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
