import { AppBar, Toolbar, Box, IconButton, Typography, Tooltip, Chip } from '@mui/material';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleTheme } from '@/store/uiSlice';
import { useLocation } from 'react-router-dom';



interface Props {
  onReload?: () => void;
}

export function TopBar({ onReload }: Props) {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector(s => s.ui.themeMode);

  const title = 'Safe Quest';

  return (
    <AppBar position="static" elevation={0} sx={{ zIndex: 1 }}>
      <Toolbar variant="dense" sx={{ minHeight: 56, px: 2 }}>
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
          <Tooltip title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton size="small" onClick={() => dispatch(toggleTheme())}>
              {themeMode === 'dark' ? <LightModeIcon fontSize="small" /> : <DarkModeIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        </Box>
      </Toolbar>
    </AppBar>
  );
}
