import { useState } from 'react';
import { Box, CircularProgress, List, ListItemButton, ListItemText, Paper, Stack, Typography } from '@mui/material';
import { useSnackbar } from 'notistack';
import { AppShell } from '@/components/common/AppShell';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { useDecideGenerationRunMutation, useGetGenerationReviewItemQuery, useGetGenerationReviewQueueQuery } from '@/store/api';
import { ReviewDecisionControls } from './ReviewDecisionControls';

const labels: Record<string, string> = { initiator: 'Initiator', respondent: 'Respondent' };

export function ReviewQueue() {
  const { enqueueSnackbar } = useSnackbar();
  const { data: items = [], isLoading } = useGetGenerationReviewQueueQuery();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const { data: detail, isFetching: detailLoading } = useGetGenerationReviewItemQuery(selectedId!, { skip: selectedId === null });
  const [decideRun] = useDecideGenerationRunMutation();
  const handleDecision = async (status: 'approved' | 'rejected') => {
    if (!detail) return;
    try {
      await decideRun({ runId: detail.id, decision: { status } }).unwrap();
      enqueueSnackbar(`Run ${status}`, { variant: 'success' });
      setSelectedId(null);
    } catch (error: any) { enqueueSnackbar(error?.data?.detail ?? 'Review decision failed', { variant: 'error' }); }
  };

  return (
    <AppShell>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5" sx={{ mb: 0.5 }}>Review Queue</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Completed sessions that were not reviewed live.</Typography>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ minHeight: 460 }}>
          <Paper variant="outlined" sx={{ width: { md: 330 }, overflow: 'auto' }}>
            {isLoading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={24} /></Box> : items.length === 0 ? <Typography sx={{ p: 3 }} color="text.secondary">Nothing is waiting for review.</Typography> : <List disablePadding>{items.map((item) => <ListItemButton key={item.id} selected={item.id === selectedId} onClick={() => setSelectedId(item.id)}><ListItemText primary={item.scenario_id} secondary={`${item.category ?? 'Scenario'} · ${item.difficulty}`} /></ListItemButton>)}</List>}
          </Paper>
          <Paper variant="outlined" sx={{ flex: 1, p: 3, overflow: 'auto' }}>
            {!selectedId && <Typography color="text.secondary">Select a session to inspect its transcript.</Typography>}
            {detailLoading && <CircularProgress size={24} />}
            {detail && <>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 2 }}><Box><Typography variant="h6">{detail.scenario_id}</Typography><Typography variant="caption">Coverage: {Math.round(detail.auto_scores.coverage * 100)}%</Typography></Box><ReviewDecisionControls onDecision={handleDecision} /></Stack>
              {detail.transcript.map((message) => <MessageBubble key={message.id} content={message.content} speakerLabel={labels[message.sender] ?? message.sender} side={message.sender === 'respondent' ? 'right' : 'left'} pace={String(message.metadata.pace ?? 'normal')} selectable />)}
            </>}
          </Paper>
        </Stack>
      </Box>
    </AppShell>
  );
}
