import {
  Alert,
  Avatar,
  Badge,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import SignalWifiOffIcon from '@mui/icons-material/SignalWifiOff';
import SyncIcon from '@mui/icons-material/Sync';
import PersonIcon from '@mui/icons-material/Person';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import type { FamilySessionParticipant, ParticipantPresenceStatus } from '@/types';

interface PresenceAvatarBarProps {
  participants?: FamilySessionParticipant[];
  streamStatus?: 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'offline';
  turnRole?: 'learner' | 'caregiver' | 'shared';
  userRole?: 'learner' | 'caregiver';
  onReconnect?: () => void;
  onContinueAsync?: () => void;
  onEndLater?: () => void;
}

export function PresenceAvatarBar({
  participants = [],
  streamStatus = 'connected',
  turnRole = 'learner',
  userRole = 'learner',
  onReconnect,
  onContinueAsync,
  onEndLater,
}: PresenceAvatarBarProps) {
  const isDisconnected = streamStatus === 'offline' || streamStatus === 'reconnecting';
  const disconnectedParticipant = participants.find((p) => p.presence_status === 'offline' || p.presence_status === 'left');

  const getStatusColor = (status?: ParticipantPresenceStatus) => {
    switch (status) {
      case 'online':
        return '#4caf50';
      case 'offline':
        return '#ff9800';
      case 'left':
        return '#f44336';
      default:
        return '#9e9e9e';
    }
  };

  const getTurnLabel = () => {
    if (turnRole === 'shared') return 'Shared Reflection & Review';
    if (turnRole === 'caregiver') {
      return userRole === 'caregiver' ? 'Your turn to guide & reflect' : "Waiting for caregiver's note";
    }
    return userRole === 'learner' ? 'Your turn to explore scene' : "Learner's turn";
  };

  return (
    <Stack spacing={1.5} sx={{ mb: 0 }}>
      {/* Stream Status Reconnect Banner if connecting/reconnecting/offline */}
      {isDisconnected && (
        <Alert
          severity={streamStatus === 'offline' ? 'warning' : 'info'}
          icon={streamStatus === 'offline' ? <SignalWifiOffIcon fontSize="small" /> : <SyncIcon className="MuiIcon-spin" fontSize="small" />}
          action={
            onReconnect ? (
              <Button color="inherit" size="small" onClick={onReconnect}>
                Reconnect Now
              </Button>
            ) : undefined
          }
          sx={{ borderRadius: 2.5, py: 0.5 }}
        >
          {streamStatus === 'offline'
            ? 'Live connection paused — operating in reliable polling mode.'
            : 'Reconnecting to live family session...'}
        </Alert>
      )}

      {/* Main Bar: Avatars & Turn Status */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          borderRadius: 3,
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'background.paper',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1.5,
        }}
      >
        {/* Left: Participant Avatars */}
        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Session Participants
          </Typography>

          <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center' }}>
            {participants.length > 0 ? (
              participants.map((p) => {
                const isCaregiver = p.role === 'caregiver';
                const status = p.presence_status ?? 'online';
                return (
                  <Tooltip key={p.member_ref} title={`${p.display_name} (${p.role}) — ${status}`}>
                    <Badge
                      overlap="circular"
                      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                      variant="dot"
                      sx={{
                        '& .MuiBadge-badge': {
                          backgroundColor: getStatusColor(status),
                          color: getStatusColor(status),
                          boxShadow: `0 0 0 2px #fff`,
                          width: 10,
                          height: 10,
                          borderRadius: '50%',
                        },
                      }}
                    >
                      <Avatar
                        alt={p.display_name}
                        src={p.avatar_url ?? undefined}
                        sx={{
                          width: 36,
                          height: 36,
                          bgcolor: isCaregiver ? 'secondary.main' : 'primary.main',
                          fontSize: '0.9rem',
                          fontWeight: 700,
                        }}
                      >
                        {isCaregiver ? <SupervisorAccountIcon fontSize="small" /> : <PersonIcon fontSize="small" />}
                      </Avatar>
                    </Badge>
                  </Tooltip>
                );
              })
            ) : (
              <Chip size="small" label="Solo / Local Mode" variant="outlined" sx={{ fontWeight: 600 }} />
            )}
          </Stack>
        </Stack>

        {/* Right: Turn Indicator */}
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <Chip
            size="small"
            color={turnRole === 'shared' ? 'info' : turnRole === userRole ? 'primary' : 'default'}
            icon={turnRole === 'shared' ? <CheckCircleIcon fontSize="small" /> : <HourglassEmptyIcon fontSize="small" />}
            label={getTurnLabel()}
            sx={{ fontWeight: 700, px: 0.5 }}
          />
        </Stack>
      </Paper>

      {/* Disconnect Recovery Options if a participant is offline/left */}
      {disconnectedParticipant && (
        <Paper
          elevation={0}
          sx={{
            p: 1.5,
            borderRadius: 2.5,
            bgcolor: 'action.hover',
            border: '1px border-dashed',
            borderColor: 'warning.main',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1.5,
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {disconnectedParticipant.display_name} is currently offline. You can continue or pause.
          </Typography>

          <Stack direction="row" spacing={1}>
            {onContinueAsync && (
              <Button size="small" variant="outlined" color="primary" onClick={onContinueAsync} sx={{ borderRadius: 2, textTransform: 'none' }}>
                Continue Asynchronously
              </Button>
            )}
            {onEndLater && (
              <Button size="small" variant="text" color="inherit" onClick={onEndLater} sx={{ fontSize: '0.75rem', textTransform: 'none' }}>
                Finish Together Later
              </Button>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
