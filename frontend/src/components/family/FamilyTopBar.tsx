import { useContext, useState } from 'react';
import { ReactReduxContext } from 'react-redux';
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Container,
  Divider,
  Drawer,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import MenuIcon from '@mui/icons-material/Menu';
import LogoutIcon from '@mui/icons-material/Logout';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { toggleTheme } from '@/store/uiSlice';
import { logout } from '@/store/authSlice';

export function FamilyTopBar() {
  const theme = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const reduxContext = useContext(ReactReduxContext);
  
  const dispatch = reduxContext ? useDispatch() : null;
  const themeMode = reduxContext ? useSelector((s: { ui?: { themeMode: 'dark' | 'light' } }) => s.ui?.themeMode ?? 'dark') : (theme.palette.mode as 'dark' | 'light');
  const user = reduxContext ? useSelector((s: { auth?: { user: { email?: string; role?: string } | null } }) => s.auth?.user ?? null) : null;

  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleOpenUserMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseUserMenu = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleCloseUserMenu();
    if (dispatch) dispatch(logout());
    navigate('/login');
  };


  const isCurrent = (path: string) => location.pathname.startsWith(path);

  const navLinks = [
    { label: 'Scenario Catalog', path: '/family/scenarios', icon: CategoryOutlinedIcon },
    { label: 'Caregiver Hub', path: '/family/hub', icon: FamilyRestroomIcon },
  ];

  return (
    <AppBar position="sticky" color="default" elevation={0}>
      <Container maxWidth="xl">
        <Toolbar disableGutters sx={{ justifyContent: 'space-between', minHeight: { xs: 60, md: 68 } }}>
          {/* Left: Mobile Menu Button & Brand Logo */}
          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            <IconButton
              color="inherit"
              aria-label="open navigation menu"
              edge="start"
              onClick={() => setMobileOpen(true)}
              sx={{ display: { xs: 'flex', md: 'none' } }}
            >
              <MenuIcon />
            </IconButton>

            <Box component={RouterLink} to="/family/scenarios" sx={{ display: 'flex', alignItems: 'center', gap: 1.5, textDecoration: 'none', color: 'inherit' }}>
              <Box
                sx={{
                  width: 38,
                  height: 38,
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
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, letterSpacing: '-0.02em' }}>
                  Safe Quest
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: { xs: 'none', sm: 'block' }, lineHeight: 1 }}>
                  Family Activity Space
                </Typography>
              </Box>
            </Box>
          </Stack>

          {/* Center: Navigation Links (Desktop) */}
          <Stack direction="row" spacing={1} sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center' }}>
            {navLinks.map((item) => {
              const Icon = item.icon;
              const active = isCurrent(item.path);
              return (
                <Button
                  key={item.path}
                  component={RouterLink}
                  to={item.path}
                  startIcon={<Icon sx={{ fontSize: 18 }} />}
                  variant={active ? 'contained' : 'text'}
                  color={active ? 'primary' : 'inherit'}
                  sx={{
                    borderRadius: '10px',
                    px: 2,
                    py: 0.8,
                    fontWeight: 600,
                    fontSize: '0.875rem',
                  }}
                >
                  {item.label}
                </Button>
              );
            })}
          </Stack>

          {/* Right: Obvious Labeled Theme Switcher & Account Avatar */}
          <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
            {/* Labeled Theme Switcher */}
            <Button
              variant="outlined"
              size="small"
              onClick={() => dispatch?.(toggleTheme())}
              startIcon={themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme mode`}
              sx={{ borderRadius: '20px', px: 2, py: 0.75, fontSize: '0.8125rem', fontWeight: 600 }}
            >
              {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </Button>

            {/* Account Menu */}
            <IconButton onClick={handleOpenUserMenu} aria-label="Account settings" sx={{ p: 0.5 }}>
              <Avatar sx={{ width: 36, height: 36, bgcolor: 'primary.main', fontSize: 14, fontWeight: 700 }}>
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </Avatar>
            </IconButton>

            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleCloseUserMenu}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
              slotProps={{ paper: { sx: { minWidth: 200, mt: 1, p: 0.5, borderRadius: 3 } } }}
            >
              <Box sx={{ px: 2, py: 1 }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {user?.email || 'Family Account'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Role: {user?.role || 'user'}
                </Typography>
              </Box>
              <Divider />
              <MenuItem onClick={handleCloseUserMenu} component={RouterLink} to="/family/scenarios">
                <CategoryOutlinedIcon sx={{ mr: 1.5, fontSize: 18, color: 'text.secondary' }} />
                Scenarios
              </MenuItem>
              <MenuItem onClick={handleLogout}>
                <LogoutIcon sx={{ mr: 1.5, fontSize: 18, color: 'error.main' }} />
                Sign out
              </MenuItem>
            </Menu>
          </Stack>
        </Toolbar>
      </Container>

      {/* Responsive Mobile Drawer */}
      <Drawer anchor="left" open={mobileOpen} onClose={() => setMobileOpen(false)}>
        <Box sx={{ width: 280, p: 2.5 }} role="presentation">
          <Stack spacing={3}>
            <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
              <ShieldOutlinedIcon color="primary" sx={{ fontSize: 28 }} />
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Safe Quest
              </Typography>
            </Stack>

            <Divider />

            <Stack spacing={1}>
              {navLinks.map((item) => {
                const Icon = item.icon;
                const active = isCurrent(item.path);
                return (
                  <Button
                    key={item.path}
                    component={RouterLink}
                    to={item.path}
                    startIcon={<Icon />}
                    variant={active ? 'contained' : 'text'}
                    fullWidth
                    onClick={() => setMobileOpen(false)}
                    sx={{ justifyContent: 'flex-start', px: 2, py: 1.2, borderRadius: 2 }}
                  >
                    {item.label}
                  </Button>
                );
              })}
            </Stack>

            <Divider />

            {/* Mobile Theme Toggle */}
            <Button
              variant="outlined"
              onClick={() => dispatch?.(toggleTheme())}
              startIcon={themeMode === 'dark' ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
              fullWidth
              sx={{ borderRadius: 2, py: 1 }}
            >
              {themeMode === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            </Button>

            <Button variant="text" color="error" startIcon={<LogoutIcon />} onClick={handleLogout} fullWidth sx={{ justifyContent: 'flex-start' }}>
              Sign out
            </Button>
          </Stack>
        </Box>
      </Drawer>
    </AppBar>
  );
}
