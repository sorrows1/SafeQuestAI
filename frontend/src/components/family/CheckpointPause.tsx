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
      elevation={2}
      sx={{
        p: { xs: 2, sm: 2.5 },
        mt: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'warning.main',
        bgcolor: 'background.paper',
        boxShadow: '0 4px 20px rgba(245, 158, 11, 0.15)',
        position: 'relative',
        zIndex: 2,
      }}
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'warning.main' }}>
            <PauseOutlinedIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Pause and Reflect
            </Typography>
          </Stack>
          {
            <Chip
              size="small"
              color="warning"
              variant="outlined"
              label={`${selectedCount} Message${selectedCount === 1 ? '' : 's'} Selected`}
              sx={{ fontWeight: 700, fontSize: '0.7rem' }}
            />
          }
        </Box>

        <Typography variant="body2" sx={{ fontWeight: 600, color: 'text.primary' }}>
          {prompt}
        </Typography>

        <Alert severity="info" sx={{ py: 0.5, px: 1.5, borderRadius: 2, '& .MuiAlert-message': { fontSize: '0.75rem' } }}>
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
        />

        {
          <TextField
            placeholder="Name the tactic (optional)"
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              onTagChange(event.target.value);
            }}
            fullWidth
            size="small"
          />
        }

        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            color="warning"
            size="small"
            onClick={() => response.trim() && onSubmit(response.trim(), tag.trim())}
            disabled={!response.trim() || submitting}
            endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9rem !important' }} />}
            sx={{ borderRadius: '18px', textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            Submit Reflection & Continue
          </Button>
        </Box>
      </Stack>
    </Paper>
  );
}
