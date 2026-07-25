import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, Paper, Alert, CircularProgress, Divider } from '@mui/material';
import GoogleIcon from '@mui/icons-material/Google';
import { useRegisterMutation } from '@/store/api';
import { useAppDispatch } from '@/store';
import { setTokens } from '@/store/authSlice';

export function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [register, { isLoading, error }] = useRegisterMutation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password || !displayName) return;
    try {
      const tokens = await register({ email, password, display_name: displayName }).unwrap();
      dispatch(setTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token }));
      const from = (location.state as any)?.from;
      navigate(from ? from.pathname + (from.search || "") + (from.hash || "") : "/family/scenarios", { replace: true });
    } catch (err) {
      console.error('Registration failed', err);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google';
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', bgcolor: 'background.default' }}>
      <Paper elevation={3} sx={{ p: 4, width: '100%', maxWidth: 400, borderRadius: 3 }}>
        <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 700, textAlign: 'center' }}>
          Create Account
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
          Join the conversation today
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {(error as any)?.data?.detail || 'Registration failed'}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <TextField
            fullWidth label="Display Name" variant="outlined" margin="normal"
            value={displayName} onChange={(e) => setDisplayName(e.target.value)}
            disabled={isLoading} autoFocus
          />
          <TextField
            fullWidth label="Email" variant="outlined" margin="normal"
            value={email} onChange={(e) => setEmail(e.target.value)}
            disabled={isLoading} type="email"
          />
          <TextField
            fullWidth label="Password" variant="outlined" margin="normal"
            type="password"
            value={password} onChange={(e) => setPassword(e.target.value)}
            disabled={isLoading}
          />
          
          <Button
            type="submit" fullWidth variant="contained" size="large"
            disabled={isLoading || !email || !password || !displayName}
            sx={{ mt: 3, mb: 2, height: 48 }}
          >
            {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign Up'}
          </Button>
        </form>

        <Box sx={{ display: 'flex', alignItems: 'center', my: 2 }}>
          <Divider sx={{ flex: 1 }} />
          <Typography variant="body2" color="text.secondary" sx={{ px: 2 }}>OR</Typography>
          <Divider sx={{ flex: 1 }} />
        </Box>

        <Button
          fullWidth variant="outlined" size="large"
          startIcon={<GoogleIcon />}
          onClick={handleGoogleLogin}
          sx={{ height: 48, mb: 2 }}
        >
          Sign up with Google
        </Button>

        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Typography variant="body2" color="text.secondary">
            Already have an account?{' '}
            <Button color="primary" sx={{ p: 0, minWidth: 'auto', textTransform: 'none' }} onClick={() => navigate('/login')}>
              Sign in
            </Button>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
