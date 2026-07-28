import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import GraduationCapIcon from '@mui/icons-material/School';
import VisibilityIcon from '@mui/icons-material/Visibility';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import ForumIcon from '@mui/icons-material/Forum';
import ShieldIcon from '@mui/icons-material/Shield';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InstructionsGuideModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, p: { xs: 0.5, sm: 1 } } } }}>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1, pt: 2, px: 2.5 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 42,
              height: 42,
              borderRadius: 2.5,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          >
            <GraduationCapIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              How to Play SafeQuest
            </Typography>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              Interactive family safety walkthrough
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} aria-label="Close guide" size="small">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ border: 'none', py: 1.5, px: 2.5 }}>
        <Stack spacing={2}>
          {/* Step 1: Read & Observe */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                1
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VisibilityIcon fontSize="small" color="primary" /> Read & Look for Red Flags
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
                  The conversation contains hidden red flags — pressure tactics, manipulation, or unsafe requests. Read each message carefully. Your goal is to find <strong>ALL</strong> the red flags before completing the scenario.
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontWeight: 600 }}>
                  Use the <strong>Continue Conversation</strong> button to advance. The conversation will never auto-advance — you decide when you are ready to move on.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Step 2: Select & Explain */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'warning.main', color: 'warning.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                2
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TouchAppIcon fontSize="small" color="warning" /> Select & Investigate Suspicious Items
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
                  Tap any message or element to select it (it will show a blue border). Then, in the inspector panel, explain why it concerns you and check it with your Safety Companion.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Step 3: Companion & Checkpoints */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'secondary.main', color: 'secondary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                3
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <HelpOutlineOutlinedIcon fontSize="small" color="secondary" /> Hints & Checkpoints
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
                  Stuck? Tap <strong>Hint</strong> for guidance about a selected item. At checkpoint pauses, share your reflection to continue. Your findings count toward your progress — find all red flags to complete the scenario.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Step 4: Review & Complete */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2.5, bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', boxShadow: '0 1px 4px rgba(0,0,0,0.02)' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 30, height: 30, borderRadius: '50%', bgcolor: 'success.main', color: 'success.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.85rem', flexShrink: 0 }}>
                4
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ForumIcon fontSize="small" color="success" /> Review & Complete
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.45 }}>
                  Once you have found all red flags, click <strong>Review My Findings</strong> to enter the completion review. The scenario can only be completed when all required red flags have been identified.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Non-judgmental note */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2, bgcolor: 'success.50', border: '1px solid', borderColor: 'success.200', display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <ShieldIcon fontSize="small" color="success" />
            <Typography variant="caption" sx={{ fontWeight: 700, color: 'success.900' }}>
              SafeQuest activities are non-graded. The goal is empowering open communication and critical thinking.
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2.5 }}>
        <Button variant="contained" fullWidth onClick={onClose} sx={{ borderRadius: 2.5, py: 1.25, fontWeight: 800, textTransform: 'none' }}>
          Got It, Let's Begin
        </Button>
      </DialogActions>
    </Dialog>
  );
}

