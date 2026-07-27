import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Divider,
  Tooltip,
  Button,
  IconButton,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import MovieIcon from '@mui/icons-material/Movie';
import PersonIcon from '@mui/icons-material/Person';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TrackChangesIcon from '@mui/icons-material/TrackChanges';
import SecurityIcon from '@mui/icons-material/Security';
import ArticleIcon from '@mui/icons-material/Article';
import PlayCircleIcon from '@mui/icons-material/PlayCircle';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import SettingsIcon from '@mui/icons-material/Settings';
import ShieldIcon from '@mui/icons-material/Shield';
import GroupIcon from '@mui/icons-material/Group';
import ChatIcon from '@mui/icons-material/Chat';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleSidebar, toggleTheme } from '@/store/uiSlice';

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 64;

const navItems = [
  { label: 'Dashboard', path: '/admin', icon: <DashboardIcon fontSize="small" /> },
  { label: 'Scenarios', path: '/admin/scenarios', icon: <MovieIcon fontSize="small" /> },
  { label: 'Personas', path: '/admin/personas', icon: <PersonIcon fontSize="small" /> },
  { label: 'Stages', path: '/admin/stages', icon: <AccountTreeIcon fontSize="small" /> },
  { label: 'Objectives', path: '/admin/objectives', icon: <TrackChangesIcon fontSize="small" /> },
  { label: 'Constraints', path: '/admin/constraints', icon: <SecurityIcon fontSize="small" /> },
  { label: 'Prompt Templates', path: '/admin/prompts', icon: <ArticleIcon fontSize="small" /> },
] as const;

const bottomItems = [
  { label: 'Family Scenarios', path: '/family/scenarios', icon: <ChatIcon fontSize="small" /> },
  { label: 'Users', path: '/admin/users', icon: <GroupIcon fontSize="small" /> },
  { label: 'Simulation Workbench', path: '/admin/simulator', icon: <PlayCircleIcon fontSize="small" /> },
  { label: 'Review Queue', path: '/admin/review-queue', icon: <FactCheckIcon fontSize="small" /> },
  { label: 'Validation', path: '/admin/validation', icon: <FactCheckIcon fontSize="small" /> },
  { label: 'Settings', path: '/admin/settings', icon: <SettingsIcon fontSize="small" /> },
] as const;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);

  const currentWidth = sidebarOpen ? EXPANDED_WIDTH : COLLAPSED_WIDTH;

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin' || location.pathname === '/admin/';
    return location.pathname.startsWith(path);
  };

  const renderItem = (item: { label: string; path: string; icon: React.ReactNode }) => {
    const active = isActive(item.path);
    const content = (
      <ListItemButton
        key={item.path}
        selected={active}
        onClick={() => navigate(item.path)}
        sx={{
          minHeight: 40,
          px: sidebarOpen ? 2 : 1.5,
          justify: sidebarOpen ? 'initial' : 'center',
        }}
      >
        <ListItemIcon
          sx={{
            minWidth: sidebarOpen ? 32 : 'auto',
            mr: sidebarOpen ? 1.5 : 'auto',
            justifyContent: 'center',
          }}
        >
          {item.icon}
        </ListItemIcon>
        {sidebarOpen && (
          <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.8125rem', whiteSpace: 'nowrap' } } }} />
        )}
      </ListItemButton>
    );

    if (!sidebarOpen) {
      return (
        <Tooltip key={item.path} title={item.label} placement="right">
          {content}
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: currentWidth,
        flexShrink: 0,
        whiteSpace: 'nowrap',
        boxSizing: 'border-box',
        '& .MuiDrawer-paper': {
          width: currentWidth,
          boxSizing: 'border-box',
          overflowX: 'hidden',
          transition: (theme) =>
            theme.transitions.create('width', {
              easing: theme.transitions.easing.sharp,
              duration: theme.transitions.duration.enteringScreen,
            }),
        },
      }}
    >
      {/* Logo & Toggle Header */}
      <Box
        sx={{
          px: sidebarOpen ? 2 : 1,
          py: 1.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: sidebarOpen ? 'space-between' : 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
          minHeight: 56,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box
            sx={{
              width: 28,
              height: 28,
              borderRadius: 1,
              background: 'linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <ShieldIcon sx={{ fontSize: 16, color: '#fff' }} />
          </Box>
          {sidebarOpen && (
            <Box sx={{ overflow: 'hidden' }}>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                Safe Quest
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.65rem', display: 'block' }}>
                Authoring Platform
              </Typography>
            </Box>
          )}
        </Box>
        <IconButton size="small" onClick={() => dispatch(toggleSidebar())} sx={{ p: 0.5 }}>
          {sidebarOpen ? <ChevronLeftIcon fontSize="small" /> : <ChevronRightIcon fontSize="small" />}
        </IconButton>
      </Box>

      {/* Main nav */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', py: 1 }}>
        {sidebarOpen && (
          <Typography
            variant="caption"
            sx={{ px: 2, py: 0.5, display: 'block', opacity: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Content
          </Typography>
        )}
        <List dense disablePadding>
          {navItems.map(renderItem)}
        </List>

        <Divider sx={{ my: 1 }} />

        {sidebarOpen && (
          <Typography
            variant="caption"
            sx={{ px: 2, py: 0.5, display: 'block', opacity: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            Tools
          </Typography>
        )}
        <List dense disablePadding>
          {bottomItems.map(renderItem)}
        </List>
      </Box>

      {/* Theme Control & Version */}
      <Box sx={{ px: sidebarOpen ? 2 : 1, py: 1.5, borderTop: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
        {sidebarOpen ? (
          <Button
            variant="outlined"
            size="small"
            onClick={() => dispatch(toggleTheme())}
            startIcon={themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme mode`}
            fullWidth
            sx={{ borderRadius: '10px', fontSize: '0.8125rem', py: 0.75 }}
          >
            {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        ) : (
          <Tooltip title={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme mode`} placement="right">
            <IconButton size="small" onClick={() => dispatch(toggleTheme())}>
              {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        {sidebarOpen && (
          <Typography variant="caption" sx={{ opacity: 0.4, textAlign: 'center' }}>
            v2.0.0 · Safe Quest Authoring
          </Typography>
        )}
      </Box>
    </Drawer>
  );
}
