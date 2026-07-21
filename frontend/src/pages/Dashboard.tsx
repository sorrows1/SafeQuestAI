import { useEffect, useState } from 'react';
import {
  Box, Grid, Paper, Typography, CircularProgress,
  Chip, Alert, LinearProgress, Divider,
} from '@mui/material';
import MovieIcon from '@mui/icons-material/Movie';
import PersonIcon from '@mui/icons-material/Person';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import SecurityIcon from '@mui/icons-material/Security';
import ArticleIcon from '@mui/icons-material/Article';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import { healthApi, validationApi } from '@/api';
import type { ConfigSummary, ValidationReport } from '@/types';
import { AppShell } from '@/components/common/AppShell';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
}

function StatCard({ label, value, icon, color }: StatCardProps) {
  return (
    <Paper variant="outlined" sx={{ p: 2.5, display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{
        width: 48, height: 48, borderRadius: 2,
        bgcolor: `${color}22`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color,
      }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>{value}</Typography>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
      </Box>
    </Paper>
  );
}

export function Dashboard() {
  const [summary, setSummary] = useState<ConfigSummary | null>(null);
  const [validation, setValidation] = useState<ValidationReport | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, v] = await Promise.all([healthApi.summary(), validationApi.validateAll()]);
      setSummary(s.data);
      setValidation(v.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return (
    <AppShell>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
        <CircularProgress />
      </Box>
    </AppShell>
  );

  return (
    <AppShell onReload={load}>
      <Box sx={{ p: 3, maxWidth: 1200, mx: 'auto' }}>
        <Typography variant="h2" gutterBottom>Overview</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Safe Quest scenario authoring platform — all content is stored as JSON files.
        </Typography>

        {/* Stats */}
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard label="Scenarios" value={summary?.scenarios.length ?? 0} icon={<MovieIcon />} color="#58a6ff" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard label="Objectives" value={summary?.objectives.length ?? 0} icon={<TrackChangesIcon />} color="#3fb950" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard label="Personas" value={summary?.personas.length ?? 0} icon={<PersonIcon />} color="#d29922" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard label="Stages" value={summary?.stages.length ?? 0} icon={<AccountTreeIcon />} color="#a371f7" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard label="Constraints" value={summary?.constraints.length ?? 0} icon={<SecurityIcon />} color="#f85149" />
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 4 }}>
            <StatCard label="Prompt Templates" value={summary?.prompt_templates.length ?? 0} icon={<ArticleIcon />} color="#58a6ff" />
          </Grid>
        </Grid>

        <Grid container spacing={2}>
          {/* Scenarios list */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 2 }}>Scenarios</Typography>
              {summary?.scenarios.length === 0 && (
                <Typography variant="body2" color="text.secondary">No scenarios found.</Typography>
              )}
              {summary?.scenarios.map(s => (
                <Box key={s.id} sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  py: 1, borderBottom: '1px solid', borderColor: 'divider',
                  '&:last-child': { borderBottom: 'none' },
                }}>
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>{s.display_name}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.id}</Typography>
                  </Box>
                  <Chip
                    label={s.difficulty}
                    size="small"
                    color={s.difficulty === 'Hard' ? 'error' : s.difficulty === 'Medium' ? 'warning' : 'success'}
                    sx={{ height: 20, fontSize: '0.7rem' }}
                  />
                </Box>
              ))}
            </Paper>
          </Grid>

          {/* Validation status */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                {validation?.valid
                  ? <CheckCircleIcon sx={{ color: 'success.main' }} fontSize="small" />
                  : <ErrorIcon sx={{ color: 'error.main' }} fontSize="small" />
                }
                <Typography variant="h6">
                  {validation?.valid ? 'All Valid' : 'Validation Errors'}
                </Typography>
              </Box>

              {validation && (
                <>
                  <Box sx={{ mb: 1 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption">Errors</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }} color="error.main">
                        {validation.errors.length}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                      <Typography variant="caption">Warnings</Typography>
                      <Typography variant="caption" sx={{ fontWeight: 600 }} color="warning.main">
                        {validation.warnings.length}
                      </Typography>
                    </Box>
                  </Box>

                  {validation.errors.slice(0, 3).map((e, i) => (
                    <Alert key={i} severity="error" sx={{ mb: 0.5, py: 0 }} icon={false}>
                      <Typography variant="caption">{e.message}</Typography>
                    </Alert>
                  ))}
                  {validation.warnings.slice(0, 3).map((w, i) => (
                    <Alert key={i} severity="warning" sx={{ mb: 0.5, py: 0 }} icon={false}>
                      <Typography variant="caption">{w.message}</Typography>
                    </Alert>
                  ))}
                </>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>
    </AppShell>
  );
}
