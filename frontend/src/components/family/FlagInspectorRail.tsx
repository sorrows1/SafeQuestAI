import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  LinearProgress,
  Link,
  Paper,
  Skeleton,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import FlagIcon from '@mui/icons-material/Flag';
import MicroscopeIcon from '@mui/icons-material/Search';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import SendIcon from '@mui/icons-material/Send';
import SecurityIcon from '@mui/icons-material/Security';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ReplayIcon from '@mui/icons-material/Replay';
import type { FamilyMessage, FlagAttempt, ValidatedFinding } from '@/types';

export interface CompanionNotice {
  text: string;
  disclosure: boolean;
  resources: Array<{ label: string; href: string }>;
}

export type ClaimType = 'red_flag' | 'not_red_flag' | 'unsure';

export interface FlagInspectorRailProps {
  scenarioTitle?: string;
  scenarioDescription?: string;
  showContextCard?: boolean;
  messages: FamilyMessage[];
  highlightedMessageIds: number[];
  tagAssignments: Record<number, string>;
  selectedMessageId: number | null;
  onSelectMessage: (id: number | null) => void;
  selectedElementKey?: string | null;

  // Companion & Attempt props
  companionNotice?: CompanionNotice | null;
  onAskCompanion?: (text: string) => Promise<void>;
  onSubmitAttempt?: (args: { element_key: string; claim: ClaimType; reasoning: string }) => Promise<void>;
  pendingAttempt?: boolean;
  lastAttempt?: FlagAttempt | null;
  validatedFindings?: ValidatedFinding[];
  isExplaining?: boolean;
  children?: ReactNode;
}

export function ScenarioDescriptionCard({ scenarioDescription }: { scenarioDescription?: string }) {
  return (
    <Paper
      elevation={0}
      sx={{
        p: 2.5,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 2px 10px rgba(0,0,0,0.03)',
      }}
    >
      <Stack spacing={1.5}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'primary.main' }}>
          <InfoOutlinedIcon fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Scenario Description
          </Typography>
        </Box>
        <Typography variant="body2" color="text.secondary">
          {scenarioDescription || 'A reviewed situation for a calm family conversation.'}
        </Typography>
        <Box
          sx={{
            p: 1.5,
            borderRadius: 2,
            bgcolor: 'action.hover',
            border: '1px solid',
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 1.25,
          }}
        >
          <SecurityIcon color="primary" sx={{ fontSize: 20, mt: 0.2 }} />
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.primary' }}>
            Spot manipulative red flags or pressure tactics in the scene. Click any message to evaluate it together with your Safety Companion.
          </Typography>
        </Box>
      </Stack>
    </Paper>
  );
}

