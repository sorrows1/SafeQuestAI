import { Box, Card, CardContent, Container, Stack, Typography, useTheme, alpha } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import HealingOutlinedIcon from '@mui/icons-material/HealingOutlined';

export function SafetyPrivacySection() {
  const theme = useTheme();

  return (
    <Box id="safety-privacy" sx={{ py: { xs: 8, md: 12 }, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)' }}>
      <Container maxWidth="lg">
        <Stack spacing={2} sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.1em' }}>
            SAFETY & PRIVACY FIRST
          </Typography>
          <Typography variant="h2" component="h2" sx={{ fontWeight: 800 }}>
            Built with strict safety and privacy boundaries
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 650, mx: 'auto' }}>
            Safe Quest is designed from the ground up to protect children's emotional wellbeing and personal data.
          </Typography>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
          <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    bgcolor: alpha('#60a5fa', 0.12),
                    color: 'primary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SecurityOutlinedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="h5" component="h3" sx={{ fontWeight: 700 }}>
                  100% Offline Reviewed
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  All scenario scripts are curated and reviewed before publication. Children never interact with live internet users or unpredictable bots.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    bgcolor: alpha('#34d399', 0.12),
                    color: 'secondary.main',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <HealingOutlinedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="h5" component="h3" sx={{ fontWeight: 700 }}>
                  Real-Disclosure Protection
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  If a child mentions a real-world safety concern, Safe Quest immediately provides supportive direct-help resources locally without judgment or grading.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          <Card variant="outlined" sx={{ height: '100%', borderRadius: 4 }}>
            <CardContent>
              <Stack spacing={2}>
                <Box
                  sx={{
                    width: 44,
                    height: 44,
                    borderRadius: '10px',
                    bgcolor: alpha('#a78bfa', 0.12),
                    color: '#a78bfa',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <LockOutlinedIcon sx={{ fontSize: 24 }} />
                </Box>
                <Typography variant="h5" component="h3" sx={{ fontWeight: 700 }}>
                  Zero PII Storage & No Scoring
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                  We scrub personal identifiable information automatically. There are no performance grades, mistakes lists, or permanent performance records.
                </Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
