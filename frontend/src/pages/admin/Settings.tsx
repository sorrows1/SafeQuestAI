import {
  Box,
  Paper,
  Typography,
  Grid,
  Switch,
  FormControlLabel,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Divider,
  Chip,
  Button,
} from '@mui/material';
import { useAppDispatch, useAppSelector } from '@/store';
import { toggleTheme } from '@/store/uiSlice';
import { AppShell } from '@/components/common/AppShell';

export function Settings() {
  const dispatch = useAppDispatch();
  const themeMode = useAppSelector((s) => s.ui.themeMode);

  return (
    <AppShell>
      <Box sx={{ p: 3, maxWidth: 700, mx: 'auto' }}>
        <Typography variant="h2" gutterBottom>
          Settings
        </Typography>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            Appearance
          </Typography>
          <FormControlLabel control={<Switch checked={themeMode === 'dark'} onChange={() => dispatch(toggleTheme())} />} label="Dark Mode" />
        </Paper>

        <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            API Configuration
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Backend URL
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                http://localhost:8000
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                API Proxy
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                /api
              </Typography>
            </Box>
          </Box>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>
            About
          </Typography>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Platform
              </Typography>
              <Typography variant="body2">Safe Quest v2.0.0</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                Stack
              </Typography>
              <Typography variant="body2">React + FastAPI + PostgreSQL</Typography>
            </Box>
            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="body2" color="text.secondary">
                LLM
              </Typography>
              <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                openai/gpt-4.1-mini (GitHub Models)
              </Typography>
            </Box>
          </Box>
        </Paper>
      </Box>
    </AppShell>
  );
}
