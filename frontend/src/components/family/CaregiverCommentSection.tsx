import { useState } from 'react';
import {
  Box,
  Button,
  CircularProgress,
  Chip,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CommentIcon from '@mui/icons-material/Comment';
import SendIcon from '@mui/icons-material/Send';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import type { FamilyCaregiverComment } from '@/types';

interface CaregiverCommentSectionProps {
  comments?: FamilyCaregiverComment[];
  elementKey?: string | null;
  canAddComment?: boolean;
  onSubmitComment?: (text: string, elementKey?: string | null) => Promise<void>;
  isSubmitting?: boolean;
}

export function CaregiverCommentSection({
  comments = [],
  elementKey = null,
  canAddComment = false,
  onSubmitComment,
  isSubmitting = false,
}: CaregiverCommentSectionProps) {
  const [inputText, setInputText] = useState('');

  const filteredComments = elementKey
    ? comments.filter((c) => !c.element_key || c.element_key === elementKey)
    : comments;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || !onSubmitComment) return;
    await onSubmitComment(inputText.trim(), elementKey);
    setInputText('');
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Stack spacing={2}>
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <CommentIcon color="secondary" fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Caregiver Discussion Notes ({filteredComments.length})
            </Typography>
          </Stack>
          <Chip
            size="small"
            color="secondary"
            variant="outlined"
            label="Child-Visible"
            sx={{ fontWeight: 700, fontSize: '0.65rem' }}
          />
        </Box>

        {/* Existing Comments List */}
        {filteredComments.length > 0 ? (
          <Stack spacing={1.5}>
            {filteredComments.map((comment) => (
              <Paper
                key={comment.comment_ref}
                elevation={0}
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: 'action.hover',
                  borderLeft: '4px solid',
                  borderLeftColor: 'secondary.main',
                }}
              >
                <Stack spacing={0.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                      <SupervisorAccountIcon color="secondary" sx={{ fontSize: 16 }} />
                      <Typography variant="caption" sx={{ fontWeight: 800, color: 'secondary.main' }}>
                        {comment.author_display_name} • {comment.child_visible_label || 'Caregiver Note'}
                      </Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {new Date(comment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </Typography>
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', pl: 0.5 }}>
                    "{comment.text}"
                  </Typography>
                </Stack>
              </Paper>
            ))}
          </Stack>
        ) : (
          <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
            No caregiver notes yet. Notes posted here will be visible during family post-session review.
          </Typography>
        )}

        {/* Caregiver Input Form */}
        {canAddComment && onSubmitComment && (
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 1 }}>
            <Stack spacing={1}>
              <TextField
                fullWidth
                size="small"
                multiline
                rows={2}
                placeholder="Add a supportive discussion note for your child..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                variant="outlined"
                slotProps={{
                  htmlInput: { sx: { fontSize: '0.875rem' } },
                }}
              />
              <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                <Button
                  type="submit"
                  size="small"
                  variant="contained"
                  color="secondary"
                  disabled={isSubmitting || !inputText.trim()}
                  endIcon={!isSubmitting ? <SendIcon /> : undefined}
                  startIcon={isSubmitting ? <CircularProgress size={15} color="inherit" /> : undefined}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                >
                  {isSubmitting ? 'Posting…' : 'Post Note'}
                </Button>
              </Box>
            </Stack>
          </Box>
        )}
      </Stack>
    </Paper>
  );
}
