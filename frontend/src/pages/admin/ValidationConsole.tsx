import { useState, useCallback } from 'react';
import {
  Box, Paper, Typography, Button, CircularProgress, Alert,
  Chip, Grid, List, ListItem, Accordion,
  AccordionSummary, AccordionDetails, LinearProgress,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useLazyValidateAllQuery } from '@/store/api';
import type { ValidationError } from '@/types';
import { AppShell } from '@/components/common/AppShell';

const SEVERITY_CONFIG = {
  error:   { icon: <ErrorIcon fontSize="small" />,   color: 'error',   label: 'Error' },
  warning: { icon: <WarningIcon fontSize="small" />, color: 'warning', label: 'Warning' },
  info:    { icon: <InfoIcon fontSize="small" />,    color: 'info',    label: 'Info' },
} as const;

function ValidationItem({ item }: { item: ValidationError }) {
  const cfg = SEVERITY_CONFIG[item.severity as keyof typeof SEVERITY_CONFIG];
  return (
    <ListItem sx={{ px: 0, py: 0.5, alignItems: 'flex-start' }}>
      <Box sx={{ display: 'flex', gap: 1, width: '100%' }}>
        <Box sx={{ color: `${cfg.color}.main`, mt: 0.2 }}>{cfg.icon}</Box>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 0.25 }}>
            <Chip label={item.code} size="small" sx={{ height: 18, fontSize: '0.65rem', fontFamily: 'monospace' }} />
            <Typography variant="caption" color="text.secondary">{item.location}</Typography>
          </Box>
          <Typography variant="body2">{item.message}</Typography>
          {item.suggestion && (
            <Typography variant="caption" color="text.secondary">💡 {item.suggestion}</Typography>
          )}
        </Box>
      </Box>
    </ListItem>
  );
}

export function ValidationConsole() {
  const [triggerValidation, { data: report, isFetching: loading }] = useLazyValidateAllQuery();

  return (
    <AppShell>
      <Box sx={{ p: 3, maxWidth: 1000, mx: 'auto' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
          <Typography variant="h2" sx={{ flex: 1 }}>Validation Console</Typography>
          <Button variant="contained" startIcon={loading ? <CircularProgress size={14} /> : <RefreshIcon />}
            onClick={() => triggerValidation()} disabled={loading}>
            Run Validation
          </Button>
        </Box>

        {!report && !loading && (
          <Paper variant="outlined" sx={{ p: 6, textAlign: 'center' }}>
            <Typography color="text.secondary">Click "Run Validation" to check all JSON content for errors and broken references.</Typography>
          </Paper>
        )}

        {loading && <LinearProgress sx={{ mb: 2 }} />}

        {report && (
          <>
            <Alert
              severity={report.valid ? 'success' : 'error'}
              icon={report.valid ? <CheckCircleIcon /> : <ErrorIcon />}
              sx={{ mb: 3 }}
            >
              {report.valid
                ? `All content is valid. ${report.total_scenarios} scenarios, ${report.total_stages} stages, ${report.total_objectives} objectives.`
                : `Found ${report.errors.length} error(s) and ${report.warnings.length} warning(s).`
              }
            </Alert>

            <Grid container spacing={1} sx={{ mb: 3 }}>
              {[
                { label: 'Scenarios', value: report.total_scenarios },
                { label: 'Personas',  value: report.total_personas },
                { label: 'Stages',    value: report.total_stages },
                { label: 'Objectives',value: report.total_objectives },
                { label: 'Constraints',value: report.total_constraints },
              ].map(s => (
                <Grid key={s.label} size={{ xs: 6, sm: 4, md: 2 }}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: 'center' }}>
                    <Typography variant="h5" sx={{ fontWeight: 700 }}>{s.value}</Typography>
                    <Typography variant="caption" color="text.secondary">{s.label}</Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>

            {report.errors.length > 0 && (
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ErrorIcon color="error" fontSize="small" />
                    <Typography sx={{ fontWeight: 600 }}>Errors ({report.errors.length})</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {report.errors.map((e, i) => <ValidationItem key={i} item={e} />)}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {report.warnings.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <WarningIcon color="warning" fontSize="small" />
                    <Typography sx={{ fontWeight: 600 }}>Warnings ({report.warnings.length})</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {report.warnings.map((w, i) => <ValidationItem key={i} item={w} />)}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}

            {report.info.length > 0 && (
              <Accordion>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <InfoIcon color="info" fontSize="small" />
                    <Typography sx={{ fontWeight: 600 }}>Info ({report.info.length})</Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <List disablePadding>
                    {report.info.map((inf, i) => <ValidationItem key={i} item={inf} />)}
                  </List>
                </AccordionDetails>
              </Accordion>
            )}
          </>
        )}
      </Box>
    </AppShell>
  );
}
