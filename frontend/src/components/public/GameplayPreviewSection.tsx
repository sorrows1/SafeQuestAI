import { useState } from 'react';
import { Box, Card, Container, Stack, Tab, Tabs, Typography, useTheme, alpha } from '@mui/material';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';

export function GameplayPreviewSection() {
  const theme = useTheme();
  const [tab, setTab] = useState<'chat' | 'email' | 'social_feed'>('chat');

  return (
    <Box id="gameplay-preview" sx={{ py: { xs: 8, md: 12 } }}>
      <Container maxWidth="lg">
        <Stack spacing={2} sx={{ textAlign: 'center', mb: 5 }}>
          <Typography variant="overline" color="primary" sx={{ fontWeight: 800, letterSpacing: '0.1em' }}>
            MULTIPLE PLATFORM SKINS
          </Typography>
          <Typography variant="h2" component="h2" sx={{ fontWeight: 800 }}>
            Familiar interfaces kids recognize instantly
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 650, mx: 'auto' }}>
            Scenarios are presented in realistic, responsive UI skins matching modern messaging, email, and social media platforms.
          </Typography>
        </Stack>

        <Stack sx={{ alignItems: 'center', mb: 4 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value)}
            textColor="primary"
            indicatorColor="primary"
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? alpha('#151d2a', 0.6) : alpha('#000', 0.03),
              p: 0.5,
              borderRadius: '14px',
            }}
          >
            <Tab icon={<ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Messaging Chat" value="chat" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<MailOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Email Inbox" value="email" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<DynamicFeedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Social Feed" value="social_feed" sx={{ borderRadius: '10px', px: 2.5 }} />
          </Tabs>
        </Stack>

        {/* Tab Content Mockups */}
        <Box sx={{ maxWidth: 780, mx: 'auto' }}>
          {tab === 'chat' && (
            <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, bgcolor: theme.palette.mode === 'dark' ? '#151d2a' : '#ffffff' }}>
              <Stack spacing={2}>
                <Box sx={{ pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Direct Message · Gaming Squad Channel
                  </Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)', maxWidth: '80%' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Apex_Gamer_99
                  </Typography>
                  <Typography variant="body2">
                    "If you don't share your private stream password right now, I'll tell everyone in the server that you cheated in the tournament!"
                  </Typography>
                </Box>
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? alpha('#60a5fa', 0.15) : alpha('#2563eb', 0.1), maxWidth: '80%', ml: 'auto' }}>
                  <Typography variant="caption" color="primary" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                    Your Response
                  </Typography>
                  <Typography variant="body2">
                    "I don't share passwords. Threatening me isn't okay, so I'm reporting this to the squad moderator and blocking this chat."
                  </Typography>
                </Box>
              </Stack>
            </Card>
          )}

          {tab === 'email' && (
            <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, bgcolor: theme.palette.mode === 'dark' ? '#151d2a' : '#ffffff' }}>
              <Stack spacing={2}>
                <Box sx={{ pb: 1.5, borderBottom: `1px solid ${theme.palette.divider}` }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                    Subject: URGENT — Your Game Account Will Be Deleted in 24 Hours!
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    From: support-verify-security-alert@free-coins-reward.net
                  </Typography>
                </Box>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  Dear Gamer, We noticed unusual activity on your account. Click the link below and enter your account login credentials within 24 hours to verify your identity and prevent permanent suspension.
                </Typography>
                <Box sx={{ p: 2, borderRadius: 3, border: `1px solid ${theme.palette.divider}`, bgcolor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                  <Typography variant="caption" color="primary.main" sx={{ fontWeight: 700, display: 'block', mb: 0.5 }}>
                    Spotting the Scam Cues
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Notice the strange domain name and artificial urgency. Legitimate game platforms never ask for your password via external link emails!
                  </Typography>
                </Box>
              </Stack>
            </Card>
          )}

          {tab === 'social_feed' && (
            <Card variant="outlined" sx={{ p: { xs: 2.5, sm: 4 }, borderRadius: 4, bgcolor: theme.palette.mode === 'dark' ? '#151d2a' : '#ffffff' }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: 14 }}>
                    SQ
                  </Box>
                  <Box>
                    <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                      School Vibe Posts
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      2 hours ago · Public Feed
                    </Typography>
                  </Box>
                </Stack>
                <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
                  "Look at this awkward photo of Alex sitting alone at lunch! Who thinks this is hilarious? Repost to spread the word! 😂"
                </Typography>
                <Box sx={{ p: 2, borderRadius: 3, bgcolor: theme.palette.mode === 'dark' ? alpha('#34d399', 0.12) : alpha('#059669', 0.08) }}>
                  <Typography variant="subtitle2" color="secondary.main" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Pause Before Posting / Sharing
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Before liking or reposting, ask yourself: How would Alex feel seeing this? Choosing not to amplify hurtful posts protects online kindness.
                  </Typography>
                </Box>
              </Stack>
            </Card>
          )}
        </Box>
      </Container>
    </Box>
  );
}
