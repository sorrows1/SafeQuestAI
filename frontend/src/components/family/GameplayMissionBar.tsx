import { useEffect, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Paper,
  Stack,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined';
import PauseOutlinedIcon from '@mui/icons-material/PauseOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import RotateRightIcon from '@mui/icons-material/RotateRight';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import FlagIcon from '@mui/icons-material/Flag';
import MicroscopeIcon from '@mui/icons-material/Search';

interface Props {
  title: string;
  category?: string;
  renderSkin: string;
  state: string;
  revealedCount: number;
  totalCount: number;
  highlightedCount: number;
  validatedFindingCount: number;
  requiredFindingCount: number;
  hintLevel?: number;
  turnRole?: 'learner' | 'caregiver' | 'shared';
  turnLabel?: string;
  canRevealNext?: boolean;
  canEnterReview?: boolean;
  onRevealNext?: () => void;
  onEnterReview?: () => void;
  onHint: () => void;
  hintMessage?: string | null;
  onReset: () => void;
  onOpenGuide: () => void;
  onToggleMobileInspector?: () => void;
  isResetting?: boolean;
  autoplay?: boolean;
  autoplaySpeed?: 'slow' | 'normal' | 'fast';
  onToggleAutoplay?: () => void;
  onAutoplaySpeedChange?: (speed: 'slow' | 'normal' | 'fast') => void;
}

export function GameplayMissionBar({
  title,
  category,
  renderSkin,
  state,
  revealedCount,
  totalCount,
  highlightedCount,
  validatedFindingCount = 0,
  requiredFindingCount = 0,
  hintLevel = 0,
  turnRole,
  turnLabel,
  canRevealNext = false,
  canEnterReview = false,
  onRevealNext,
  onEnterReview,
  onHint,
  hintMessage = null,
  onReset,
  onOpenGuide,
  onToggleMobileInspector,
  isResetting = false,
  autoplay = false,
  autoplaySpeed = 'slow',
  onToggleAutoplay,
  onAutoplaySpeedChange,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const progressPercent = totalCount > 0 ? Math.min(100, Math.round((revealedCount / totalCount) * 100)) : 0;
  const findingsProgressPercent = requiredFindingCount > 0 ? Math.min(100, Math.round((validatedFindingCount / requiredFindingCount) * 100)) : 100;
  const findingsComplete = requiredFindingCount > 0 && validatedFindingCount >= requiredFindingCount;
  const hintNoticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (hintMessage) hintNoticeRef.current?.focus();
  }, [hintMessage]);

  const getStatusChip = () => {
    switch (state) {
      case 'active':
      case 'in_progress':
        return (
          <Chip
            size="small"
            color="success"
            variant="outlined"
            icon={<PlayArrowOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
            label="SCENARIO ACTIVE"
            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
          />
        );
      case 'paused_for_checkpoint':
      case 'checkpoint':
        return (
          <Chip
            size="small"
            color="warning"
            icon={<PauseOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
            label="CHECKPOINT PAUSE"
            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
          />
        );
      case 'completion_review':
        return (
          <Chip
            size="small"
            color="info"
            icon={<CheckCircleOutlinedIcon sx={{ fontSize: '1rem !important' }} />}
            label="READY FOR REVIEW"
            sx={{ fontWeight: 700, fontSize: '0.7rem' }}
          />
        );
      default:
        return (
          <Chip
            size="small"
            variant="outlined"
            label={state.toUpperCase()}
            sx={{ fontWeight: 600, fontSize: '0.7rem' }}
          />
        );
    }
  };

  return (
    <Paper
      elevation={0}
      component="header"
      aria-label="Scenario gameplay mission bar"
      sx={{
        p: { xs: 1.25, sm: 1.75 },
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
        mb: { xs: 1.5, sm: 2 },
      }}
    >
      <Stack spacing={1.5}>
        {/* Top Row: Identity, Status, and Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
          {/* Title & Metadata */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 2,
                bgcolor: 'primary.main',
                color: 'primary.contrastText',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
              }}
            >
              {renderSkin === 'chat' ? '💬' : renderSkin === 'email' ? '📧' : '📱'}
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
                {title}
              </Typography>
              {category && (
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize', display: 'block', mt: 0.25 }}>
                  {category.replace('_', ' ')}
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Status & Actions */}
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
            {getStatusChip()}

            {onToggleAutoplay && (
              <Button size="small" variant={autoplay ? 'contained' : 'outlined'} startIcon={autoplay ? <PauseOutlinedIcon /> : <PlayArrowOutlinedIcon />} onClick={onToggleAutoplay} sx={{ borderRadius: '20px', textTransform: 'none', minHeight: 36 }}>
                {autoplay ? 'Pause autoplay' : 'Autoplay'}
              </Button>
            )}
            {autoplay && onAutoplaySpeedChange && (
              <Button size="small" variant="text" onClick={() => onAutoplaySpeedChange(autoplaySpeed === 'slow' ? 'normal' : autoplaySpeed === 'normal' ? 'fast' : 'slow')} aria-label="Change autoplay speed" sx={{ textTransform: 'none' }}>Speed: {autoplaySpeed}</Button>
            )}

            {/* Continue / Reveal Next Button */}
            {canRevealNext && (
              <Button
                variant="contained"
                color="primary"
                size="small"
                onClick={onRevealNext}
                startIcon={<PlayArrowOutlinedIcon />}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 700, minHeight: 36 }}
              >
                {isMobile ? 'Continue' : 'Continue Conversation'}
              </Button>
            )}

            {/* Review My Findings Button */}
            {canEnterReview && (
              <Button
                variant="outlined"
                color="secondary"
                size="small"
                onClick={onEnterReview}
                startIcon={<CheckCircleOutlinedIcon />}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 700, minHeight: 36 }}
              >
                Review My Findings
              </Button>
            )}

            {/* Hint Ladder Button */}
            <Tooltip title={hintLevel > 0 ? `Current hint level: ${hintLevel}. Click for another discussion hint.` : 'Get age-appropriate discussion hint'}>
              <Button
                variant={hintLevel > 0 ? 'contained' : 'outlined'}
                color="info"
                size="small"
                onClick={onHint}
                startIcon={<LightbulbOutlinedIcon />}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, minHeight: 36 }}
              >
                {!isMobile ? (hintLevel > 0 ? `Hint L${hintLevel}` : 'Hint') : hintLevel > 0 ? `L${hintLevel}` : ''}
              </Button>
            </Tooltip>

            {/* Reset Button */}
            <Tooltip title="Reset activity attempt">
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                onClick={onReset}
                disabled={isResetting}
                startIcon={<RotateRightIcon />}
                sx={{ borderRadius: '20px', textTransform: 'none', fontWeight: 600, minHeight: 36 }}
              >
                {!isMobile && 'Reset'}
              </Button>
            </Tooltip>

            {/* Guide Button */}
            <Tooltip title="How to play & guide">
              <IconButton color="primary" onClick={onOpenGuide} aria-label="Open activity guide" size="small" sx={{ minWidth: 36, minHeight: 36 }}>
                <HelpOutlineOutlinedIcon />
              </IconButton>
            </Tooltip>

            {/* Mobile Inspector Drawer Button */}
            {isMobile && onToggleMobileInspector && (
              <IconButton
                color="primary"
                onClick={onToggleMobileInspector}
                aria-label="Toggle inspector rail"
                size="small"
                sx={{ border: '1px solid', borderColor: 'divider', minWidth: 36, minHeight: 36 }}
              >
                <MicroscopeIcon />
              </IconButton>
            )}
          </Stack>
        </Box>

        {hintMessage && (
          <Alert ref={hintNoticeRef} tabIndex={-1} role="status" aria-live="polite" severity="info" sx={{ outline: "none" }}>
            {hintMessage}
          </Alert>
        )}

        {/* Bottom Row: Findings Counter + Dual Progress Bars */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* Findings Counter */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Chip
              size="small"
              icon={<FlagIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`Findings: ${validatedFindingCount}/${requiredFindingCount}`}
              color={findingsComplete ? 'success' : validatedFindingCount > 0 ? 'primary' : 'default'}
              variant={validatedFindingCount > 0 ? 'filled' : 'outlined'}
              sx={{
                fontWeight: 800,
                fontSize: '0.75rem',
                px: 0.5,
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
            {findingsComplete && (
              <Chip
                size="small"
                color="success"
                icon={<CheckCircleOutlinedIcon sx={{ fontSize: '0.9rem !important' }} />}
                label="All flags found!"
                sx={{ fontWeight: 700, fontSize: '0.7rem' }}
              />
            )}
          </Box>

          {/* Conversation Progress Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                variant="determinate"
                value={progressPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    backgroundImage: 'linear-gradient(90deg, #1976d2, #42a5f5)',
                  },
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 60, textAlign: 'right', whiteSpace: 'nowrap' }}>
              Conversation {progressPercent}%
            </Typography>
          </Box>

          {/* Findings Progress Bar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ flexGrow: 1 }}>
              <LinearProgress
                variant="determinate"
                value={findingsProgressPercent}
                sx={{
                  height: 6,
                  borderRadius: 3,
                  bgcolor: 'action.hover',
                  '& .MuiLinearProgress-bar': {
                    borderRadius: 3,
                    bgcolor: findingsComplete ? 'success.main' : 'secondary.main',
                  },
                }}
              />
            </Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, minWidth: 60, textAlign: 'right', whiteSpace: 'nowrap' }}>
              Flags {validatedFindingCount}/{requiredFindingCount}
            </Typography>
          </Box>
        </Box>
      </Stack>
    </Paper>
  );
}
