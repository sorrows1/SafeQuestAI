import { Box, Chip, Paper, Typography } from '@mui/material';
import { SelectableMessage } from './SelectableMessage';
import type { ScenarioSkinProps } from './types';
export function EmailSkin({ messages, detectiveMode, highlightedMessageIds, onToggleMessage }: ScenarioSkinProps) {
  return (
    <Box aria-label="Email scenario" sx={{ maxWidth: 800, mx: 'auto', py: 2 }}>
      {messages.map((message) => (
        <SelectableMessage
          key={message.id}
          messageId={message.id}
          selectable={detectiveMode}
          selected={highlightedMessageIds.includes(message.id)}
          onToggle={onToggleMessage}
        >
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1 }}>
              <Typography variant="subtitle2">From: {message.speaker_label}</Typography>
              <Chip size="small" label={message.pace === 'slow' ? 'Delivered a moment ago' : 'New email'} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              To: You · Subject: A message for you
            </Typography>
            <Typography sx={{ mt: 2, whiteSpace: 'pre-wrap' }}>{message.content}</Typography>
          </Paper>
        </SelectableMessage>
      ))}
    </Box>
  );
}
