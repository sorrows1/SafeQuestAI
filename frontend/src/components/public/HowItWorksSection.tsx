import { Box, Card, CardContent, Container, Stack, Typography, useTheme, alpha } from '@mui/material';
import ExploreOutlinedIcon from '@mui/icons-material/ExploreOutlined';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';

const steps = [
  {
    icon: ExploreOutlinedIcon,
    step: 'Step 1',
    title: 'Pick a Reviewed Scenario',
    description:
      'Choose from curated online situations covering gaming boundaries, cyberbullying, scam messages, social media posting, and private image requests.',
    colorLight: '#1d4ed8',
    colorDark: '#60a5fa',
  },
  {
    icon: ChatBubbleOutlineOutlinedIcon,
    step: 'Step 2',
    title: 'Experience Realistic Chats',
    description:
      'Navigate realistic, non-visual interactive dialogue in realistic app skins (Chat, Email, Social Feed) without exposure to real online antagonists.',
    colorLight: '#047857',
    colorDark: '#34d399',
  },
  {
    icon: PsychologyOutlinedIcon,
    step: 'Step 3',
    title: 'Reflect & Grow Together',
    description:
      'Pause at checkpoints to share your thoughts. Generate parent-child conversation guides focused on empathy and normalized help-seeking.',
    colorLight: '#6d28d9',
    colorDark: '#a78bfa',
  },
];

export function HowItWorksSection() {
  const theme = useTheme();

  return (
    <Box id="how-it-works" sx={{ py: { xs: 8, md: 12 }, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)' }}>
      <Container maxWidth="lg">
        <Stack spacing={2} sx={{ textAlign: 'center', mb: 6 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.1em' }}>
            HOW SAFE QUEST WORKS
          </Typography>
          <Typography variant="h2" component="h2" sx={{ fontWeight: 800 }}>
            Building digital resilience, step by step
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 640, mx: 'auto' }}>
            Each experience follows one calm loop: inspect a fictional moment, explain your thinking, ask the companion, pause at a checkpoint, continue at your pace, and review together.
          </Typography>
        </Stack>

        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 3 }}>
          {steps.map((item, index) => {
            const Icon = item.icon;
            const accentColor = theme.palette.mode === 'dark' ? item.colorDark : item.colorLight;
            return (
              <Card
                key={index}
                variant="outlined"
                sx={{
                  height: '100%',
                  p: 1,
                  position: 'relative',
                  overflow: 'hidden',
                  borderColor: theme.palette.divider,
                  '&:hover': {
                    borderColor: accentColor,
                    transform: 'translateY(-4px)',
                  },
                }}
              >
                <CardContent>
                  <Stack spacing={2.5}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: '14px',
                        bgcolor: alpha(accentColor, 0.12),
                        color: accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon sx={{ fontSize: 28 }} />
                    </Box>
                    <Typography variant="caption" sx={{ fontWeight: 800, color: accentColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      {item.step}
                    </Typography>
                    <Typography variant="h4" component="h3" sx={{ fontWeight: 700 }}>
                      {item.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {item.description}
                    </Typography>
                  </Stack>
                </CardContent>
              </Card>
            );
          })}
        </Box>
      </Container>
    </Box>
  );
}
