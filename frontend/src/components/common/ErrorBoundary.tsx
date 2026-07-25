import React from 'react';
import { Box, Typography, Button } from '@mui/material';
import { ErrorOutlined as ErrorOutlineIcon, Refresh as RefreshIcon } from '@mui/icons-material';

interface Props {
  children: React.ReactNode;
}
interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100%',
            gap: 2,
            p: 4,
          }}
        >
          <ErrorOutlineIcon sx={{ fontSize: 64, color: 'error.main', opacity: 0.7 }} />
          <Typography variant="h5" sx={{ fontWeight: 600 }}>
            Something went wrong
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', maxWidth: 400 }}>
            {this.state.error?.message ?? 'An unexpected error occurred in this panel.'}
          </Typography>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </Button>
        </Box>
      );
    }
    return this.props.children;
  }
}
