import { Box } from '@mui/material';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { ErrorBoundary } from './ErrorBoundary';

interface Props {
  children: React.ReactNode;
  onReload?: () => void;
}

export function AppShell({ children, onReload }: Props) {
  return (
    <Box sx={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <Sidebar />
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
        <TopBar onReload={onReload} />
        <Box sx={{ flex: 1, overflow: 'auto', bgcolor: 'background.default' }}>
          <ErrorBoundary>{children}</ErrorBoundary>
        </Box>
      </Box>
    </Box>
  );
}
