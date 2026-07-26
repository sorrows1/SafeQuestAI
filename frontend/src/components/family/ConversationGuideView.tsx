import { Alert, Box, CircularProgress } from '@mui/material';
import { useGetConversationGuideQuery, useGetFamilySessionQuery } from '@/store/api';
import { PostSessionSharedReview } from './PostSessionSharedReview';

export function ConversationGuideView({ sessionId }: { sessionId: number }) {
  const { data: guide, isLoading, isError } = useGetConversationGuideQuery(sessionId);
  let detail: any = undefined;
  try {
    if (typeof useGetFamilySessionQuery === 'function') {
      detail = useGetFamilySessionQuery(sessionId)?.data;
    }
  } catch {
    detail = undefined;
  }

  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );

  if (isError || !guide) return <Alert severity="error">The conversation guide is not available yet. Please try again.</Alert>;

  return (
    <Box component="section" aria-label="Conversation guide" sx={{ py: 3, px: 2 }}>
      <PostSessionSharedReview
        scenarioTitle="Family Post-Session Conversation Guide"
        completedTogether={guide.completed_together}
        validatedFindings={detail?.findings ?? []}
        caregiverComments={detail?.caregiver_comments ?? []}
        conversationGuide={guide}
      />
    </Box>
  );
}
