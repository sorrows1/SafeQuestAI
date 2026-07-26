import { useState } from 'react';
import {
  Box,
  Button,
  ButtonGroup,
  IconButton,
  Paper,
  Stack,
  ThemeProvider,
  Tooltip,
  Typography,
} from '@mui/material';
import SmartphoneIcon from '@mui/icons-material/Smartphone';
import TabletIcon from '@mui/icons-material/Tablet';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import EyeIcon from '@mui/icons-material/Visibility';
import { SkinRouter } from '@/components/scenario-render/SkinRouter';
import { darkTheme, lightTheme } from '@/theme';
import type { FamilyScene, RenderSkin, SceneDefinition } from '@/types';

export type ViewportMode = 'mobile' | 'tablet' | 'desktop';
export type ThemePreviewMode = 'light' | 'dark';

interface AdminSkinPreviewPanelProps {
  renderSkin: RenderSkin;
  scene: FamilyScene | SceneDefinition;
  selectedElementKey?: string | null;
  selectedElementKeys?: string[];
  onSelectElement?: (elementKey: string) => void;
  readOnly?: boolean;
}

export function AdminSkinPreviewPanel({
  renderSkin,
  scene,
  selectedElementKey = null,
  selectedElementKeys = [],
  onSelectElement,
  readOnly = false,
}: AdminSkinPreviewPanelProps) {
  const [viewport, setViewport] = useState<ViewportMode>('desktop');
  const [previewTheme, setPreviewTheme] = useState<ThemePreviewMode>('dark');

  const getViewportWidth = () => {
    switch (viewport) {
      case 'mobile':
        return 375;
      case 'tablet':
        return 768;
      case 'desktop':
      default:
        return '100%';
    }
  };

  const effectiveSelectionKeys = selectedElementKeys.length > 0
    ? selectedElementKeys
    : selectedElementKey
      ? [selectedElementKey]
      : [];

  const handleSelectInternal = (key: string) => {
    if (onSelectElement) {
      onSelectElement(key);
    }
  };

  const activeTheme = previewTheme === 'dark' ? darkTheme : lightTheme;

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {/* Top Toolbar: Viewport & Theme Toggles */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1.5 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <EyeIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Live Production Skin Preview ({renderSkin})
          </Typography>
        </Stack>

        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
          {/* Viewport Selector */}
          <ButtonGroup size="small" variant="outlined" aria-label="Viewport size selector">
            <Tooltip title="Mobile Viewport (375px)">
              <Button
                variant={viewport === 'mobile' ? 'contained' : 'outlined'}
                onClick={() => setViewport('mobile')}
              >
                <SmartphoneIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Tablet Viewport (768px)">
              <Button
                variant={viewport === 'tablet' ? 'contained' : 'outlined'}
                onClick={() => setViewport('tablet')}
              >
                <TabletIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Desktop Viewport (Full)">
              <Button
                variant={viewport === 'desktop' ? 'contained' : 'outlined'}
                onClick={() => setViewport('desktop')}
              >
                <DesktopWindowsIcon fontSize="small" />
              </Button>
            </Tooltip>
          </ButtonGroup>

          {/* Theme Mode Toggle */}
          <ButtonGroup size="small" variant="outlined">
            <Tooltip title="Light Mode Preview">
              <Button
                variant={previewTheme === 'light' ? 'contained' : 'outlined'}
                onClick={() => setPreviewTheme('light')}
              >
                <LightModeIcon fontSize="small" />
              </Button>
            </Tooltip>
            <Tooltip title="Dark Mode Preview">
              <Button
                variant={previewTheme === 'dark' ? 'contained' : 'outlined'}
                onClick={() => setPreviewTheme('dark')}
              >
                <DarkModeIcon fontSize="small" />
              </Button>
            </Tooltip>
          </ButtonGroup>
        </Stack>
      </Box>

      {/* Preview Container Frame */}
      <Box
        sx={{
          bgcolor: previewTheme === 'dark' ? '#0f172a' : '#f8fafc',
          color: previewTheme === 'dark' ? '#f8fafc' : '#0f172a',
          p: { xs: 1.5, sm: 2.5 },
          borderRadius: 2.5,
          border: '1px border-dashed',
          borderColor: 'divider',
          mx: 'auto',
          width: getViewportWidth(),
          maxWidth: '100%',
          minHeight: 380,
          maxHeight: 640,
          overflowY: 'auto',
          transition: 'width 0.25s ease-in-out',
        }}
      >
        <ThemeProvider theme={activeTheme}>
          <SkinRouter
            renderSkin={renderSkin}
            scene={{ messages: [], ...scene }}
            selection={{ selectedElementKeys: effectiveSelectionKeys }}
            onSelect={handleSelectInternal}
            readOnly={readOnly}
            testId="admin-skin-preview-router"
          />
        </ThemeProvider>
      </Box>
    </Paper>
  );
}
