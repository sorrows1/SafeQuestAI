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

interface Props {
  open: boolean;
  onClose: () => void;
}

export function InstructionsGuideModal({ open, onClose }: Props) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { sx: { borderRadius: 3, p: 1 } } }}>
      <DialogTitle component="div" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <GraduationCapIcon />
          </Box>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              How to Play SafeQuest
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Family safety activity guide
            </Typography>
          </Box>
        </Stack>
        <IconButton onClick={onClose} aria-label="Close guide">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ border: 'none', py: 2 }}>
        <Stack spacing={2}>
          {/* Step 1 */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                1
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <VisibilityIcon fontSize="small" color="primary" /> Read the Conversation
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Carefully review the conversation between characters in the simulation surface.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Step 2 */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'warning.main', color: 'warning.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                2
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TouchAppIcon fontSize="small" color="warning" /> Identify Red Flags
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Click on messages that feel manipulative, aggressive, isolating, or unsafe to inspect them.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Step 3 */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }}
          >
            <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start' }}>
              <Box sx={{ width: 28, height: 28, borderRadius: '50%', bgcolor: 'secondary.main', color: 'secondary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.8rem', flexShrink: 0 }}>
                3
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 1 }}>
                  <ForumIcon fontSize="small" color="secondary" /> Pause & Discuss Together
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  When a checkpoint pause occurs, pause and talk through what you noticed and how to respond safely.
                </Typography>
              </Box>
            </Stack>
          </Paper>

          {/* Non-judgmental note */}
          <Paper
            elevation={0}
            sx={{ p: 2, borderRadius: 2, bgcolor: 'success.light', color: 'success.contrastText', display: 'flex', alignItems: 'center', gap: 1.5 }}
          >
            <ShieldIcon fontSize="small" color="success" />
            <Typography variant="caption" sx={{ fontWeight: 600 }}>
              SafeQuest activities have no grades or scores. The goal is learning and open family communication.
            </Typography>
          </Paper>
        </Stack>
      </DialogContent>

      <DialogActions sx={{ p: 2 }}>
        <Button variant="contained" fullWidth onClick={onClose} sx={{ borderRadius: 2, py: 1.2, fontWeight: 700 }}>
          Got It, Let's Begin
        </Button>
      </DialogActions>
    </Dialog>
  );
}
