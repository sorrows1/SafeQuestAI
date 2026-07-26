import { Box, Card, CardContent, Container, Stack, Typography, useTheme, alpha } from '@mui/material';
import AccessibilityNewOutlinedIcon from '@mui/icons-material/AccessibilityNewOutlined';
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined';

const accessibilityFeatures = [
  'WCAG AA contrast ratios in both Dark and Light theme modes.',
  'Visible text-labeled theme switcher available on all major family and discovery pages.',
  'Complete keyboard navigation and clear focus indicators across cards, buttons, and dialogs.',
  'Live screen reader announcements (aria-live="polite") for scenario search and filtering.',
  'Respects user preferences for forced high contrast and reduced motion.',
  'Multi-modal indicators: scenario difficulty and categories use text labels, not color alone.',
];

export function AccessibilityStatement() {
  const theme = useTheme();

  return (
    <Box id="accessibility" sx={{ py: { xs: 8, md: 10 }, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)' }}>
      <Container maxWidth="lg">
        <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, borderColor: alpha('#60a5fa', 0.25) }}>
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
                  <AccessibilityNewOutlinedIcon sx={{ fontSize: 28 }} />
                </Box>
                <Box>
                  <Typography variant="h4" component="h2" sx={{ fontWeight: 700 }}>
                    Accessibility Commitment
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Designed for inclusive, barrier-free family engagement
                  </Typography>
                </Box>
              </Stack>

              <Typography variant="body1" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                Safe Quest is committed to providing an accessible platform for all learners and caregivers regardless of ability. Our interface is designed to meet Web Content Accessibility Guidelines (WCAG 2.1 AA) standards.
              </Typography>

              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                {accessibilityFeatures.map((item, index) => (
                  <Stack key={index} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
                    <CheckOutlinedIcon color="primary" sx={{ fontSize: 20, mt: 0.2 }} />
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item}
                    </Typography>
                  </Stack>
                ))}
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  );
}
