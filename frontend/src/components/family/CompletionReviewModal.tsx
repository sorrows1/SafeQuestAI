import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import ShieldCatIcon from '@mui/icons-material/Security';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import VisibilityIcon from '@mui/icons-material/Visibility';
import type {
  CheckpointResponse,
  ConversationGuide,
  FamilyCaregiverComment,
  FamilyMessage,
  ValidatedFinding,
} from '@/types';
import { PostSessionSharedReview } from './PostSessionSharedReview';

interface Props {
  open: boolean;
  acknowledged: boolean;
  highlightedMessages: FamilyMessage[];
  tagAssignments: Record<number, string>;
  commandLoading: boolean;
  actionError: string | null;
  onAcknowledge: () => void;
  onOpenHelp: () => void;
  onFinish: () => void;
  onCloseReviewScene: () => void;
  onRetryError?: () => void;

  // Additional post-session props
  scenarioTitle?: string;
  category?: string;
  validatedFindings?: ValidatedFinding[];
  checkpointResponses?: CheckpointResponse[];
  caregiverComments?: FamilyCaregiverComment[];
  conversationGuide?: ConversationGuide | null;
}

export function CompletionReviewModal({
  open,
  acknowledged,
  highlightedMessages,
  tagAssignments,
  commandLoading,
  actionError,
  onAcknowledge,
  onOpenHelp,
  onFinish,
  onCloseReviewScene,
  onRetryError,
  scenarioTitle = 'Family Safety Scenario',
  category = 'digital_safety',
  validatedFindings = [],
  checkpointResponses = [],
  caregiverComments = [],
  conversationGuide = null,
}: Props) {
  return (
    <Dialog open={open} onClose={onCloseReviewScene} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}>
      {acknowledged ? (
        <DialogContent sx={{ p: { xs: 1, sm: 2 } }}>
          <PostSessionSharedReview
            scenarioTitle={scenarioTitle}
            category={category}
            completedTogether={true}
            validatedFindings={validatedFindings}
            checkpointResponses={checkpointResponses}
            caregiverComments={caregiverComments}
            conversationGuide={conversationGuide}
            onReturnToLibrary={onCloseReviewScene}
            onContinueLater={onFinish}
            onOpenHelpResources={onOpenHelp}
          />
        </DialogContent>
      ) : (
        <>
          <DialogTitle component="div" sx={{ textAlign: 'center', pt: 3, pb: 1 }}>
            <Box
              sx={{
                width: 64,
                height: 64,
                borderRadius: '50%',
                bgcolor: 'success.main',
                color: 'success.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 2,
                boxShadow: '0 0 20px rgba(34, 197, 94, 0.3)',
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 40 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Scenario Complete — Review Together
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              You reached the end of the simulation. Take a moment to reflect on what stood out.
            </Typography>
          </DialogTitle>

          <DialogContent dividers sx={{ border: 'none', py: 2 }}>
            <Stack spacing={3}>
              {/* Identified Red Flags Summary */}
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', letterSpacing: 0.5, mb: 1 }}>
                  Flagged Red Flags & Tactics ({highlightedMessages.length})
                </Typography>

                {highlightedMessages.length > 0 ? (
                  <Stack spacing={1} sx={{ maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                    {highlightedMessages.map((msg) => (
                      <Paper
                        key={msg.id}
                        elevation={0}
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          bgcolor: 'action.hover',
                          border: '1px solid',
                          borderColor: 'divider',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 1.5,
                        }}
                      >
                        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', overflow: 'hidden' }}>
                          <FlagIcon color="warning" fontSize="small" sx={{ flexShrink: 0 }} />
                          <Box sx={{ overflow: 'hidden' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {msg.speaker_label}
                            </Typography>
                            <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                              "{msg.content}"
                            </Typography>
                          </Box>
                        </Stack>
                        {tagAssignments[msg.id] && (
                          <Chip size="small" color="warning" label={tagAssignments[msg.id]} sx={{ fontWeight: 700, fontSize: '0.65rem', flexShrink: 0 }} />
                        )}
                      </Paper>
                    ))}
                  </Stack>
                ) : (
                  <Paper elevation={0} sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', fontStyle: 'italic', textAlign: 'center' }}>
                    <Typography variant="body2" color="text.secondary">
                      No specific red flags were highlighted in this attempt, but discussing the scenario log together helps build awareness.
                    </Typography>
                  </Paper>
                )}
              </Box>

              <Divider />

              {/* Key Educational Takeaways */}
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2.5,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'primary.main',
                }}
              >
                <Stack spacing={1.5}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
                    <ShieldCatIcon fontSize="small" />
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Safety & Action Advice
                    </Typography>
                  </Box>

                  <Stack spacing={1}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <strong>• Document Everything:</strong> Take screenshots of cyberbullying or inappropriate requests before blocking or reporting.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <strong>• Do Not Feed Aggression:</strong> Aggressors look for reactions. Refuse to engage aggressively back.
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <strong>• Seek Support:</strong> Talk to a trusted adult, parent, teacher, or counselor if anything online makes you uncomfortable.
                    </Typography>
                  </Stack>
                </Stack>
              </Paper>

              {/* Action Error Banner if any */}
              {actionError && (
                <Alert severity="error" action={onRetryError ? <Button color="inherit" size="small" onClick={onRetryError}>Retry</Button> : undefined}>
                  {actionError}
                </Alert>
              )}
            </Stack>
          </DialogContent>

          <DialogActions sx={{ p: 3, flexDirection: 'column', gap: 1.5 }}>
            <Button
              variant="contained"
              color="primary"
              fullWidth
              size="large"
              onClick={onAcknowledge}
              disabled={commandLoading}
              sx={{ borderRadius: 2.5, py: 1.5, fontWeight: 800 }}
            >
              I Reviewed the Scene
            </Button>

            <Button
              variant="text"
              color="inherit"
              onClick={onCloseReviewScene}
              startIcon={<VisibilityIcon />}
              sx={{ fontSize: '0.8125rem', textTransform: 'none' }}
            >
              Review Scene Feed
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );
}
