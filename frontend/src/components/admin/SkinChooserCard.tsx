import {
  Box,
  Chip,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SecurityIcon from '@mui/icons-material/Security';
import type { RenderSkin } from '@/types';

interface SkinMetadata {
  id: RenderSkin;
  name: string;
  icon: string;
  description: string;
  supportedTypes: string[];
}

export const SKIN_METADATA_LIST: SkinMetadata[] = [
  {
    id: 'chat',
    name: 'Instant Chat',
    icon: '💬',
    description: 'Direct 1-on-1 instant messaging interface.',
    supportedTypes: ['message', 'conversation', 'profile', 'attachment'],
  },
  {
    id: 'email',
    name: 'Email Thread',
    icon: '📧',
    description: 'Inbox thread view with headers, addresses, and attachments.',
    supportedTypes: ['email', 'email_thread', 'email_header', 'attachment'],
  },
  {
    id: 'social_feed',
    name: 'Social Feed',
    icon: '📱',
    description: 'Social feed posts, user handles, likes, and comment threads.',
    supportedTypes: ['feed', 'post', 'comment', 'profile'],
  },
  {
    id: 'game_chat',
    name: 'Gaming Chat',
    icon: '🎮',
    description: 'In-game channel chat with gamer tags, badges, and stats.',
    supportedTypes: ['game_profile', 'game_badge', 'channel', 'member'],
  },
  {
    id: 'forum',
    name: 'Community Forum',
    icon: '🗣️',
    description: 'Discussion board thread with category sections and replies.',
    supportedTypes: ['forum_thread', 'forum_post', 'comment', 'site_section'],
  },
  {
    id: 'marketplace',
    name: 'Online Marketplace',
    icon: '🛍️',
    description: 'Item listing grid with seller info, price tags, and inquiries.',
    supportedTypes: ['listing', 'seller', 'price', 'listing_field'],
  },
];

interface SkinChooserProps {
  selectedSkin: RenderSkin;
  onSelectSkin: (skin: RenderSkin) => void;
}

export function SkinChooser({ selectedSkin, onSelectSkin }: SkinChooserProps) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: '1fr 1fr 1fr' }, gap: 2 }}>
      {SKIN_METADATA_LIST.map((skin) => {
        const isSelected = selectedSkin === skin.id;
        return (
          <Paper
            key={skin.id}
            elevation={0}
            onClick={() => onSelectSkin(skin.id)}
            sx={{
              p: 2,
              borderRadius: 3,
              border: '2px solid',
              borderColor: isSelected ? 'primary.main' : 'divider',
              bgcolor: isSelected ? 'action.selected' : 'background.paper',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              '&:hover': {
                borderColor: 'primary.main',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Stack spacing={1}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                  <Typography variant="h6" component="span">
                    {skin.icon}
                  </Typography>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                    {skin.name}
                  </Typography>
                </Stack>
                {isSelected && <CheckCircleIcon color="primary" fontSize="small" />}
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ minHeight: 36, display: 'block' }}>
                {skin.description}
              </Typography>

              <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                {skin.supportedTypes.map((type) => (
                  <Chip
                    key={type}
                    size="small"
                    label={type}
                    variant="outlined"
                    sx={{ fontSize: '0.65rem', height: 20 }}
                  />
                ))}
              </Stack>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, pt: 0.5 }}>
                <SecurityIcon sx={{ fontSize: 14, color: 'success.main' }} />
                <Typography variant="caption" color="success.main" sx={{ fontWeight: 700, fontSize: '0.7rem' }}>
                  Compatible Schema 1.0
                </Typography>
              </Box>
            </Stack>
          </Paper>
        );
      })}
    </Box>
  );
}
