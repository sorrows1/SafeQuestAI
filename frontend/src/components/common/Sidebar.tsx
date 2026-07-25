import { useLocation, useNavigate } from 'react-router-dom';
import {
  Box, Drawer, List, ListItemButton, ListItemIcon, ListItemText,
  Typography, Divider, Tooltip, alpha,
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

const SIDEBAR_WIDTH = 240;

const navItems = [
  { label: 'Dashboard',       path: '/admin',            icon: <DashboardIcon fontSize="small" /> },
  { label: 'Scenarios',       path: '/admin/scenarios',   icon: <MovieIcon fontSize="small" /> },
  { label: 'Personas',        path: '/admin/personas',    icon: <PersonIcon fontSize="small" /> },
  { label: 'Stages',          path: '/admin/stages',      icon: <AccountTreeIcon fontSize="small" /> },
  { label: 'Objectives',      path: '/admin/objectives',  icon: <TrackChangesIcon fontSize="small" /> },
  { label: 'Constraints',     path: '/admin/constraints', icon: <SecurityIcon fontSize="small" /> },
  { label: 'Prompt Templates',path: '/admin/prompts',     icon: <ArticleIcon fontSize="small" /> },
] as const;

const bottomItems = [
  { label: "Family Scenarios", path: "/family/scenarios", icon: <ChatIcon fontSize="small" /> },
  { label: 'Users',       path: '/admin/users',      icon: <GroupIcon fontSize="small" /> },
  { label: 'Simulation Workbench', path: '/admin/simulator', icon: <PlayCircleIcon fontSize="small" /> },
  { label: 'Review Queue', path: '/admin/review-queue', icon: <FactCheckIcon fontSize="small" /> },
  { label: 'Validation',  path: '/admin/validation', icon: <FactCheckIcon fontSize="small" /> },
  { label: 'Settings',    path: '/admin/settings',   icon: <SettingsIcon fontSize="small" /> },
] as const;

export function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin' || location.pathname === '/admin/';
    return location.pathname.startsWith(path);
  };

  const renderItem = (item: { label: string; path: string; icon: React.ReactNode }) => (
    <ListItemButton
      key={item.path}
      selected={isActive(item.path)}
      onClick={() => navigate(item.path)}
    >
      <ListItemIcon>{item.icon}</ListItemIcon>
      <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontSize: '0.8125rem' } } }} />
    </ListItemButton>
  );

  return (
    <Drawer
      variant="permanent"
      sx={{
        width: SIDEBAR_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': { width: SIDEBAR_WIDTH, boxSizing: 'border-box' },
      }}
    >
      {/* Logo */}
      <Box sx={{
        px: 2, py: 1.5, display: 'flex', alignItems: 'center', gap: 1,
        borderBottom: '1px solid', borderColor: 'divider', minHeight: 56,
      }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: 1,
          background: 'linear-gradient(135deg, #58a6ff 0%, #1f6feb 100%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <ShieldIcon sx={{ fontSize: 16, color: '#fff' }} />
        </Box>
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>Safe Quest</Typography>
          <Typography variant="caption" sx={{ opacity: 0.5, fontSize: '0.65rem' }}>
            Authoring Platform
          </Typography>
        </Box>
      </Box>

      {/* Main nav */}
      <Box sx={{ flex: 1, overflow: 'auto', py: 1 }}>
        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', opacity: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Content
        </Typography>
        <List dense disablePadding>
          {navItems.map(renderItem)}
        </List>

        <Divider sx={{ my: 1 }} />

        <Typography variant="caption" sx={{ px: 2, py: 0.5, display: 'block', opacity: 0.4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Tools
        </Typography>
        <List dense disablePadding>
          {bottomItems.map(renderItem)}
        </List>
      </Box>

      {/* Version */}
      <Box sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}>
        <Typography variant="caption" sx={{ opacity: 0.3 }}>v2.0.0</Typography>
      </Box>
    </Drawer>
  );
}
