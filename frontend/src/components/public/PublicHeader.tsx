import { AppBar, Box, Button, Container, Stack, Toolbar, Typography, useTheme } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleTheme } from '@/store/uiSlice';

export function PublicHeader() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const theme = useTheme();

  return (
    <AppBar position="sticky" color="default" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: { xs: 64, md: 72 } }}>
          {/* Logo */}
          <Box component={RouterLink} to="/" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: '10px',
                bgcolor: theme.palette.mode === 'dark' ? 'rgba(96, 165, 250, 0.15)' : 'rgba(37, 99, 235, 0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'primary.main',
              }}
            >
              <ShieldOutlinedIcon sx={{ fontSize: 24 }} />
            </Box>
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: '-0.02em', background: theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)' : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Safe Quest
            </Typography>
          </Box>

          {/* Navigation Links (Desktop) */}
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            <Typography component="a" href="#how-it-works" variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>
              How It Works
            </Typography>
            <Typography component="a" href="#for-families" variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>
              For Families
            </Typography>
            <Typography component="a" href="#safety-privacy" variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>
              Safety & Privacy
            </Typography>
            <Typography component="a" href="#gameplay-preview" variant="body2" sx={{ color: 'text.secondary', textDecoration: 'none', fontWeight: 600, '&:hover': { color: 'primary.main' } }}>
              Skins & Formats
            </Typography>
          </Stack>

          {/* Actions & Theme Toggle */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {/* Obvious Labeled Theme Switcher */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => dispatch(toggleTheme())}
              startIcon={themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              sx={{ borderRadius: '20px', px: 2, py: 0.75, fontSize: '0.8125rem' }}
            >
              {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>

            <Button component={RouterLink} to="/login" variant="text" size="medium" sx={{ fontWeight: 600 }}>
              Log in
            </Button>
            <Button component={RouterLink} to="/register" variant="contained" size="medium" sx={{ fontWeight: 600, borderRadius: '10px' }}>
              Sign up free
            </Button>
          </Stack>
        </Toolbar>
      </Container>
    </AppBar>
  );
}
