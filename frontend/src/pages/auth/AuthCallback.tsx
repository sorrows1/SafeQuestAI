import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { useAppDispatch } from '@/store';
import { setTokens } from '@/store/authSlice';

export function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  useEffect(() => {
    const accessToken = searchParams.get('access_token');
    const refreshToken = searchParams.get('refresh_token');
    const role = searchParams.get('role');

    if (accessToken && refreshToken) {
      dispatch(setTokens({ accessToken, refreshToken }));
      if (role === 'admin') {
        navigate('/admin', { replace: true });
      } else {
        navigate('/family/scenarios', { replace: true });
      }
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, dispatch]);

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <CircularProgress sx={{ mb: 2 }} />
      <Typography>Authenticating...</Typography>
    </Box>
  );
}
