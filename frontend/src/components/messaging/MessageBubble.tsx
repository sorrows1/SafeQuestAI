import { memo } from 'react';
import { Box, Fade, Grow, Paper, Typography } from '@mui/material';
import { Avatar } from './Avatar';

export type MessageSide = 'left' | 'right';

export interface MessageBubbleProps {
  content: string;
  speakerLabel: string;
  side: MessageSide;
  pace?: string;
  selectable?: boolean;
  showAvatar?: boolean;
  showLabel?: boolean;
  role?: 'initiator' | 'respondent';
}

/** A presentation-only message bubble shared by admin and player experiences. */
export const MessageBubble = memo(function MessageBubble({ content, speakerLabel, side, pace = 'normal', selectable = false, showAvatar = true, showLabel = true, role }: MessageBubbleProps) {
  const isRight = side === 'right';

  return (
    <Fade in timeout={180} appear>
      <Box sx={{ display: 'flex', justifyContent: isRight ? 'flex-end' : 'flex-start', mb: 2, alignItems: 'flex-end', gap: 1 }}>
        {!isRight && showAvatar && <Avatar speakerLabel={showLabel ? speakerLabel : ''} role={role} />}
        <Box sx={{ maxWidth: '72%' }}>
          <Typography variant="caption" sx={{ display: 'block', mb: 0.5, color: 'text.secondary', textAlign: isRight ? 'right' : 'left' }}>
            {speakerLabel}
          </Typography>
          <Grow in timeout={220} appear style={{ transformOrigin: isRight ? '100% 100%' : '0 100%' }}>
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                px: 2,
                borderRadius: isRight ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
                bgcolor: isRight ? 'primary.main' : 'background.paper',
                color: isRight ? 'primary.contrastText' : 'text.primary',
                border: isRight ? 'none' : '1px solid',
                borderColor: 'divider',
                userSelect: selectable ? 'text' : 'none',
              }}
            >
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {content}
              </Typography>
            </Paper>
          </Grow>
        </Box>
        {isRight && showAvatar && <Avatar speakerLabel={speakerLabel} role={role} />}
      </Box>
    </Fade>
  );
});
