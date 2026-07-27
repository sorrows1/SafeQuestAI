import { AppBar, Toolbar, Box, IconButton, Button, Typography, Tooltip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import RefreshIcon from '@mui/icons-material/Refresh';
import MenuIcon from '@mui/icons-material/Menu';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleSidebar, toggleTheme } from '@/store/uiSlice';

interface Props {
  onReload?: () => void;
}

export function TopBar({ onReload }: Props) {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);
  const sidebarOpen = useAppSelector((s) => s.ui.sidebarOpen);

  const title = 'Safe Quest';

  return (
    <AppBar position="static" elevation={0} sx={{ zIndex: 1 }}>
      <Toolbar variant="dense" sx={{ minHeight: 56, px: 2 }}>
        <Tooltip title={sidebarOpen ? 'Collapse Sidebar' : 'Expand Sidebar'}>
          <IconButton size="small" edge="start" color="inherit" onClick={() => dispatch(toggleSidebar())} sx={{ mr: 1.5 }}>
            {sidebarOpen ? <MenuOpenIcon fontSize="small" /> : <MenuIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          {title}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {onReload && (
            <Tooltip title="Reload from disk">
              <IconButton size="small" onClick={onReload}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Button
            variant="outlined"
            size="small"
            onClick={() => dispatch(toggleTheme())}
            startIcon={themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            aria-label={`Switch to ${themeMode === 'dark' ? 'light' : 'dark'} theme mode`}
            sx={{ borderRadius: '20px', px: 1.5, py: 0.5, fontSize: '0.8125rem', fontWeight: 600 }}
          >
            {themeMode === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
