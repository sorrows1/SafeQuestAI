import { useState } from 'react';
import { Alert, Box, Button, Chip, Paper, Stack, TextField, Typography } from '@mui/material';
import PauseOutlinedIcon from '@mui/icons-material/PauseOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

interface Props {
  detectiveMode?: boolean;
  prompt: string;
  selectedCount: number;
  companionMode: boolean;
  submitting?: boolean;
  onSubmit: (response: string, tag: string) => void;
  onTagChange: (tag: string) => void;
}

export function CheckpointPause({ prompt, selectedCount, companionMode, submitting = false, onSubmit, onTagChange }: Props) {
  const [response, setResponse] = useState('');
  const [tag, setTag] = useState('');

  return (
    <Paper
      component="section"
      aria-label="Discussion pause"
      elevation={0}
      sx={{
        p: { xs: 1.5, sm: 2 },
        mt: 1.5,
        borderRadius: 2.5,
        border: '1.5px solid',
        borderColor: 'warning.main',
        bgcolor: 'background.paper',
        boxShadow: '0 2px 12px rgba(245, 158, 11, 0.12)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <Stack spacing={1.25}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'warning.dark' }}>
            <PauseOutlinedIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Pause & Reflect
            </Typography>
          </Stack>
          <Chip
            size="small"
            color="warning"
            variant="outlined"
            label={`${selectedCount} Message${selectedCount === 1 ? '' : 's'} Selected`}
            sx={{ fontWeight: 700, fontSize: '0.6875rem', height: 22 }}
          />
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary', lineHeight: 1.4 }}>
          {prompt}
        </Typography>

        <Alert severity="info" sx={{ py: 0.25, px: 1.25, borderRadius: 1.5, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
          {companionMode ? 'Share your thinking at your own pace before continuing.' : 'Discuss together, then write a shared reflection.'}
        </Alert>

        <TextField
          label="What do you notice or what would you do?"
          placeholder="What do you notice or what would you do in this situation?"
          value={response}
          onChange={(event) => setResponse(event.target.value)}
          multiline
          minRows={2}
          fullWidth
          required
          size="small"
          slotProps={{ htmlInput: { style: { fontSize: '0.875rem' } } }}
        />

        <TextField
          placeholder="Name the tactic (optional)"
          value={tag}
          onChange={(event) => {
            setTag(event.target.value);
            onTagChange(event.target.value);
          }}
          fullWidth
          size="small"
          slotProps={{ htmlInput: { style: { fontSize: '0.8125rem' } } }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', pt: 0.5 }}>
          <Button
            variant="contained"
            color="warning"
            size="small"
            onClick={() => response.trim() && onSubmit(response.trim(), tag.trim())}
            disabled={!response.trim() || submitting}
            endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9rem !important' }} />}
            sx={{ borderRadius: '16px', textTransform: 'none', fontWeight: 700, px: 2.5, py: 0.75 }}
          >
            Submit Reflection & Continue
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
