import { Box, Card, CardContent, Container, Stack, Typography, useTheme, alpha } from '@mui/material';
import SentimentSatisfiedAltIcon from '@mui/icons-material/SentimentSatisfiedAlt';
import FamilyRestroomIcon from '@mui/icons-material/FamilyRestroom';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';

const playerPoints = [
  'Interactive choice points in familiar app UI formats (Chat, Email, Social Feed).',
  'Empowering experience: test decisions without real-life social consequences.',
  'Supportive AI companion that listens and guides without judgment.',
  'Zero tests, zero grades — focus on learning what feels safe and right.',
];

const caregiverPoints = [
  'Reviewed offline simulations: kids never interact with live online strangers.',
  'Non-judgmental parent guides generated automatically to support calm conversation.',
  'Encourages help-seeking behavior before real-world harm occurs.',
  'Complete privacy protections: no child PII is exposed or saved for scoring.',
];

export function ValuePropsSection() {
  const theme = useTheme();

  return (
    <Box id="for-families" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Stack spacing={2} sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.1em' }}>
            DESIGNED FOR EVERYONE IN THE FAMILY
          </Typography>
          <Typography variant="h2" component="h2" sx={{ fontWeight: 800 }}>
            Empowering youth while giving parents peace of mind
          </Typography>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 4 }}>
          {/* Player Card */}
          <Card
            variant="outlined"
            sx={{
              height: '100%',
              p: { xs: 2, sm: 3 },
              borderRadius: 4,
              borderColor: alpha('#60a5fa', 0.3),
              bgcolor: theme.palette.mode === 'dark' ? alpha('#60a5fa', 0.03) : alpha('#2563eb', 0.02),
            }}
          >
            <CardContent>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      bgcolor: alpha('#60a5fa', 0.15),
                      color: 'primary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SentimentSatisfiedAltIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="h3" sx={{ fontWeight: 700 }}>
                      For Kids & Youth
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      A safe space to build confidence online
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={2}>
                  {playerPoints.map((text, i) => (
                    <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <CheckCircleOutlinedIcon color="primary" sx={{ fontSize: 20, mt: 0.2 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                        {text}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>

          {/* Caregiver Card */}
          <Card
            variant="outlined"
            sx={{
              height: '100%',
              p: { xs: 2, sm: 3 },
              borderRadius: 4,
              borderColor: alpha('#34d399', 0.3),
              bgcolor: theme.palette.mode === 'dark' ? alpha('#34d399', 0.03) : alpha('#059669', 0.02),
            }}
          >
            <CardContent>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: '12px',
                      bgcolor: alpha('#34d399', 0.15),
                      color: 'secondary.main',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <FamilyRestroomIcon sx={{ fontSize: 28 }} />
                  </Box>
                  <Box>
                    <Typography variant="h4" component="h3" sx={{ fontWeight: 700 }}>
                      For Parents & Caregivers
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Tools to start meaningful conversations
                    </Typography>
                  </Box>
                </Stack>

                <Stack spacing={2}>
                  {caregiverPoints.map((text, i) => (
                    <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                      <CheckCircleOutlinedIcon color="secondary" sx={{ fontSize: 20, mt: 0.2 }} />
                      <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.6 }}>
                        {text}
                      </Typography>
                    </Stack>
                  ))}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      </Container>
    </Box>
  );
}
