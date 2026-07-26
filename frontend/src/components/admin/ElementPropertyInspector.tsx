import {
  Box,
  Checkbox,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import type { SceneElement } from '@/types';

interface ElementPropertyInspectorProps {
  element: SceneElement | null;
  allElements?: SceneElement[];
  supportedElementTypes?: string[];
  onUpdateElement: (key: string, change: Partial<SceneElement>) => void;
}

export function ElementPropertyInspector({
  element,
  allElements = [],
  supportedElementTypes = [],
  onUpdateElement,
}: ElementPropertyInspectorProps) {
  if (!element) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 3,
          borderRadius: 3,
          border: '1px dashed',
          borderColor: 'divider',
          textAlign: 'center',
          color: 'text.secondary',
        }}
      >
        <Typography variant="body2">Select an element from the scene tree or preview to inspect properties.</Typography>
      </Paper>
    );
  }

  const typeOptions = supportedElementTypes.length > 0 ? supportedElementTypes : [element.element_type];

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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <EditIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Inspect Element Properties: {element.element_key}
          </Typography>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Stable Element Key"
            size="small"
            fullWidth
            value={element.element_key}
            onChange={(e) => onUpdateElement(element.element_key, { element_key: e.target.value })}
          />

          <FormControl fullWidth size="small">
            <InputLabel>Element Type</InputLabel>
            <Select
              label="Element Type"
              value={element.element_type}
              onChange={(e) => onUpdateElement(element.element_key, { element_type: e.target.value as any })}
            >
              {typeOptions.map((type) => (
                <MenuItem key={type} value={type}>
                  {type}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth size="small">
            <InputLabel>Parent Element</InputLabel>
            <Select
              label="Parent Element"
              value={element.parent_element_key ?? ''}
              onChange={(e) =>
                onUpdateElement(element.element_key, { parent_element_key: e.target.value || null })
              }
            >
              <MenuItem value="">No Parent (Root Level)</MenuItem>
              {allElements
                .filter((candidate) => candidate.element_key !== element.element_key)
                .map((candidate) => (
                  <MenuItem key={candidate.element_key} value={candidate.element_key}>
                    {candidate.element_key}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </Stack>

        <TextField
          label="Public Content"
          size="small"
          fullWidth
          multiline
          rows={3}
          value={element.content ?? ''}
          onChange={(e) => onUpdateElement(element.element_key, { content: e.target.value || null })}
        />

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField
            label="Accessible Label"
            size="small"
            fullWidth
            value={element.accessible_label}
            onChange={(e) => onUpdateElement(element.element_key, { accessible_label: e.target.value })}
          />

          <TextField
            label="Display Label"
            size="small"
            fullWidth
            value={element.presentation.display_label ?? ''}
            onChange={(e) =>
              onUpdateElement(element.element_key, {
                presentation: { ...element.presentation, display_label: e.target.value || undefined },
              })
            }
          />

          <TextField
            label="In-App Preview Href"
            size="small"
            fullWidth
            value={element.presentation.href ?? ''}
            onChange={(e) =>
              onUpdateElement(element.element_key, {
                presentation: { ...element.presentation, href: e.target.value || undefined },
              })
            }
            helperText="Must start with /"
          />
        </Stack>

        <FormControlLabel
          control={
            <Checkbox
              checked={element.selectable}
              onChange={(e) => onUpdateElement(element.element_key, { selectable: e.target.checked })}
              color="primary"
            />
          }
          label={<Typography variant="body2" sx={{ fontWeight: 600 }}>Selectable Red-Flag Evaluation Target</Typography>}
        />
      </Stack>
    </Paper>
  );
}
