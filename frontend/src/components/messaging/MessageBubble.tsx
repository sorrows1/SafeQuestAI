import { Box, Typography, Paper, Avatar } from '@mui/material';

interface MessageBubbleProps {
  sender: 'user' | 'contact';
  content: string;
  timestamp: string;
  avatarUrl?: string | null;
  contactName?: string;
}

export function MessageBubble({ sender, content, timestamp, avatarUrl, contactName }: MessageBubbleProps) {
  const isUser = sender === 'user';
  const timeStr = new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <Box sx={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', mb: 2, alignItems: 'flex-end' }}>
      {!isUser && (
        <Avatar
          src={avatarUrl?.startsWith('color:') ? undefined : (avatarUrl || undefined)}
          sx={{ width: 32, height: 32, mr: 1, bgcolor: avatarUrl?.startsWith('color:') ? avatarUrl.split(':')[1] : 'primary.main' }}
        >
          {contactName?.[0]?.toUpperCase()}
        </Avatar>
      )}

      <Box sx={{ maxWidth: '70%' }}>
        {!isUser && contactName && (
          <Typography variant="caption" sx={{ ml: 1, mb: 0.5, display: 'block', color: 'text.secondary' }}>
            {contactName}
          </Typography>
        )}
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            px: 2,
            borderRadius: isUser ? '20px 20px 4px 20px' : '20px 20px 20px 4px',
            bgcolor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'primary.contrastText' : 'text.primary',
            border: isUser ? 'none' : '1px solid',
            borderColor: 'divider',
          }}
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {content}
          </Typography>
        </Paper>
        <Typography variant="caption" sx={{ mt: 0.5, display: 'block', color: 'text.secondary', textAlign: isUser ? 'right' : 'left', ml: isUser ? 0 : 1, mr: isUser ? 1 : 0 }}>
          {timeStr}
        </Typography>
      </Box>
    </Box>
  );
}
