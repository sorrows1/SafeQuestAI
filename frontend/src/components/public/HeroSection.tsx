import { Box, Button, Chip, Container, Paper, Stack, Typography, useTheme, alpha } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { Link as RouterLink } from 'react-router-dom';

export function HeroSection() {
  const theme = useTheme();

  return (
    <Box sx={{ pt: { xs: 6, md: 10 }, pb: { xs: 8, md: 12 }, position: 'relative', overflow: 'hidden' }}>
      {/* Background glow effects */}
      <Box
        sx={{
          position: 'absolute',
          top: '-10%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '80%',
          height: 400,
          background: theme.palette.mode === 'dark' ? 'radial-gradient(ellipse at center, rgba(96, 165, 250, 0.12) 0%, rgba(139, 92, 246, 0.05) 50%, transparent 70%)' : 'radial-gradient(ellipse at center, rgba(37, 99, 235, 0.08) 0%, rgba(16, 185, 129, 0.04) 50%, transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      <Container maxWidth="lg">
        <Stack spacing={4} sx={{ alignItems: 'center', textAlign: 'center' }}>
          {/* Badge */}
          <Chip
            icon={<ShieldOutlinedIcon color="primary" sx={{ fontSize: 18 }} />}
            label="Calm · Non-Judgmental · Evidence-Based Digital Safety"
            sx={{
              py: 2,
              px: 1,
              fontWeight: 600,
              fontSize: '0.8125rem',
              backgroundColor: theme.palette.mode === 'dark' ? alpha('#60a5fa', 0.1) : alpha('#2563eb', 0.06),
              borderColor: theme.palette.mode === 'dark' ? alpha('#60a5fa', 0.25) : alpha('#2563eb', 0.2),
              borderWidth: 1,
              borderStyle: 'solid',
            }}
          />

          {/* Headline */}
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: '2.5rem', sm: '3.5rem', md: '4.25rem' },
              fontWeight: 800,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              maxWidth: 900,
            }}
          >
            Where Families Explore Digital Safety{' '}
            <Box
              component="span"
              sx={{
                background: theme.palette.mode === 'dark' ? 'linear-gradient(135deg, #60a5fa 0%, #34d399 100%)' : 'linear-gradient(135deg, #2563eb 0%, #059669 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              Together
            </Box>
          </Typography>

          {/* Subtitle */}
          <Typography
            variant="h5"
            color="text.secondary"
            sx={{ maxWidth: 720, mx: 'auto', fontSize: { xs: '1.05rem', md: '1.25rem' }, lineHeight: 1.6, fontWeight: 400 }}
          >
            Safe Quest helps children and caregivers navigate online pressure, privacy boundaries, and cyberbullying through interactive scenarios — open space for dialogue, never a score or test.
          </Typography>

          {/* CTAs */}
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Button
              component={RouterLink}
              to="/register"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 700, borderRadius: '12px' }}
            >
              Explore Scenarios Free
            </Button>
            <Button
              component={RouterLink}
              to="/login"
              variant="outlined"
              size="large"
              sx={{ py: 1.5, px: 4, fontSize: '1rem', fontWeight: 600, borderRadius: '12px' }}
            >
              Sign In to Account
            </Button>
          </Stack>

          {/* Interactive Preview Card */}
          <Box sx={{ width: '100%', maxWidth: 840, pt: 4 }}>
            <Paper
              elevation={0}
              variant="outlined"
              sx={{
                p: { xs: 2.5, sm: 4 },
                borderRadius: 4,
                textAlign: 'left',
                bgcolor: theme.palette.mode === 'dark' ? alpha('#151d2a', 0.9) : '#ffffff',
                backdropFilter: 'blur(16px)',
                boxShadow: theme.palette.mode === 'dark' ? '0 20px 40px rgba(0, 0, 0, 0.4)' : '0 20px 40px rgba(0, 0, 0, 0.06)',
                border: `1px solid ${theme.palette.divider}`,
              }}
            >
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', pb: 2, mb: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: 'success.main' }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Scenario Preview: Gaming Chat Boundary Pressure
                  </Typography>
                </Stack>
                <Chip icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />} label="Privacy Protected" size="small" variant="outlined" />
              </Stack>

              <Stack spacing={2}>
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)', maxWidth: '85%' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Player in Game Chat
                  </Typography>
                  <Typography variant="body2">
                    "Hey, you played great in that last match! Can you send me your private Discord tag so I can add you to our secret VIP squad?"
                  </Typography>
                </Box>

                <Box sx={{ p: 2, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? alpha('#60a5fa', 0.12) : alpha('#2563eb', 0.08), maxWidth: '85%', ml: 'auto' }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Child Reflection Choice
                  </Typography>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    "Thanks! But I only chat in public game channels with people I don't know IRL."
                  </Typography>
                </Box>

                <Box sx={{ p: 2, borderRadius: 3, border: `1px dashed ${theme.palette.primary.main}`, bgcolor: theme.palette.mode === 'dark' ? alpha('#34d399', 0.08) : alpha('#059669', 0.05) }}>
                  <Stack direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <ForumOutlinedIcon color="secondary" sx={{ mt: 0.2 }} />
                    <Box>
                      <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 700 }}>
                        Family Discussion Pause
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        How did setting that boundary feel? Notice how staying in public game channels keeps gaming fun while protecting your personal information.
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
