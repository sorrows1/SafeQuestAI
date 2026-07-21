import { Box, IconButton, Avatar, Menu, MenuItem, Tooltip, Dialog, DialogTitle, DialogContent, Typography, DialogActions, Button } from '@mui/material';
import { Outlet, useNavigate } from 'react-router-dom';
import { ConversationList } from './ConversationList';
import { useAppSelector, useAppDispatch } from '@/store';
import { logout } from '@/store/authSlice';
import SettingsIcon from '@mui/icons-material/Settings';
import LogoutIcon from '@mui/icons-material/Logout';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useState } from 'react';

export function ChatLayout() {
  const { user } = useAppSelector(s => s.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => setAnchorEl(event.currentTarget);
  const handleClose = () => setAnchorEl(null);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex', height: '100vh', overflow: 'hidden', bgcolor: 'background.default' }}>
      {/* Tiny sidebar for profile/actions */}
      <Box sx={{ width: 64, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
        <Tooltip title="Profile" placement="right">
          <IconButton onClick={handleMenu}>
            <Avatar src={user?.avatar_url || undefined} sx={{ width: 40, height: 40 }}>
              {user?.display_name?.[0]?.toUpperCase()}
            </Avatar>
          </IconButton>
        </Tooltip>
        
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleClose} transformOrigin={{ horizontal: 'left', vertical: 'top' }} anchorOrigin={{ horizontal: 'right', vertical: 'top' }}>
          <MenuItem disabled>{user?.display_name}</MenuItem>
          <MenuItem onClick={handleLogout}><LogoutIcon fontSize="small" sx={{ mr: 1 }} /> Logout</MenuItem>
        </Menu>

        <Box sx={{ flex: 1 }} />
        
        {user?.role === 'admin' && (
          <Tooltip title="Admin Dashboard" placement="right">
            <IconButton onClick={() => navigate('/admin')} sx={{ mb: 1 }} color="primary">
              <AdminPanelSettingsIcon />
            </IconButton>
          </Tooltip>
        )}
        
        <Tooltip title="Settings" placement="right">
          <IconButton onClick={() => setSettingsOpen(true)}>
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Conversations List */}
      <ConversationList />

      {/* Main Chat Area */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <Outlet />
      </Box>

      {/* Placeholder Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Settings</DialogTitle>
        <DialogContent dividers>
          <Typography color="text.secondary">
            Settings functionality has not been implemented yet.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
