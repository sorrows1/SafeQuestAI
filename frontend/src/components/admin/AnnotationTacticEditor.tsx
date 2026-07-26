import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import type { SceneAnnotationDraft, SceneElement } from '@/types';

interface AnnotationTacticEditorProps {
  annotations: SceneAnnotationDraft[];
  selectableElements: SceneElement[];
  categoryTags?: string[];
  onUpdateAnnotation: (index: number, change: Partial<SceneAnnotationDraft>) => void;
  onAddAnnotation: (elementKey: string, tag: string) => void;
  onRemoveAnnotation: (index: number) => void;
}

export function AnnotationTacticEditor({
  annotations = [],
  selectableElements = [],
  categoryTags = [],
  onUpdateAnnotation,
  onAddAnnotation,
  onRemoveAnnotation,
}: AnnotationTacticEditorProps) {
  const [selectedTargetKey, setSelectedTargetKey] = useState<string>('');

  const handleAdd = () => {
    const target = selectedTargetKey || (selectableElements[0]?.element_key ?? '');
    const tag = categoryTags[0] ?? 'boundary_pressure';
    if (target) {
      onAddAnnotation(target, tag);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <FlagIcon color="warning" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Red-Flag Annotations & Tactics ({annotations.length})
            </Typography>
          </Stack>

          {selectableElements.length > 0 && (
            <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={handleAdd}>
              Add Annotation Target
            </Button>
          )}
        </Box>

        {selectableElements.length === 0 && (
          <Alert severity="warning" sx={{ borderRadius: 2 }}>
            No selectable elements exist in the scene. Mark at least one element as "Selectable" to add ground-truth annotations.
          </Alert>
        )}

        {annotations.length > 0 ? (
          <Stack spacing={2}>
            {annotations.map((ann, idx) => (
              <Paper
                key={`${ann.element_key}-${idx}`}
                variant="outlined"
                sx={{ p: 2, borderRadius: 2.5, bgcolor: 'action.hover' }}
              >
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: 'warning.main' }}>
                      Annotation Target #{idx + 1}
                    </Typography>
                    <Button
                      size="small"
                      color="error"
                      startIcon={<DeleteIcon fontSize="small" />}
                      onClick={() => onRemoveAnnotation(idx)}
                      sx={{ fontSize: '0.75rem', textTransform: 'none' }}
                    >
                      Remove
                    </Button>
                  </Box>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Target Element</InputLabel>
                      <Select
                        label="Target Element"
                        value={ann.element_key}
                        onChange={(e) => onUpdateAnnotation(idx, { element_key: e.target.value })}
                      >
                        {selectableElements.map((el) => (
                          <MenuItem key={el.element_key} value={el.element_key}>
                            {el.element_key} ({el.accessible_label || el.element_type})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth size="small">
                      <InputLabel>Taxonomy Tactic Tag</InputLabel>
                      <Select
                        label="Taxonomy Tactic Tag"
                        value={ann.tactic_tag}
                        onChange={(e) => onUpdateAnnotation(idx, { tactic_tag: e.target.value })}
                      >
                        {categoryTags.map((tag) => (
                          <MenuItem key={tag} value={tag}>
                            {tag.replace(/_/g, ' ').toUpperCase()}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Stack>

                  <TextField
                    label="Child-Safe Non-Judgmental Explanation"
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Describe why this element represents a boundary pressure or safety signal..."
                    value={ann.explanation ?? ''}
                    onChange={(e) => onUpdateAnnotation(idx, { explanation: e.target.value || null })}
                  />

                  <TextField
                    label="Tiered Hints (one per line)"
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                    placeholder="Hint Level 1: Look closely at the urgency...\nHint Level 2: Notice the demand..."
                    value={ann.tiered_hints.join('\n')}
                    onChange={(e) =>
                      onUpdateAnnotation(idx, {
                        tiered_hints: e.target.value.split('\n').filter(Boolean),
                      })
                    }
                    helperText="Progressive discussion hints for family guidance."
                  />
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No red-flag annotations defined yet. Annotations provide ground-truth tactics and explanations for family review.
          </Typography>
        )}
      </Stack>
    </Paper>
  );
}