export function FlagInspectorRail({
  scenarioDescription,
  showContextCard = true,
  messages,
  highlightedMessageIds,
  tagAssignments,
  selectedMessageId,
  onSelectMessage,
  selectedElementKey,
  companionNotice = null,
  onAskCompanion,
  onSubmitAttempt,
  pendingAttempt = false,
  lastAttempt = null,
  validatedFindings = [],
  isExplaining = false,
  children,
}: FlagInspectorRailProps) {
  const [claim, setClaim] = useState<ClaimType>('red_flag');
  const [reasoningInput, setReasoningInput] = useState('');
  const [generalInput, setGeneralInput] = useState('');
  const feedbackRef = useRef<HTMLDivElement>(null);

  // Find currently selected message object
  const activeMessage = messages.find((m) => m.id === selectedMessageId);
  const highlightedMessages = messages.filter((m) => highlightedMessageIds.includes(m.id));
  const [revisitingCompletedElement, setRevisitingCompletedElement] = useState(false);
  const selectedFinding = selectedElementKey
    ? validatedFindings.find((finding) => (finding.element_keys ?? [finding.element_key]).includes(selectedElementKey))
    : undefined;

  useEffect(() => {
    setRevisitingCompletedElement(false);
  }, [selectedElementKey]);

  const handleClaimChange = (_: React.MouseEvent<HTMLElement>, newClaim: ClaimType | null) => {
    if (newClaim) {
      setClaim(newClaim);
    }
  };

  const handleSubmittingAttempt = async () => {
    if (!reasoningInput.trim() && claim !== 'unsure') return;
    const targetKey = selectedElementKey || (activeMessage ? `msg-${activeMessage.id}` : null);
    if (onSubmitAttempt && targetKey) {
      await onSubmitAttempt({
        element_key: targetKey,
        claim,
        reasoning: reasoningInput.trim() || 'Need help evaluating this message.',
      });
      setReasoningInput('');
      setRevisitingCompletedElement(false);
    } else if (onAskCompanion) {
      await onAskCompanion(reasoningInput.trim());
      setReasoningInput('');
      setRevisitingCompletedElement(false);
    }
  };

  const handleSendGeneralQuestion = async () => {
    if (!generalInput.trim() || !onAskCompanion) return;
    await onAskCompanion(generalInput.trim());
    setGeneralInput('');
  };

  const jumpToFeedback = () => {
    feedbackRef.current?.scrollIntoView({ behavior: 'smooth' });
    feedbackRef.current?.focus();
  };

  return (
    <Stack spacing={2.5} sx={{ height: '100%' }}>
      {showContextCard && <ScenarioDescriptionCard scenarioDescription={scenarioDescription} />}

      {/* 2. Flag Inspector & Reasoning Composer Card */}
      <Paper
        elevation={0}
        component="section"
        aria-label="Flag Inspector and Reasoning Composer"
        sx={{
          p: 2.5,
          borderRadius: 3,
          border: '1.5px solid',
          borderColor: selectedMessageId ? 'primary.main' : 'divider',
          bgcolor: 'background.paper',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: selectedMessageId ? '0 4px 20px rgba(25, 118, 210, 0.12)' : '0 2px 8px rgba(0,0,0,0.03)',
        }}
      >
        <Stack spacing={2}>
          {/* Header */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <MicroscopeIcon color={selectedMessageId ? 'primary' : 'disabled'} fontSize="small" />
              <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                Flag Inspector
              </Typography>
            </Stack>

            {activeMessage ? (
              <Chip
                size="small"
                color="primary"
                icon={<FlagIcon sx={{ fontSize: '0.8rem !important' }} />}
                label="SELECTED FOR REVIEW"
                sx={{ fontWeight: 700, fontSize: '0.65rem', letterSpacing: '0.03em' }}
              />
            ) : (
              <Chip
                size="small"
                variant="outlined"
                label="AWAITING SELECTION"
                sx={{ fontWeight: 600, fontSize: '0.65rem' }}
              />
            )}
          </Box>

          {/* Dynamic Inspector Content / Reasoning Composer */}
          {activeMessage && (!selectedFinding || revisitingCompletedElement) ? (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'action.selected',
                border: '1px solid',
                borderColor: 'primary.main',
                animation: 'fadeIn 0.2s ease-in-out',
                '@keyframes fadeIn': {
                  from: { opacity: 0, transform: 'translateY(-4px)' },
                  to: { opacity: 1, transform: 'translateY(0)' },
                },
              }}
            >
              <Stack spacing={2}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'primary.main', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Box component="span" sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main', display: 'inline-block' }} />
                    {activeMessage.speaker_label || 'Sender'}
                  </Typography>
                  {tagAssignments[activeMessage.id] && (
                    <Chip
                      size="small"
                      color="primary"
                      label={tagAssignments[activeMessage.id]}
                      sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                    />
                  )}
                </Box>

                <Paper
                  elevation={0}
                  sx={{
                    p: 1.5,
                    borderRadius: 1.5,
                    bgcolor: 'background.paper',
                    borderLeft: '3px solid',
                    borderLeftColor: 'primary.main',
                    borderTop: '1px solid',
                    borderRight: '1px solid',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                  }}
                >
                  <Typography variant="body2" sx={{ fontStyle: 'italic', fontWeight: 500 }}>
                    "{activeMessage.content}"
                  </Typography>
                </Paper>

                {/* Reasoning Composer Form */}
                <Stack spacing={1.5}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.primary', display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <SecurityIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                    What is your safety evaluation of this item?
                  </Typography>

                  <ToggleButtonGroup
                    value={claim}
                    exclusive
                    onChange={handleClaimChange}
                    aria-label="Claim evaluation options"
                    size="small"
                    fullWidth
                    sx={{
                      '& .MuiToggleButton-root': {
                        minHeight: 44,
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'none',
                        py: 1,
                        borderRadius: '12px !important',
                        mx: 0.25,
                      },
                    }}
                  >
                    <ToggleButton value="red_flag" color="primary">
                      <FlagIcon sx={{ fontSize: 16, mr: 0.5 }} /> Red Flag
                    </ToggleButton>
                    <ToggleButton value="not_red_flag" color="info">
                      <CheckCircleOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} /> Safe
                    </ToggleButton>
                    <ToggleButton value="unsure" color="warning">
                      <HelpOutlineOutlinedIcon sx={{ fontSize: 16, mr: 0.5 }} /> Unsure
                    </ToggleButton>
                  </ToggleButtonGroup>

                  <Box sx={{ position: 'relative' }}>
                    <TextField
                      placeholder={claim === 'unsure' ? "Ask the companion why this item might be suspicious..." : "Explain why you chose this evaluation (Required)..."}
                      value={reasoningInput}
                      onChange={(e) => setReasoningInput(e.target.value)}
                      multiline
                      minRows={2}
                      fullWidth
                      size="small"
                      slotProps={{
                        htmlInput: {
                          'aria-label': 'Reasoning explanation input',
                        },
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderColor: !reasoningInput.trim() && claim !== 'unsure' ? 'primary.light' : undefined,
                        },
                      }}
                    />
                    {!reasoningInput.trim() && claim !== 'unsure' && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5, fontStyle: 'italic', fontSize: '0.7rem' }}>
                        * Reasoning explanation is required before checking red flags.
                      </Typography>
                    )}
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pt: 0.5 }}>
                    <Button
                      size="small"
                      color="inherit"
                      onClick={() => onSelectMessage(null)}
                      sx={{ fontSize: '0.75rem', textTransform: 'none', minHeight: 44 }}
                    >
                      Deselect
                    </Button>

                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      onClick={handleSubmittingAttempt}
                      disabled={pendingAttempt || isExplaining || (!reasoningInput.trim() && claim !== 'unsure')}
                      startIcon={
                        pendingAttempt ? (
                          <CircularProgress size={16} color="inherit" />
                        ) : (
                          <SendIcon sx={{ fontSize: '0.9rem !important' }} />
                        )
                      }
                      sx={{
                        borderRadius: '20px',
                        textTransform: 'none',
                        fontWeight: 700,
                        minHeight: 44,
                        px: 2.5,
                        boxShadow: '0 4px 12px rgba(25, 118, 210, 0.25)',
                      }}
                    >
                      {pendingAttempt ? 'Analyzing...' : 'Check with Companion'}
                    </Button>
                  </Box>
                </Stack>
              </Stack>
            </Box>
          ) : activeMessage ? (
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "action.hover", border: "1.5px dashed", borderColor: "success.main" }}>
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircleOutlinedIcon color="success" fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'success.main' }}>
                    Discussion Complete
                  </Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  You already explored this item with the Safety Companion. Review the saved insight below, or choose to discuss it again.
                </Typography>
                <Button
                  variant="outlined"
                  color="primary"
                  size="small"
                  startIcon={<ReplayIcon fontSize="small" />}
                  onClick={() => setRevisitingCompletedElement(true)}
                  sx={{ alignSelf: "flex-start", textTransform: "none", borderRadius: '18px', fontWeight: 700 }}
                >
                  Discuss this item again
                </Button>
              </Stack>
            </Box>
          ) : (
            <Box
              sx={{
                p: 3,
                borderRadius: 2,
                border: '1.5px dashed',
                borderColor: 'divider',
                bgcolor: 'action.hover',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: 140,
                transition: 'all 0.2s ease',
              }}
            >
              <TouchAppIcon sx={{ fontSize: 36, color: 'primary.main', mb: 1, opacity: 0.8 }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.primary' }}>
                Select an item in the scene
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ maxWidth: 240, mt: 0.5 }}>
                Click on any message or element in the scenario to evaluate it together with your Safety Companion.
              </Typography>
            </Box>
          )}

          {/* Pending State Indicator */}
          {pendingAttempt && (
            <Box
              sx={{
                p: 2,
                borderRadius: 2,
                bgcolor: 'primary.50',
                border: '1px solid',
                borderColor: 'primary.light',
              }}
              aria-live="polite"
            >
              <Stack spacing={1.5}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <AutoAwesomeIcon color="primary" sx={{ fontSize: 18, animation: 'pulse 1.5s infinite' }} />
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700 }}>
                    Companion is evaluating your reasoning...
                  </Typography>
                </Box>
                <Skeleton variant="rectangular" height={12} sx={{ borderRadius: 1.5 }} />
                <LinearProgress color="primary" sx={{ height: 6, borderRadius: 3 }} />
              </Stack>
            </Box>
          )}

          {/* 3. Skip Link & Companion Feedback Display */}
          {(companionNotice || lastAttempt) && (
            <Box
              ref={feedbackRef}
              tabIndex={-1}
              id="companion-feedback-section"
              aria-live="polite"
              sx={{ pt: 1, outline: 'none' }}
            >
              <Divider sx={{ mb: 1.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'secondary.main' }}>
                  <SmartToyOutlinedIcon fontSize="small" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    Companion Feedback
                  </Typography>
                </Stack>
                <Link
                  component="button"
                  onClick={jumpToFeedback}
                  underline="hover"
                  sx={{ fontSize: '0.7rem', fontWeight: 700 }}
                >
                  Jump to feedback
                </Link>
              </Box>

              {/* Neutral Feedback Card for Non-Flag or Encouraging Attempts */}
              {lastAttempt && (
                <Alert
                  severity={
                    lastAttempt.validation_result === 'validated'
                      ? 'success'
                      : lastAttempt.validation_result === 'needs_support'
                      ? 'warning'
                      : 'info'
                  }
                  icon={
                    lastAttempt.validation_result === 'validated' ? (
                      <CheckCircleOutlinedIcon fontSize="inherit" />
                    ) : (
                      <LightbulbOutlinedIcon fontSize="inherit" />
                    )
                  }
                  sx={{
                    borderRadius: 2.5,
                    border: '1.5px solid',
                    borderColor:
                      lastAttempt.validation_result === 'validated' ? 'success.main' : lastAttempt.validation_result === 'needs_support' ? 'warning.main' : 'info.main',
                    boxShadow: '0 2px 10px rgba(0,0,0,0.04)',
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      {lastAttempt.validation_result === 'validated'
                        ? 'Confirmed Red Flag Insight'
                        : lastAttempt.validation_result === 'needs_support'
                        ? 'Needs Further Support'
                        : "Let's Look Closer Together"}
                    </Typography>
                    {lastAttempt.validation_result === 'validated' && (
                      <Chip label="VALIDATED" color="success" size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800 }} />
                    )}
                  </Box>
                  <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.5 }}>
                    {String(
                      lastAttempt.feedback?.explanation ||
                        lastAttempt.feedback?.response_text ||
                        'Good observation! Let’s keep looking closely at the details together.'
                    )}
                  </Typography>

                  {/* Validated Tactic Tag Chips */}
                  {lastAttempt.findings && lastAttempt.findings.length > 0 && (
                    <Stack direction="row" spacing={1} sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.5 }}>
                      {lastAttempt.findings.filter((finding, index, all) => all.findIndex((candidate) => candidate.tactic_tag === finding.tactic_tag) === index).map((f) => (
                        <Chip
                          key={f.insight_key ?? (f.element_key + ":" + f.annotation_id)}
                          size="small"
                          color="primary"
                          label={f.tactic_tag.replace(/_/g, ' ')}
                          sx={{ fontWeight: 700, fontSize: '0.65rem' }}
                        />
                      ))}
                    </Stack>
                  )}
                </Alert>
              )}

              {/* Direct Companion Message Alert */}
              {companionNotice && !lastAttempt && (
                <Alert
                  severity={companionNotice.disclosure ? 'warning' : 'info'}
                  sx={{ borderRadius: 2.5, mt: 1 }}
                >
                  <Typography variant="body2" sx={{ lineHeight: 1.5 }}>
                    {companionNotice.text}
                  </Typography>
                  {companionNotice.resources.map((resource) => (
                    <Link
                      key={resource.href}
                      href={resource.href}
                      target="_blank"
                      rel="noreferrer"
                      sx={{ display: 'block', mt: 1, fontWeight: 700 }}
                    >
                      {resource.label}
                    </Link>
                  ))}
                </Alert>
              )}
            </Box>
          )}

          {/* 4. Validated Findings Cards & Tactic List */}
          {validatedFindings.length > 0 && (
            <Box sx={{ pt: 1 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontWeight: 800,
                    textTransform: 'uppercase',
                    color: 'text.secondary',
                    letterSpacing: 0.5,
                  }}
                >
                  Validated Safety Insights ({validatedFindings.length})
                </Typography>
                <Chip size="small" label="MERGED & DEDUPLICATED" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
              </Box>
              <Stack spacing={1} sx={{ mt: 1, maxHeight: 180, overflowY: 'auto', pr: 0.5 }}>
                {validatedFindings.map((finding) => {
                  const findingElementKeys = finding.element_keys ?? [finding.element_key];
                  const matchedMsg = messages.find((m) => findingElementKeys.includes("msg-" + m.id) || findingElementKeys.includes("message-" + m.id) || findingElementKeys.includes(String(m.id)));
                  return (
                    <Paper
                      key={finding.insight_key ?? (finding.element_key + ":" + finding.annotation_id)}
                      elevation={0}
                      tabIndex={0}
                      role="button"
                      aria-label={`View validated finding ${finding.tactic_tag}`}
                      onClick={() => {
                        if (matchedMsg) onSelectMessage(matchedMsg.id);
                      }}
                      onKeyDown={(e) => {
                        if ((e.key === 'Enter' || e.key === ' ') && matchedMsg) {
                          e.preventDefault();
                          onSelectMessage(matchedMsg.id);
                        }
                      }}
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'primary.main',
                        bgcolor: 'background.paper',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                        '&:hover': { bgcolor: 'action.hover', transform: 'translateX(2px)' },
                        '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
                      }}
                    >
                      <Stack spacing={0.5}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <Chip
                            size="small"
                            color="primary"
                            label={finding.tactic_tag.replace(/_/g, ' ')}
                            sx={{ fontWeight: 700, fontSize: '0.625rem', height: 20 }}
                          />
                          <ArrowForwardIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        </Box>
                        {finding.explanation && (
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                            {finding.explanation}
                          </Typography>
                        )}
                      </Stack>
                    </Paper>
                  );
                })}
              </Stack>
            </Box>
          )}

          {/* Legacy Highlighted Message Fallback */}
          {highlightedMessages.length > 0 && validatedFindings.length === 0 && (
            <Box sx={{ pt: 1 }}>
              <Divider sx={{ mb: 1.5 }} />
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  letterSpacing: 0.5,
                }}
              >
                Selected Messages ({highlightedMessages.length})
              </Typography>
              <Stack spacing={1} sx={{ mt: 1, maxHeight: 160, overflowY: 'auto', pr: 0.5 }}>
                {highlightedMessages.map((m) => (
                  <Paper
                    key={m.id}
                    elevation={0}
                    onClick={() => onSelectMessage(m.id)}
                    sx={{
                      p: 1,
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: selectedMessageId === m.id ? 'primary.main' : 'divider',
                      bgcolor: selectedMessageId === m.id ? 'action.selected' : 'background.paper',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      '&:hover': { bgcolor: 'action.hover' },
                    }}
                  >
                    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', overflow: 'hidden' }}>
                      <FlagIcon color="primary" sx={{ fontSize: 16, flexShrink: 0 }} />
                      <Typography variant="caption" sx={{ fontWeight: 600 }} noWrap>
                        {m.speaker_label}: {m.content}
                      </Typography>
                    </Stack>
                  </Paper>
                ))}
              </Stack>
            </Box>
          )}
        </Stack>
      </Paper>

      {/* 5. General Companion Questions Card (Compact Accordion) */}
      <Accordion
        elevation={0}
        sx={{
          borderRadius: '16px !important',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          '&:before': { display: 'none' },
          overflow: 'hidden',
        }}
      >
        <AccordionSummary
          expandIcon={<ExpandMoreIcon fontSize="small" />}
          sx={{ px: 2.5, minHeight: 48, '& .MuiAccordionSummary-content': { my: 1 } }}
        >
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', color: 'secondary.main' }}>
            <SmartToyOutlinedIcon fontSize="small" />
            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
              Ask the Safety Companion
            </Typography>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
          <Stack spacing={1.5}>
            <Typography variant="caption" color="text.secondary">
              Have general questions about this situation? Ask your AI safety guide anytime.
            </Typography>

            <TextField
              placeholder="Ask a question or share what you would do in this situation..."
              value={generalInput}
              onChange={(e) => setGeneralInput(e.target.value)}
              multiline
              minRows={2}
              fullWidth
              size="small"
            />

            <Button
              variant="contained"
              color="secondary"
              size="small"
              onClick={handleSendGeneralQuestion}
              disabled={!generalInput.trim() || isExplaining}
              startIcon={isExplaining ? <CircularProgress size={15} color="inherit" /> : undefined}
              endIcon={!isExplaining ? <SendIcon sx={{ fontSize: '0.9rem !important' }} /> : undefined}
              sx={{ alignSelf: 'flex-end', borderRadius: '18px', textTransform: 'none', fontWeight: 600, minHeight: 36, px: 2 }}
            >
              {isExplaining ? 'Thinking…' : 'Ask Guide'}
            </Button>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {children}
    </Stack>
  );
}


