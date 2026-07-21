import { createTheme, alpha } from '@mui/material/styles';

// ── Palette constants ──────────────────────────────────────────────────────
const DARK_BG_DEFAULT   = '#0d1117';
const DARK_BG_PAPER     = '#161b22';
const DARK_BG_ELEVATED  = '#21262d';
const ACCENT_BLUE       = '#58a6ff';
const ACCENT_BLUE_DARK  = '#1f6feb';
const ACCENT_GREEN      = '#3fb950';
const ACCENT_AMBER      = '#d29922';
const ACCENT_RED        = '#f85149';
const TEXT_PRIMARY      = '#e6edf3';
const TEXT_SECONDARY    = '#8b949e';
const DIVIDER           = '#30363d';

// ── Dark Theme ─────────────────────────────────────────────────────────────
export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary:   { main: ACCENT_BLUE,  dark: ACCENT_BLUE_DARK, contrastText: '#fff' },
    secondary: { main: ACCENT_GREEN, contrastText: '#fff' },
    error:     { main: ACCENT_RED },
    warning:   { main: ACCENT_AMBER },
    success:   { main: ACCENT_GREEN },
    background: {
      default: DARK_BG_DEFAULT,
      paper:   DARK_BG_PAPER,
    },
    text: {
      primary:   TEXT_PRIMARY,
      secondary: TEXT_SECONDARY,
    },
    divider: DIVIDER,
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
    h1: { fontWeight: 700, fontSize: '2rem',   letterSpacing: '-0.02em' },
    h2: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em' },
    h3: { fontWeight: 600, fontSize: '1.25rem' },
    h4: { fontWeight: 600, fontSize: '1.1rem' },
    h5: { fontWeight: 600, fontSize: '1rem' },
    h6: { fontWeight: 600, fontSize: '0.875rem' },
    body1: { fontSize: '0.875rem', lineHeight: 1.6 },
    body2: { fontSize: '0.8125rem', lineHeight: 1.5 },
    caption: { fontSize: '0.75rem', color: TEXT_SECONDARY },
  },
  shape: { borderRadius: 8 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: DARK_BG_DEFAULT,
          scrollbarWidth: 'thin',
          scrollbarColor: `${alpha(TEXT_PRIMARY, 0.15)} transparent`,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
          borderColor: DIVIDER,
        },
        outlined: {
          border: `1px solid ${DIVIDER}`,
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 500,
          fontSize: '0.8125rem',
        },
        contained: {
          boxShadow: 'none',
          '&:hover': { boxShadow: 'none' },
        },
      },
    },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '1px 8px',
          width: 'calc(100% - 16px)',
          '&.Mui-selected': {
            backgroundColor: alpha(ACCENT_BLUE, 0.15),
            '&:hover': { backgroundColor: alpha(ACCENT_BLUE, 0.2) },
            '& .MuiListItemIcon-root': { color: ACCENT_BLUE },
            '& .MuiListItemText-primary': { color: ACCENT_BLUE, fontWeight: 600 },
          },
          '&:hover': {
            backgroundColor: alpha(TEXT_PRIMARY, 0.05),
          },
        },
      },
    },
    MuiListItemIcon: {
      styleOverrides: {
        root: { minWidth: 36, color: TEXT_SECONDARY },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 500 },
      },
    },
    MuiTooltip: {
      styleOverrides: {
        tooltip: {
          fontSize: '0.75rem',
          backgroundColor: DARK_BG_ELEVATED,
          border: `1px solid ${DIVIDER}`,
        },
      },
    },
    MuiDivider: {
      styleOverrides: {
        root: { borderColor: DIVIDER },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small', variant: 'outlined' },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '& .MuiOutlinedInput-notchedOutline': { borderColor: DIVIDER },
          '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(ACCENT_BLUE, 0.5) },
        },
      },
    },
    MuiTab: {
      styleOverrides: {
        root: { textTransform: 'none', fontWeight: 500, fontSize: '0.8125rem' },
      },
    },
    MuiAlert: {
      styleOverrides: {
        root: { fontSize: '0.8125rem' },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          backgroundColor: DARK_BG_PAPER,
          borderRight: `1px solid ${DIVIDER}`,
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: DARK_BG_PAPER,
          borderBottom: `1px solid ${DIVIDER}`,
          boxShadow: 'none',
        },
      },
    },
  },
});

// ── Light Theme ────────────────────────────────────────────────────────────
export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary:   { main: '#0969da', contrastText: '#fff' },
    secondary: { main: '#1a7f37', contrastText: '#fff' },
    error:     { main: '#d1242f' },
    warning:   { main: '#9a6700' },
    success:   { main: '#1a7f37' },
    background: { default: '#f6f8fa', paper: '#ffffff' },
    text: { primary: '#1f2328', secondary: '#656d76' },
    divider: '#d0d7de',
  },
  typography: {
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  shape: { borderRadius: 8 },
  components: {
    MuiButton: { styleOverrides: { root: { textTransform: 'none', fontWeight: 500 } } },
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 6,
          margin: '1px 8px',
          width: 'calc(100% - 16px)',
          '&.Mui-selected': {
            backgroundColor: alpha('#0969da', 0.1),
            '& .MuiListItemText-primary': { color: '#0969da', fontWeight: 600 },
          },
        },
      },
    },
    MuiTextField: { defaultProps: { size: 'small' } },
  },
});
