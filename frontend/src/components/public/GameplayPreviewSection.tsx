import { useState } from 'react';
import { Box, Container, Stack, Tab, Tabs, Typography, useTheme, alpha } from '@mui/material';
import ChatBubbleOutlineOutlinedIcon from '@mui/icons-material/ChatBubbleOutlineOutlined';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import DynamicFeedIcon from '@mui/icons-material/DynamicFeed';
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ForumOutlinedIcon from '@mui/icons-material/ForumOutlined';
import { SkinRouter } from '@/components/scenario-render/SkinRouter';
import { authenticCoreFixtures } from '@/components/scenario-render/fixtures/authenticCoreFixtures';
import type { RenderSkin } from '@/types';

export function GameplayPreviewSection() {
  const theme = useTheme();
  const [tab, setTab] = useState<RenderSkin>('chat');
  const fixture = authenticCoreFixtures[tab];

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
            Scenarios are presented in realistic, responsive UI skins matching modern messaging, email, social, game chat, marketplace, and forum platforms.
          </Typography>
        </Stack>

        <Stack sx={{ alignItems: 'center', mb: 4 }}>
          <Tabs
            value={tab}
            onChange={(_, value) => setTab(value as RenderSkin)}
            textColor="primary"
            indicatorColor="primary"
            variant="scrollable"
            scrollButtons="auto"
            sx={{
              bgcolor: theme.palette.mode === 'dark' ? alpha('#151d2a', 0.6) : alpha('#000', 0.03),
              p: 0.5,
              borderRadius: '14px',
              maxWidth: '100%',
            }}
          >
            <Tab icon={<ChatBubbleOutlineOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Messaging Chat" value="chat" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<MailOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Email Inbox" value="email" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<DynamicFeedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Social Feed" value="social_feed" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<SportsEsportsOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Game Chat" value="game_chat" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<StorefrontIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Marketplace" value="marketplace" sx={{ borderRadius: '10px', px: 2.5 }} />
            <Tab icon={<ForumOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Forum" value="forum" sx={{ borderRadius: '10px', px: 2.5 }} />
          </Tabs>
        </Stack>

        {/* Tab Content Mockups rendered directly via SkinRouter */}
        <Box sx={{ maxWidth: 780, mx: 'auto' }}>
          {fixture && (
            <SkinRouter
              renderSkin={tab}
              scene={fixture.scene}
              selection={{ selectedElementKeys: [] }}
              onSelect={() => {}}
              readOnly={true}
              testId={`public-${tab}-preview`}
            />
          )}
        </Box>
      </Container>
    </Box>
  );
}
