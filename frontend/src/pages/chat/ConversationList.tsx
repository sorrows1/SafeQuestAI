import { Box, List, ListItemButton, ListItemAvatar, Avatar, ListItemText, Typography, Badge, IconButton, Tooltip } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import { useListConversationsQuery, useGetMessageRequestsQuery, useAcceptRequestMutation } from '@/store/api';
import { useNavigate, useParams } from 'react-router-dom';
import { useSnackbar } from 'notistack';

export function ConversationList() {
  const { data: convs = [] } = useListConversationsQuery(undefined, { pollingInterval: 5000 });
  const { data: requests = [] } = useGetMessageRequestsQuery(undefined, { pollingInterval: 10000 });
  const [acceptRequest] = useAcceptRequestMutation();
  const navigate = useNavigate();
  const { id } = useParams();
  const { enqueueSnackbar } = useSnackbar();

  const handleAccept = async (e: React.MouseEvent, scenarioId: string, difficulty: string) => {
    e.stopPropagation();
    try {
      const conv = await acceptRequest({ scenario_id: scenarioId, difficulty }).unwrap();
      navigate(`/chat/${conv.id}`);
      enqueueSnackbar('Request accepted', { variant: 'success' });
    } catch (err) {
      enqueueSnackbar('Failed to accept request', { variant: 'error' });
    }
  };

  return (
    <Box sx={{ width: 320, borderRight: '1px solid', borderColor: 'divider', display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ fontWeight: 700 }}>Chats</Typography>
      </Box>

      <List sx={{ flex: 1, overflow: 'auto', p: 0 }}>
        {requests.length > 0 && (
          <>
            <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>MESSAGE REQUESTS</Typography>
            </Box>
            {requests.map(req => (
              <ListItemButton key={req.scenario_id} sx={{ py: 1.5, borderBottom: '1px solid', borderColor: 'divider' }}>
                <ListItemAvatar>
                  <Avatar sx={{ bgcolor: req.contact_avatar.startsWith('color:') ? req.contact_avatar.split(':')[1] : 'primary.main' }}>
                    {req.contact_name[0].toUpperCase()}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{req.contact_name}</Typography>
                  }
                  secondary={
                    <Typography variant="body2" color="text.secondary" noWrap>{req.preview}</Typography>
                  }
                />
                <Tooltip title="Accept">
                  <IconButton size="small" color="primary" onClick={(e) => handleAccept(e, req.scenario_id, req.difficulty)}>
                    <CheckIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </ListItemButton>
            ))}
          </>
        )}

        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>ACTIVE CONVERSATIONS</Typography>
        </Box>
        
        {convs.map(conv => (
          <ListItemButton
            key={conv.id}
            selected={Number(id) === conv.id}
            onClick={() => navigate(`/chat/${conv.id}`)}
            sx={{ py: 1.5 }}
          >
            <ListItemAvatar>
              <Badge color="primary" variant="dot" invisible={conv.unread_count === 0}>
                <Avatar src={conv.contact_avatar?.startsWith('color:') ? undefined : (conv.contact_avatar || undefined)} sx={{ bgcolor: conv.contact_avatar?.startsWith('color:') ? conv.contact_avatar.split(':')[1] : 'primary.main' }}>
                  {conv.contact_name[0].toUpperCase()}
                </Avatar>
              </Badge>
            </ListItemAvatar>
            <ListItemText
              primary={
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: conv.unread_count > 0 ? 700 : 500 }}>
                    {conv.contact_name}
                  </Typography>
                  {conv.last_message_at && (
                    <Typography variant="caption" color="text.secondary">
                      {new Date(conv.last_message_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </Typography>
                  )}
                </Box>
              }
              secondary={
                <Typography variant="body2" color={conv.unread_count > 0 ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: conv.unread_count > 0 ? 600 : 400 }} noWrap>
                  {conv.last_message || 'Say hi!'}
                </Typography>
              }
            />
          </ListItemButton>
        ))}

        {convs.length === 0 && requests.length === 0 && (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography color="text.secondary" variant="body2">No conversations yet.</Typography>
          </Box>
        )}
      </List>
    </Box>
  );
}
