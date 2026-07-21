import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Box, Typography, Avatar, IconButton, TextField, CircularProgress, Tooltip, Divider } from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ArchiveIcon from '@mui/icons-material/Archive';
import DeleteIcon from '@mui/icons-material/Delete';
import { useGetConversationQuery, useSendMessageMutation, usePatchConversationMutation, useDeleteConversationMutation } from '@/store/api';
import { MessageBubble } from '@/components/messaging/MessageBubble';
import { TypingIndicator } from '@/components/messaging/TypingIndicator';
import { useNavigate } from 'react-router-dom';

export function ChatView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const convId = Number(id);
  const { data: conv, isLoading } = useGetConversationQuery(convId, { skip: !convId, pollingInterval: 3000 });
  const [sendMessage, { isLoading: sending }] = useSendMessageMutation();
  const [patchConv] = usePatchConversationMutation();
  const [deleteConv] = useDeleteConversationMutation();
  
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [conv?.messages, sending]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const msg = input.trim();
    setInput('');
    try {
      await sendMessage({ conv_id: convId, content: msg }).unwrap();
    } catch (err) {
      console.error('Send failed', err);
    }
  };

  const handleArchive = async () => {
    await patchConv({ id: convId, status: 'archived' });
    navigate('/chat');
  };

  const handleDelete = async () => {
    if (confirm('Delete this conversation? This cannot be undone.')) {
      await deleteConv(convId);
      navigate('/chat');
    }
  };

  if (isLoading) {
    return <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CircularProgress /></Box>;
  }

  if (!conv) {
    return <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Typography color="text.secondary">Conversation not found</Typography></Box>;
  }

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', bgcolor: 'background.default' }}>
      {/* Header */}
      <Box sx={{ px: 3, py: 2, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', alignItems: 'center', bgcolor: 'background.paper' }}>
        <Avatar src={conv.contact_avatar?.startsWith('color:') ? undefined : (conv.contact_avatar || undefined)} sx={{ bgcolor: conv.contact_avatar?.startsWith('color:') ? conv.contact_avatar.split(':')[1] : 'primary.main', mr: 2 }}>
          {conv.contact_name[0].toUpperCase()}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>{conv.contact_name}</Typography>
          <Typography variant="caption" color="success.main" sx={{ fontWeight: 500 }}>Online</Typography>
        </Box>
        <Tooltip title="Archive">
          <IconButton size="small" onClick={handleArchive} sx={{ mr: 1 }}><ArchiveIcon /></IconButton>
        </Tooltip>
        <Tooltip title="Delete">
          <IconButton size="small" color="error" onClick={handleDelete}><DeleteIcon /></IconButton>
        </Tooltip>
      </Box>

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3, display: 'flex', flexDirection: 'column' }}>
        {conv.messages.length === 0 ? (
          <Box sx={{ m: 'auto', textAlign: 'center' }}>
            <Avatar sx={{ width: 64, height: 64, mx: 'auto', mb: 2, bgcolor: 'divider', color: 'text.secondary' }}>{conv.contact_name[0].toUpperCase()}</Avatar>
            <Typography color="text.secondary">This is the beginning of your conversation with {conv.contact_name}.</Typography>
          </Box>
        ) : (
          conv.messages.map((m) => (
            <MessageBubble
              key={m.id}
              sender={m.sender as any}
              content={m.content}
              timestamp={m.timestamp}
              avatarUrl={conv.contact_avatar}
              contactName={m.sender === 'contact' ? conv.contact_name : undefined}
            />
          ))
        )}
        {sending && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </Box>

      {/* Input */}
      <Box sx={{ p: 2, bgcolor: 'background.paper', borderTop: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            maxRows={4}
            placeholder={`Message ${conv.contact_name}...`}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            sx={{ '& .MuiOutlinedInput-root': { borderRadius: 3, bgcolor: 'action.hover' } }}
          />
          <IconButton color="primary" onClick={handleSend} disabled={!input.trim() || sending} sx={{ bgcolor: 'primary.main', color: 'primary.contrastText', '&:hover': { bgcolor: 'primary.dark' }, p: 1.5 }}>
            <SendIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}
