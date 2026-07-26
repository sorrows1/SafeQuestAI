import {
  Alert,
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import InfoIcon from '@mui/icons-material/Info';
import type { AdminSceneDraft, ScenarioDefinition } from '@/types';

export interface ValidationItem {
  type: 'blocker' | 'warning' | 'suggestion';
  message: string;
}

interface ScenarioValidationSummaryProps {
  scenario?: ScenarioDefinition | null;
  draft?: AdminSceneDraft | null;
  bindingIssues?: string[];
  supportedElementTypes?: string[];
}

export function ScenarioValidationSummary({
  scenario,
  draft,
  bindingIssues = [],
  supportedElementTypes = [],
}: ScenarioValidationSummaryProps) {
  const items: ValidationItem[] = [];

  // 1. Check Binding Issues
  bindingIssues.forEach((issue) => {
    items.push({ type: 'blocker', message: issue });
  });

  // 2. Check Scenario Properties
  if (scenario) {
    if (!scenario.id) {
      items.push({ type: 'blocker', message: 'Scenario ID is missing.' });
    }
    if (!scenario.display_name) {
      items.push({ type: 'blocker', message: 'Display name is missing.' });
    }
    if (!scenario.starting_stage) {
      items.push({ type: 'warning', message: 'Starting stage is not selected.' });
    }
    if (!scenario.description) {
      items.push({ type: 'warning', message: 'Scenario description is empty.' });
    }
  }

  // 3. Check Draft Elements & Annotations if present
  if (draft) {
    const selectable = draft.scene.elements.filter((e) => e.selectable);
    if (selectable.length === 0) {
      items.push({ type: 'blocker', message: 'No selectable red-flag target exists in the scene.' });
    }

    if (draft.annotations.length === 0) {
      items.push({ type: 'warning', message: 'No ground-truth red-flag annotations defined.' });
    }

    // Check for unsupported element types
    if (supportedElementTypes.length > 0) {
      draft.scene.elements.forEach((el) => {
        if (!supportedElementTypes.includes(el.element_type)) {
          items.push({
            type: 'blocker',
            message: `Element "${el.element_key}" has unsupported type "${el.element_type}" for skin "${draft.scene.render_skin}".`,
          });
        }
      });
    }

    // Check annotation hints
    draft.annotations.forEach((ann) => {
      if (!ann.explanation) {
        items.push({
          type: 'warning',
          message: `Annotation for "${ann.element_key}" is missing a child-safe explanation.`,
        });
      }
      if (ann.tiered_hints.length === 0) {
        items.push({
          type: 'suggestion',
          message: `Consider adding tiered hints for annotation on "${ann.element_key}".`,
        });
      }
    });
  }

  const blockers = items.filter((i) => i.type === 'blocker');
  const warnings = items.filter((i) => i.type === 'warning');
  const suggestions = items.filter((i) => i.type === 'suggestion');

  const isPublishReady = blockers.length === 0;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: isPublishReady ? 'success.main' : 'error.main',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {isPublishReady ? <CheckCircleIcon color="success" /> : <ErrorIcon color="error" />}
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Publication Compatibility & Validation Summary
            </Typography>
          </Stack>

          <Chip
            size="small"
            color={isPublishReady ? 'success' : 'error'}
            label={isPublishReady ? 'PUBLISH READY' : `${blockers.length} PUBLISH BLOCKERS`}
            sx={{ fontWeight: 800 }}
          />
        </Box>

        {/* Blockers */}
        {blockers.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'error.main', textTransform: 'uppercase' }}>
              🔴 Publish Blockers ({blockers.length})
            </Typography>
            {blockers.map((item, idx) => (
              <Alert key={idx} severity="error" icon={<ErrorIcon fontSize="small" />} sx={{ py: 0, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.message}</Typography>
              </Alert>
            ))}
          </Stack>
        )}

        {/* Warnings */}
        {warnings.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.main', textTransform: 'uppercase' }}>
              🟡 Review Warnings ({warnings.length})
            </Typography>
            {warnings.map((item, idx) => (
              <Alert key={idx} severity="warning" icon={<WarningIcon fontSize="small" />} sx={{ py: 0, borderRadius: 2 }}>
                <Typography variant="caption" sx={{ fontWeight: 600 }}>{item.message}</Typography>
              </Alert>
            ))}
          </Stack>
        )}

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <Stack spacing={1}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: 'info.main', textTransform: 'uppercase' }}>
              🔵 Quality Suggestions ({suggestions.length})
            </Typography>
            {suggestions.map((item, idx) => (
              <Alert key={idx} severity="info" icon={<InfoIcon fontSize="small" />} sx={{ py: 0, borderRadius: 2 }}>
                <Typography variant="caption">{item.message}</Typography>
              </Alert>
            ))}
          </Stack>
        )}

        {isPublishReady && warnings.length === 0 && (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            All publish blockers and compatibility rules passed cleanly.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
