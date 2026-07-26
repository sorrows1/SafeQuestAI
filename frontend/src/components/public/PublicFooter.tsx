import { Box, Button, Container, Divider, Stack, Typography, useTheme } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleTheme } from '@/store/uiSlice';

export function PublicFooter() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const theme = useTheme();

  return (
    <Box component="footer" sx={{ borderTop: `1px solid ${theme.palette.divider}`, py: 6, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Stack spacing={4}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} sx={{ justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' } }}>
            {/* Brand */}
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <Box
                sx={{
                  width: 36,
                  height: 36,
                  borderRadius: '8px',
                  bgcolor: theme.palette.mode === 'dark' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'primary.main',
                }}
              >
                <ShieldOutlinedIcon sx={{ fontSize: 20 }} />
              </Box>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Safe Quest Digital Safety
              </Typography>
            </Stack>

            {/* Quick Links */}
            <Stack direction="row" spacing={3} sx={{ flexWrap: 'wrap' }}>
              <Typography component="a" href="#how-it-works" variant="body2" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                How It Works
              </Typography>
              <Typography component="a" href="#for-families" variant="body2" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                For Families
              </Typography>
              <Typography component="a" href="#safety-privacy" variant="body2" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Safety & Privacy
              </Typography>
              <Typography component="a" href="#accessibility" variant="body2" color="text.secondary" sx={{ textDecoration: 'none', '&:hover': { color: 'primary.main' } }}>
                Accessibility
              </Typography>
            </Stack>

            {/* Theme Toggle */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => dispatch(toggleTheme())}
              startIcon={themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              sx={{ borderRadius: '20px', px: 2 }}
            >
              {themeMode === 'dark' ? 'Light Theme' : 'Dark Theme'}
            </Button>
          </Stack>

          <Divider />

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              © {new Date().getFullYear()} Safe Quest Platform. Reviewed digital safety learning for families.
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Discussion first · Zero grading · PII Scrubbed
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}
