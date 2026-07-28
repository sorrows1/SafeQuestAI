import { useState } from 'react';
import { AppBar, Box, Button, Container, Divider, Drawer, IconButton, Stack, Toolbar, Typography, useTheme } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import CloseIcon from '@mui/icons-material/Close';
import { Link as RouterLink } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleTheme } from '@/store/uiSlice';

export function PublicHeader() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const theme = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navLinks = [
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'For Families', href: '#for-families' },
    { label: 'Safety & Privacy', href: '#safety-privacy' },
    { label: 'Skins & Formats', href: '#gameplay-preview' },
    { label: 'Accessibility', href: '#accessibility' },
  ];

  return (
    <AppBar position="sticky" color="default" elevation={0}>
      <Container maxWidth="lg">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: { xs: 64, md: 72 }, alignItems: 'center' }}>
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
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.02em',
                background:
                  theme.palette.mode === 'dark'
                    ? 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)'
                    : 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Safe Quest
            </Typography>
          </Box>

          {/* Navigation Links (Desktop) */}
          <Stack direction="row" spacing={3} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            {navLinks.map((link) => (
              <Typography
                key={link.href}
                component="a"
                href={link.href}
                variant="body2"
                sx={{ color: 'text.secondary', textDecoration: 'none', fontWeight: 600, '&:hover': { color: 'primary.main' }, lineHeight: 1, display: 'inline-flex', alignItems: 'center' }}
              >
                {link.label}
              </Typography>
            ))}
          </Stack>

          {/* Actions & Theme Toggle (Desktop) */}
          <Stack direction="row" spacing={1.5} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
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
              Sign up
            </Button>
          </Stack>

          {/* Mobile Navigation Toggle Button */}
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'flex', md: 'none' }, alignItems: 'center' }}>
            <Button
              variant="outlined"
              size="small"
              onClick={() => dispatch(toggleTheme())}
              startIcon={themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} mode`}
              sx={{ borderRadius: '20px', px: 1.2, py: 0.5, fontSize: '0.75rem' }}
            >
              {themeMode === 'dark' ? 'Light' : 'Dark'}
            </Button>

            <IconButton color="inherit" aria-label="Open mobile menu" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Toolbar>
      </Container>

      {/* Mobile Drawer */}
      <Drawer anchor="right" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 280, p: 2.5 }} role="presentation">
          <Stack spacing={2.5}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                <ShieldOutlinedIcon color="primary" sx={{ fontSize: 24 }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Safe Quest
                </Typography>
              </Stack>
              <IconButton size="small" onClick={() => setMobileOpen(false)} aria-label="Close menu">
                <CloseIcon fontSize="small" />
              </IconButton>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              {navLinks.map((link) => (
                <Button
                  key={link.href}
                  component="a"
                  href={link.href}
                  variant="text"
                  fullWidth
                  onClick={() => setMobileOpen(false)}
                  sx={{ justifyContent: 'flex-start', color: 'text.primary', fontWeight: 600, px: 2, py: 1 }}
                >
                  {link.label}
                </Button>
              ))}
            </Stack>

            <Divider />

            <Button
              variant="outlined"
              onClick={() => dispatch(toggleTheme())}
              startIcon={themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              fullWidth
              sx={{ borderRadius: '10px', py: 1 }}
            >
              {themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </Button>

            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              fullWidth
              onClick={() => setMobileOpen(false)}
              sx={{ borderRadius: '10px', py: 1 }}
            >
              Log in
            </Button>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              fullWidth
              onClick={() => setMobileOpen(false)}
              sx={{ borderRadius: '10px', py: 1 }}
            >
              Sign up free
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </AppBar>
  );
}
