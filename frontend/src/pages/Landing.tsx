import { Box, Button, Container, Paper, Stack, Typography } from '@mui/material';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { Link as RouterLink } from 'react-router-dom';

export function Landing() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', display: 'grid', alignItems: 'center', bgcolor: 'background.default', py: { xs: 5, md: 9 } }}>
      <Container maxWidth="md">
        <Paper elevation={0} variant="outlined" sx={{ p: { xs: 3, sm: 6 }, borderRadius: 4, textAlign: 'center' }}>
          <ShieldOutlinedIcon color="primary" sx={{ fontSize: 48, mb: 2 }} />
          <Typography component="h1" variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.04em' }}>
            Safe Quest
          </Typography>
          <Typography variant="h5" sx={{ mt: 2 }}>
            A calm place to explore online moments together.
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 650, mx: 'auto', mt: 2 }}>
            Safe Quest helps families explore reviewed online-safety situations before harm occurs. Each scenario opens space for privacy, emotional
            wellbeing, and the kind of support that makes it easier to ask for help.
          </Typography>
          <Stack spacing={1.5} sx={{ maxWidth: 650, mx: 'auto', mt: 4, textAlign: 'left' }}>
            <Typography>• Discussion first, never a grade or a test.</Typography>
            <Typography>• Reviewed offline scenarios, not live chats with an antagonist.</Typography>
            <Typography>• Help-seeking is always a strong, normal next step.</Typography>
          </Stack>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4, justifyContent: 'center' }}>
            <Button component={RouterLink} to="/register" variant="contained" size="large">
              Create account
            </Button>
            <Button component={RouterLink} to="/login" variant="outlined" size="large">
              Log in
            </Button>
          </Stack>
        </Paper>
      </Container>
    </Box>
  );
}
