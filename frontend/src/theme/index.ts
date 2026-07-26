import { createTheme, alpha } from '@mui/material/styles';

// ── Palette constants ──────────────────────────────────────────────────────
const DARK_BG_DEFAULT = '#0b0f19';
const DARK_BG_PAPER = '#151d2a';
const DARK_BG_ELEVATED = '#1e293b';
const ACCENT_BLUE = '#60a5fa';
const ACCENT_BLUE_DARK = '#2563eb';
const ACCENT_GREEN = '#34d399';
const ACCENT_AMBER = '#fbbf24';
const ACCENT_RED = '#f87171';
const TEXT_PRIMARY_DARK = '#f1f5f9';
const TEXT_SECONDARY_DARK = '#94a3b8';
const DIVIDER_DARK = 'rgba(255, 255, 255, 0.1)';

const LIGHT_BG_DEFAULT = '#f8fafc';
const LIGHT_BG_PAPER = '#ffffff';
const LIGHT_PRIMARY = '#2563eb';
const LIGHT_PRIMARY_DARK = '#1d4ed8';
const LIGHT_SECONDARY = '#059669';
const TEXT_PRIMARY_LIGHT = '#0f172a';
const TEXT_SECONDARY_LIGHT = '#475569';
const DIVIDER_LIGHT = '#e2e8f0';

// ── Common Typography ──────────────────────────────────────────────────────
const baseTypography = {
  fontFamily: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  h1: { fontWeight: 800, fontSize: '2.5rem', letterSpacing: '-0.03em', lineHeight: 1.2 },
  h2: { fontWeight: 700, fontSize: '1.875rem', letterSpacing: '-0.02em', lineHeight: 1.3 },
  h3: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em', lineHeight: 1.35 },
  h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
  h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.4 },
  h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.4 },
  body1: { fontSize: '0.9375rem', lineHeight: 1.6 },
  body2: { fontSize: '0.875rem', lineHeight: 1.5 },
  caption: { fontSize: '0.75rem', lineHeight: 1.4 },
};

// ── Dark Theme ─────────────────────────────────────────────────────────────
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: ACCENT_BLUE, dark: ACCENT_BLUE_DARK, contrastText: '#0f172a' },
    secondary: { main: ACCENT_GREEN, contrastText: '#0f172a' },
    error: { main: ACCENT_RED },
    warning: { main: ACCENT_AMBER },
    success: { main: ACCENT_GREEN },
    background: {
      default: DARK_BG_DEFAULT,
      paper: DARK_BG_PAPER,
    },
    text: {
      primary: TEXT_PRIMARY_DARK,
      secondary: TEXT_SECONDARY_DARK,
    },
    divider: DIVIDER_DARK,
  },
  typography: {
    ...baseTypography,
    caption: { ...baseTypography.caption, color: TEXT_SECONDARY_DARK },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: DARK_BG_DEFAULT,
          color: TEXT_PRIMARY_DARK,
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(TEXT_PRIMARY_DARK, 0.2)} transparent`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: DIVIDER_DARK,
          transition: 'all 0.2s ease-in-out',
        },
        outlined: {
          border: `1px solid ${DIVIDER_DARK}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderRadius: 16,
          borderColor: DIVIDER_DARK,
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out, border-color 0.2s ease-in-out',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 16px',
          fontSize: '0.875rem',
          transition: 'all 0.15s ease-in-out',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: `0 4px 12px ${alpha(ACCENT_BLUE, 0.3)}`,
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: alpha(ACCENT_BLUE, 0.4),
          '&:hover': {
            borderColor: ACCENT_BLUE,
            backgroundColor: alpha(ACCENT_BLUE, 0.08),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
          borderRadius: 8,
        },
        outlined: {
          borderColor: alpha(TEXT_PRIMARY_DARK, 0.2),
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          width: 'calc(100% - 16px)',
          '&.Mui-selected': {
            backgroundColor: alpha(ACCENT_BLUE, 0.15),
            '&:hover': { backgroundColor: alpha(ACCENT_BLUE, 0.22) },
            '& .MuiListItemIcon-root': { color: ACCENT_BLUE },
            '& .MuiListItemText-primary': { color: ACCENT_BLUE, fontWeight: 600 },
          },
          '&:hover': {
            backgroundColor: alpha(TEXT_PRIMARY_DARK, 0.06),
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 36, color: TEXT_SECONDARY_DARK },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          backgroundColor: DARK_BG_ELEVATED,
          border: `1px solid ${DIVIDER_DARK}`,
          borderRadius: 8,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: DIVIDER_DARK },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: DIVIDER_DARK },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(ACCENT_BLUE, 0.5) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: ACCENT_BLUE },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 600, fontSize: '0.875rem' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: '0.875rem', borderRadius: 12 },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: DARK_BG_PAPER,
          borderLeft: `1px solid ${DIVIDER_DARK}`,
          borderRight: `1px solid ${DIVIDER_DARK}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(DARK_BG_PAPER, 0.85),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${DIVIDER_DARK}`,
          boxShadow: 'none',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundColor: DARK_BG_PAPER,
          backgroundImage: 'none',
          border: `1px solid ${DIVIDER_DARK}`,
        },
      },
    },
  },
});

