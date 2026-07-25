import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress, Divider } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useLoginMutation } from '@/store/api';
import { useAppDispatch } from '@/store';
import { setTokens } from '@/store/authSlice';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [login, { isLoading, error }] = useLoginMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    try {
      const tokens = await login({ email, password }).unwrap();
      dispatch(setTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }));
      const from = (location.state as any)?.from;
      navigate(from ? from.pathname + (from.search || '') + (from.hash || '') : '/family/scenarios', { replace: true });
    } catch (err) {
      console.error('Login failed', err);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, textAlign: 'center' }}>
          Welcome Back
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Sign in to continue your conversations
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {(error as any)?.data?.detail || 'Invalid email or password'}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth
            label="Email"
            variant="outlined"
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading}
            autoFocus
            type="email"
          />
          <TextField
            fullWidth
            label="Password"
            variant="outlined"
            margin="normal"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={isLoading || !email || !password}
            sx={{ mt: 3, mb: 2, height: 48 }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign In'}
          </Button>
        </form>

        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>
            OR
          </Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        <Button fullWidth variant="outlined" size="large" startIcon={<GoogleIcon />} onClick={handleGoogleLogin} sx={{ height: 48, mb: 2 }}>
          Sign in with Google
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Don't have an account?{' '}
            <Button color="primary" sx={{ p: 0, minWidth: 'auto', textTransform: 'none' }} onClick={() => navigate('/register')}>
              Create one
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
