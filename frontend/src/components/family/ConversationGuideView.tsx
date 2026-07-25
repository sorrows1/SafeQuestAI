import { Alert, Box, CircularProgress, List, ListItem, Paper, Typography } from '@mui/material';
import { useGetConversationGuideQuery } from '@/store/api';
export function ConversationGuideView({ sessionId }: { sessionId: number }) {
  const { data: guide, isLoading, isError } = useGetConversationGuideQuery(sessionId);
  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  if (isError || !guide) return <Alert severity="error">The conversation guide is not available yet. Please try again.</Alert>;
  const excerpts = Object.values(guide.child_reasoning_excerpt).filter(
    (value): value is string => typeof value === 'string' && Boolean(value.trim())
  );
  return (
    <Paper component="section" aria-label="Conversation guide" sx={{ maxWidth: 820, mx: 'auto', mt: 4, p: 3 }}>
      <Typography variant="h4">Conversation guide</Typography>
      <Typography sx={{ mt: 2 }}>{guide.scenario_summary}</Typography>
      <Typography variant="h6" sx={{ mt: 3 }}>
        Things to talk about together
      </Typography>
      <List>
        {guide.discussion_prompts.map((prompt) => (
          <ListItem key={prompt}>• {prompt}</ListItem>
        ))}
      </List>
      {excerpts.length > 0 && (
        <>
          <Typography variant="h6" sx={{ mt: 2 }}>
            What your child shared
          </Typography>
          <List>
            {excerpts.map((excerpt, index) => (
              <ListItem key={index}>“{excerpt}”</ListItem>
            ))}
          </List>
        </>
      )}
      <Alert severity="success" sx={{ mt: 2 }}>
        Reaching out for support is always a good option. Keep this conversation open.
      </Alert>
    </Paper>
  );
}