// ── Light Theme ────────────────────────────────────────────────────────────
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: LIGHT_PRIMARY, dark: LIGHT_PRIMARY_DARK, contrastText: '#ffffff' },
    secondary: { main: LIGHT_SECONDARY, contrastText: '#ffffff' },
    error: { main: '#dc2626' },
    warning: { main: '#d97706' },
    success: { main: '#059669' },
    background: { default: LIGHT_BG_DEFAULT, paper: LIGHT_BG_PAPER },
    text: { primary: TEXT_PRIMARY_LIGHT, secondary: TEXT_SECONDARY_LIGHT },
    divider: DIVIDER_LIGHT,
  },
  typography: {
    ...baseTypography,
    caption: { ...baseTypography.caption, color: TEXT_SECONDARY_LIGHT },
  },
  shape: { borderRadius: 12 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: LIGHT_BG_DEFAULT,
          color: TEXT_PRIMARY_LIGHT,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          borderColor: DIVIDER_LIGHT,
          transition: 'all 0.2s ease-in-out',
        },
        outlined: {
          border: `1px solid ${DIVIDER_LIGHT}`,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          borderColor: DIVIDER_LIGHT,
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05), 0 1px 2px 0 rgba(0, 0, 0, 0.03)',
          transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          '&:hover': {
            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.08), 0 4px 6px -2px rgba(0, 0, 0, 0.04)',
          },
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderRadius: 10,
          padding: '8px 16px',
          fontSize: '0.875rem',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': {
            boxShadow: `0 4px 12px ${alpha(LIGHT_PRIMARY, 0.25)}`,
            transform: 'translateY(-1px)',
          },
        },
        outlined: {
          borderColor: alpha(LIGHT_PRIMARY, 0.3),
          '&:hover': {
            borderColor: LIGHT_PRIMARY,
            backgroundColor: alpha(LIGHT_PRIMARY, 0.04),
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: '0.75rem',
          borderRadius: 8,
        },
        outlined: {
          borderColor: DIVIDER_LIGHT,
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          margin: '2px 8px',
          width: 'calc(100% - 16px)',
          '&.Mui-selected': {
            backgroundColor: alpha(LIGHT_PRIMARY, 0.1),
            '& .MuiListItemText-primary': { color: LIGHT_PRIMARY, fontWeight: 600 },
          },
          '&:hover': {
            backgroundColor: alpha(TEXT_PRIMARY_LIGHT, 0.04),
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 36, color: TEXT_SECONDARY_LIGHT },
      },
    },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: DIVIDER_LIGHT },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(LIGHT_PRIMARY, 0.5) },
          '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: LIGHT_PRIMARY },
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: alpha(LIGHT_BG_PAPER, 0.9),
          backdropFilter: 'blur(12px)',
          borderBottom: `1px solid ${DIVIDER_LIGHT}`,
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.03)',
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          borderRadius: 16,
          backgroundColor: LIGHT_BG_PAPER,
        },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: '0.875rem', borderRadius: 12 },
      },
    },
  },
});

