import { Box, Button, Chip, Container, Paper, Stack, Typography, useTheme, alpha } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { SkinRouter } from '@/components/scenario-render/SkinRouter';
import { authenticCoreFixtures } from '@/components/scenario-render/fixtures/authenticCoreFixtures';

export function HeroSection() {
  const theme = useTheme();
  const heroFixture = authenticCoreFixtures.chat;

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
            Safe Quest helps children and caregivers navigate online pressure, privacy boundaries, and cyberbullying through interactive scenarios.
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
              Explore Scenarios
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
                p: { xs: 2, sm: 3 },
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
                    Live Skin Preview: Gaming Chat Boundary Pressure
                  </Typography>
                </Stack>
                <Chip icon={<LockOutlinedIcon sx={{ fontSize: 14 }} />} label="Interactive Skin" size="small" variant="outlined" />
              </Stack>

              <SkinRouter
                renderSkin="chat"
                scene={heroFixture.scene}
                selection={{ selectedElementKeys: [heroFixture.safeElementKey] }}
                onSelect={() => {}}
                readOnly={true}
                testId="hero-chat-preview"
              />
            </Paper>
          </Box>
        </Stack>
      </Container>
    </Box>
  );
}
