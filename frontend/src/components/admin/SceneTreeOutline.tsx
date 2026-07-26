import { useState } from 'react';
import {
  Box,
  Button,
  Chip,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import AddIcon from '@mui/icons-material/Add';
import FlagIcon from '@mui/icons-material/Flag';
import MessageIcon from '@mui/icons-material/Message';
import EmailIcon from '@mui/icons-material/Email';
import PostAddIcon from '@mui/icons-material/PostAdd';
import PersonIcon from '@mui/icons-material/Person';
import AttachmentIcon from '@mui/icons-material/Attachment';
import SearchIcon from '@mui/icons-material/Search';
import type { SceneElement } from '@/types';

interface SceneTreeOutlineProps {
  elements: SceneElement[];
  selectedKey?: string | null;
  onSelectElement: (elementKey: string) => void;
  onAddElement?: () => void;
  annotatedElementKeys?: string[];
}

export function SceneTreeOutline({
  elements = [],
  selectedKey = null,
  onSelectElement,
  onAddElement,
  annotatedElementKeys = [],
}: SceneTreeOutlineProps) {
  const [filter, setFilter] = useState('');

  const getElementIcon = (type: string) => {
    switch (type) {
      case 'email':
      case 'email_message':
      case 'email_thread':
        return <EmailIcon fontSize="small" color="info" />;
      case 'post':
      case 'feed':
      case 'comment':
        return <PostAddIcon fontSize="small" color="secondary" />;
      case 'profile':
      case 'game_profile':
      case 'seller':
        return <PersonIcon fontSize="small" color="primary" />;
      case 'attachment':
      case 'link_preview':
        return <AttachmentIcon fontSize="small" />;
      case 'message':
      default:
        return <MessageIcon fontSize="small" color="action" />;
    }
  };

  const filteredElements = elements.filter(
    (el) =>
      el.element_key.toLowerCase().includes(filter.toLowerCase()) ||
      (el.content && el.content.toLowerCase().includes(filter.toLowerCase())) ||
      el.accessible_label.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        borderRadius: 3,
        border: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        maxHeight: 520,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <AccountTreeIcon color="primary" fontSize="small" />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Scene Elements ({elements.length})
          </Typography>
        </Stack>
        {onAddElement && (
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={onAddElement}>
            Add Artifact
          </Button>
        )}
      </Box>

      <TextField
        size="small"
        fullWidth
        placeholder="Filter elements by key or text..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        slotProps={{ input: { startAdornment: <SearchIcon fontSize="small" sx={{ mr: 0.5, opacity: 0.5 }} /> } }}
      />

      <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5 }}>
        <List dense disablePadding>
          {filteredElements.map((el) => {
            const isSelected = selectedKey === el.element_key;
            const hasAnnotation = annotatedElementKeys.includes(el.element_key);

            return (
              <ListItemButton
                key={el.element_key}
                selected={isSelected}
                onClick={() => onSelectElement(el.element_key)}
                sx={{
                  borderRadius: 2,
                  mb: 0.5,
                  borderLeft: el.parent_element_key ? '2px solid' : 'none',
                  borderLeftColor: 'divider',
                  pl: el.parent_element_key ? 2 : 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>{getElementIcon(el.element_type)}</ListItemIcon>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontSize: '0.8125rem' }} noWrap>
                        {el.element_key}
                      </Typography>
                      {hasAnnotation && (
                        <Tooltip title="Annotated Red-Flag Target">
                          <FlagIcon color="warning" sx={{ fontSize: 14 }} />
                        </Tooltip>
                      )}
                    </Box>
                  }
                  secondary={el.accessible_label || el.content || el.element_type}
                  slotProps={{
                    secondary: { sx: { fontSize: '0.7rem' }, noWrap: true },
                  }}
                />
                {el.selectable && (
                  <Chip size="small" label="Target" color="primary" variant="outlined" sx={{ fontSize: '0.6rem', height: 18 }} />
                )}
              </ListItemButton>
            );
          })}
        </List>
      </Box>
    </Paper>
  );
}
