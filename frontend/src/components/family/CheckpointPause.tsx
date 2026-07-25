import { useState } from 'react';
import { Alert, Box, Button, Paper, TextField, Typography } from '@mui/material';
interface Props {
  prompt: string;
  detectiveMode: boolean;
  selectedCount: number;
  companionMode: boolean;
  submitting?: boolean;
  onSubmit: (response: string, tag: string) => void;
  onTagChange: (tag: string) => void;
}
export function CheckpointPause({ prompt, detectiveMode, selectedCount, companionMode, submitting = false, onSubmit, onTagChange }: Props) {
  const [response, setResponse] = useState('');
  const [tag, setTag] = useState('');
  return (
    <Paper component="section" aria-label="Discussion pause" elevation={3} sx={{ p: 3, position: 'sticky', bottom: 16, zIndex: 2 }}>
      <Typography variant="h6">Pause and talk it through</Typography>
      <Typography sx={{ mt: 1 }}>{prompt}</Typography>
      <Alert severity="info" sx={{ mt: 2 }}>
        {companionMode ? 'Share your thinking at your own pace.' : 'Discuss together, then write a shared thought before continuing.'}
      </Alert>
      <TextField
        label="What do you notice or what would you do?"
        value={response}
        onChange={(event) => setResponse(event.target.value)}
        multiline
        minRows={3}
        fullWidth
        required
        sx={{ mt: 2 }}
      />
      {detectiveMode && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2">
            You selected {selectedCount} message{selectedCount === 1 ? '' : 's'}. You can name the tactic if you want.
          </Typography>
          <TextField
            label="Your tactic guess (optional)"
            value={tag}
            onChange={(event) => {
              setTag(event.target.value);
              onTagChange(event.target.value);
            }}
            fullWidth
            sx={{ mt: 1 }}
          />
        </Box>
      )}
      <Button
        variant="contained"
        onClick={() => response.trim() && onSubmit(response.trim(), tag.trim())}
        disabled={!response.trim() || submitting}
        sx={{ mt: 2 }}
      >
        Continue
      </Button>
    </Paper>
  );
}
