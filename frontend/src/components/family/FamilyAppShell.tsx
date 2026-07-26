import { Box } from '@mui/material';
import { FamilyTopBar } from './FamilyTopBar';

interface FamilyAppShellProps {
  children: React.ReactNode;
}

export function FamilyAppShell({ children }: FamilyAppShellProps) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', bgcolor: 'background.default' }}>
      <FamilyTopBar />
      <Box component="main" sx={{ flexGrow: 1 }}>
        {children}
      </Box>
    </Box>
  );
}
