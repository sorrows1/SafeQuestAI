import { memo } from 'react';
import { Box, Paper } from '@mui/material';

export interface TypingIndicatorProps {
  typing: boolean;
}

/** Rendering is driven by state owned by the caller, never by a transport event. */
export const TypingIndicator = memo(function TypingIndicator({ typing }: TypingIndicatorProps) {
  if (!typing) return null;
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }} aria-label="Typing">
      <Paper
        elevation={0}
        sx={{
          p: 2,
          borderRadius: '20px 20px 20px 4px',
          bgcolor: 'background.paper',
          border: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 0.5,
          alignItems: 'center',
          width: 'fit-content',
        }}
      >
        {[0, 0.2, 0.4].map((delay) => (
          <Box
            key={delay}
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: 'text.secondary',
              opacity: 0.6,
              animation: `typingBounce 1.4s infinite ease-in-out both ${delay}s`,
              '@keyframes typingBounce': {
                '0%, 80%, 100%': { transform: 'scale(0.8)', opacity: 0.5 },
                '40%': { transform: 'scale(1.2)', opacity: 1 },
              },
            }}
          />
        ))}
      </Paper>
    </Box>
  );
});
