import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  Grid,
  Paper,
  Stack,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FlagIcon from '@mui/icons-material/Flag';
import ShieldIcon from '@mui/icons-material/Shield';
import ForumIcon from '@mui/icons-material/Forum';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import HelpCenterIcon from '@mui/icons-material/HelpCenter';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ReplayIcon from '@mui/icons-material/Replay';
import LockIcon from '@mui/icons-material/Lock';
import BlockIcon from '@mui/icons-material/Block';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import type {
  CheckpointResponse,
  ConversationGuide,
  FamilyCaregiverComment,
  ValidatedFinding,
  FamilyReview,
} from '@/types';

interface PostSessionSharedReviewProps {
  scenarioTitle?: string;
  category?: string;
  completedTogether?: boolean;
  validatedFindings?: ValidatedFinding[];
  checkpointResponses?: CheckpointResponse[];
  caregiverComments?: FamilyCaregiverComment[];
  conversationGuide?: ConversationGuide | null;
  review?: FamilyReview | null;
  reviewLoading?: boolean;
  reviewError?: boolean;
  onReturnToLibrary?: () => void;
  onContinueLater?: () => void;
  onOpenHelpResources?: () => void;
}

export function PostSessionSharedReview({
  scenarioTitle = 'Family Safety Scenario',
  category = 'digital_safety',
  completedTogether = true,
  validatedFindings = [],
  checkpointResponses = [],
  caregiverComments = [],
  conversationGuide = null,
  review = null,
  reviewLoading = false,
  reviewError = false,
  onReturnToLibrary,
  onContinueLater,
  onOpenHelpResources,
}: PostSessionSharedReviewProps) {
  const [tabIndex, setTabIndex] = useState(0);

  const sharedExcerpts = checkpointResponses.filter(
    (cr) => cr.response_text && cr.response_text.trim().length > 0
  );

  const discussionPrompts = conversationGuide?.discussion_prompts ?? [
    'What signs in this interaction suggested something felt uncomfortable or off?',
    'If a friend experienced a situation like this, what advice would you give them?',
    'What steps can we take to set safe digital boundaries together as a family?',
  ];

  return (
    <Paper
      elevation={0}
      sx={{
        p: { xs: 2, sm: 3.5 },
        borderRadius: 4,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        maxWidth: 900,
        mx: 'auto',
      }}
    >
      <Stack spacing={3}>
        {/* 1. Header & Completed Together Status */}
        <Box sx={{ textAlign: 'center' }}>
          <Box
            sx={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              bgcolor: 'success.main',
              color: 'success.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              mx: 'auto',
              mb: 1.5,
              boxShadow: '0 0 16px rgba(34, 197, 94, 0.3)',
            }}
          >
            <CheckCircleIcon sx={{ fontSize: 36 }} />
          </Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            {scenarioTitle} — Post-Session Family Review
          </Typography>

          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', mt: 1 }}>
            <Chip
              size="small"
              color={completedTogether ? 'success' : 'info'}
              icon={<SupervisorAccountIcon fontSize="small" />}
              label={completedTogether ? 'Completed Together' : 'Self-Guided & Shared Review'}
              sx={{ fontWeight: 700 }}
            />
            {category && (
              <Chip
                size="small"
                variant="outlined"
                label={category.replace('_', ' ').toUpperCase()}
                sx={{ fontWeight: 600 }}
              />
            )}
          </Stack>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1, maxWidth: 600, mx: 'auto' }}>
            Take time to review highlighted safety tactics, discuss neutral reflections, and explore practical family protection steps.
          </Typography>
        </Box>

        <Divider />

        {/* Navigation Tabs */}
        <Tabs
          value={tabIndex}
          onChange={(_, newValue) => setTabIndex(newValue)}
          variant="fullWidth"
          indicatorColor="primary"
          textColor="primary"
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab icon={<FlagIcon fontSize="small" />} iconPosition="start" label="Validated Findings" />
          <Tab icon={<ForumIcon fontSize="small" />} iconPosition="start" label="Reflections & Prompts" />
          <Tab icon={<ShieldIcon fontSize="small" />} iconPosition="start" label="Action Guide" />
        </Tabs>

        {/* Tab 0: Validated Findings & Tactics */}
        {tabIndex === 0 && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Identified Safety Tactics & Observations ({validatedFindings.length})
            </Typography>

            {reviewLoading ? <Alert severity="info">Loading persisted review…</Alert> : reviewError ? <Alert severity="error">Review is temporarily unavailable.</Alert> : review ? <Stack spacing={1}><Typography variant="body2">Annotated concerns: {review.total_annotated_concerns} · Identified: {review.identified_concerns} · To revisit: {review.unresolved_concerns}</Typography>{review.concerns.filter((c) => c.identified || c.selected_for_revisit).map((c) => <Paper key={c.element_key} sx={{ p: 2 }}><Typography variant="subtitle2">{c.tactic_tag.replace(/_/g, " ")}</Typography><Typography variant="body2">{c.text}</Typography>{c.shared_reasoning && <Typography variant="caption">Shared reflection: {c.shared_reasoning}</Typography>}</Paper>)}</Stack> : validatedFindings.length > 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr', gap: 2 }}>
                {validatedFindings.map((finding, idx) => (
                  <Paper
                    key={`${finding.element_key}-${idx}`}
                    elevation={0}
                    sx={{
                      p: 2,
                      borderRadius: 2.5,
                      bgcolor: 'action.hover',
                      border: '1px solid',
                      borderColor: 'divider',
                    }}
                  >
                    <Stack spacing={1}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <Chip
                          size="small"
                          color="warning"
                          label={finding.tactic_tag.replace(/_/g, ' ').toUpperCase()}
                          sx={{ fontWeight: 700, fontSize: '0.7rem' }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          Element: {finding.element_key}
                        </Typography>
                      </Box>
                      {finding.explanation && (
                        <Typography variant="body2" sx={{ color: 'text.primary', fontWeight: 500 }}>
                          {finding.explanation}
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                ))}
              </Box>
            ) : (
              <Alert severity="info" sx={{ borderRadius: 2.5 }}>
                No persisted concern summary is available yet. You can revisit the scene together.
              </Alert>
            )}
          </Stack>
        )}

        {review && (review.completed_checkpoints.length > 0 || review.shared_discussion.length > 0 || review.suggested_next_steps.length > 0 || review.practice_areas.length > 0) && (
          <Paper sx={{ p: 2 }}><Typography variant="subtitle2">Discussion and next steps</Typography><Typography variant="body2">Completed checkpoints: {review.completed_checkpoints.length}</Typography>{[...review.completed_checkpoints.map((item) => item.text), ...review.shared_discussion.map((item) => item.text), ...review.suggested_next_steps, ...review.practice_areas].map((item, i) => <Typography key={i} variant="body2">• {item}</Typography>)}</Paper>
        )}

        {/* Tab 1: Shareable Excerpts & Discussion Prompts */}
        {tabIndex === 1 && (
          <Stack spacing={2.5}>
            {/* Shareable Learner Excerpts */}
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
                Learner's Shareable Reflections ({sharedExcerpts.length})
              </Typography>
              {sharedExcerpts.length > 0 ? (
                <Stack spacing={1.5}>
                  {sharedExcerpts.map((excerpt) => (
                    <Paper
                      key={excerpt.id}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: 'action.selected',
                        borderLeft: '4px solid',
                        borderLeftColor: 'primary.main',
                      }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                        Reflecting on Checkpoint Prompt:
                      </Typography>
                      <Typography variant="body2" sx={{ fontStyle: 'italic', mt: 0.5, fontWeight: 500 }}>
                        "{excerpt.response_text}"
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              ) : (
                <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                  No reflections were explicitly saved for sharing.
                </Typography>
              )}
            </Box>

            {/* Caregiver Discussion Notes */}
            {caregiverComments.length > 0 && (
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary', mb: 1 }}>
                  Caregiver Discussion Notes ({caregiverComments.length})
                </Typography>
                <Stack spacing={1.5}>
                  {caregiverComments.map((comment) => (
                    <Paper
                      key={comment.comment_ref}
                      elevation={0}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        bgcolor: 'action.hover',
                        borderLeft: '4px solid',
                        borderLeftColor: 'secondary.main',
                      }}
                    >
                      <Typography variant="caption" color="secondary.main" sx={{ fontWeight: 800 }}>
                        {comment.author_display_name} • {comment.child_visible_label || 'Caregiver Guidance'}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 0.5 }}>
                        "{comment.text}"
                      </Typography>
                    </Paper>
                  ))}
                </Stack>
              </Box>
            )}

            {/* Guided Conversation Prompts */}
            <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main' }}>
              <Stack spacing={1.5}>
                <Typography variant="subtitle2" color="primary" sx={{ fontWeight: 800 }}>
                  Guided Discussion Prompts for Family Talk
                </Typography>
                <Stack spacing={1}>
                  {discussionPrompts.map((promptText, idx) => (
                    <Typography key={idx} variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                      <strong>{idx + 1}.</strong> {promptText}
                    </Typography>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          </Stack>
        )}

        {/* Tab 2: Practical Help / Report / Block / Privacy Actions */}
        {tabIndex === 2 && (
          <Stack spacing={2}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, textTransform: 'uppercase', color: 'text.secondary' }}>
              Practical Family Protection & Safety Actions
            </Typography>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
              <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <BlockIcon color="error" />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Block & Mute Aggressors
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Immediately block users who push boundaries, threaten, or harass. Do not engage in arguments.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <ReportProblemIcon color="warning" />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Report & Keep Screenshots
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Save evidence with timestamps before reporting in-app or to platform moderators.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <LockIcon color="primary" />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Privacy & Password Protection
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Never share passwords, verification codes, or personal photos with online acquaintances.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>

              <Paper elevation={0} sx={{ p: 2, borderRadius: 2.5, border: '1px solid', borderColor: 'divider' }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                  <HelpCenterIcon color="info" />
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Reach Out to Trusted Adults
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Parents, teachers, counselors, and support helplines are available whenever anything feels uncomfortable.
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            </Box>
          </Stack>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Action Buttons */}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ justifyContent: 'space-between' }}>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBackIcon />}
            onClick={onReturnToLibrary}
            sx={{ borderRadius: 2.5, px: 2.5, py: 1, textTransform: 'none', fontWeight: 700 }}
          >
            Return to Library
          </Button>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            {onOpenHelpResources && (
              <Button
                variant="outlined"
                color="info"
                startIcon={<HelpCenterIcon />}
                onClick={onOpenHelpResources}
                sx={{ borderRadius: 2.5, px: 2, py: 1, textTransform: 'none', fontWeight: 700 }}
              >
                Who Could Help?
              </Button>
            )}
            {onContinueLater && (
              <Button
                variant="contained"
                color="primary"
                endIcon={<ArrowForwardIcon />}
                onClick={onContinueLater}
                sx={{ borderRadius: 2.5, px: 2.5, py: 1, textTransform: 'none', fontWeight: 700 }}
              >
                Finish & View Guide
              </Button>
            )}
          </Stack>
        </Stack>
      </Stack>
    </Paper>
  );
}
