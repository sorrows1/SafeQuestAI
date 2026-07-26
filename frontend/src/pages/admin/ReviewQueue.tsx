import { useNavigate } from 'react-router-dom';
import { Box, Button, CircularProgress, List, ListItemButton, ListItemText, Paper, Typography } from '@mui/material';
import { AppShell } from '@/components/common/AppShell';
import { useGetSimulationReviewQueueQuery } from '@/store/api';

export function ReviewQueue() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useGetSimulationReviewQueueQuery();
  return (
    <AppShell>
      <Box sx={{ p: 3 }}>
        <Typography variant="h5">Review Queue</Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          First approve the simulation, then review its inspectable content and annotations. Publication is a separate, validated action.
        </Typography>
        <Paper variant="outlined">
          {isLoading ? (
            <Box sx={{ p: 3, textAlign: 'center' }}>
              <CircularProgress size={24} />
            </Box>
          ) : items.length === 0 ? (
            <Typography sx={{ p: 3 }} color="text.secondary">
              Nothing is waiting for review.
            </Typography>
          ) : (
            <List disablePadding>
              {items.map((item) => (
                <ListItemButton key={`${item.kind}-${item.id}`} onClick={() => navigate(item.kind === 'content_review' ? `/admin/curated-transcripts/${item.id}/review` : `/admin/simulator/${item.id}`)}>
                  <ListItemText primary={`#${item.id} · ${item.scenario_id ?? 'curated content'}`} secondary={item.kind === 'content_review' ? 'Content and annotation review required before publication' : `${item.mode} · ${item.status}`} />
                  <Button size="small">{item.kind === 'content_review' ? 'Review content' : 'Open workbench'}</Button>
                </ListItemButton>
              ))}
            </List>
          )}
        </Paper>
      </Box>
    </AppShell>
  );
}
