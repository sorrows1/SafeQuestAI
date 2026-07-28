import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Card,
  CardContent,
  Avatar,
  Radio,
  IconButton,
  Chip,
  Alert,
  Divider,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import PeopleOutlinedIcon from '@mui/icons-material/PeopleOutlined';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import PersonAddOutlinedIcon from '@mui/icons-material/PersonAddOutlined';
import { useGetFamilyRelationshipsQuery } from '@/store/api';
import type { FamilyRelationship } from '@/types';

interface CaregiverSelectorModalProps {
  open: boolean;
  scenarioTitle: string;
  onClose: () => void;
  onConfirm: (relationshipRef?: string, companionMode?: boolean) => void;
  onOpenInviteModal?: () => void;
  isStarting?: boolean;
}

export const CaregiverSelectorModal: React.FC<CaregiverSelectorModalProps> = ({
  open,
  scenarioTitle,
  onClose,
  onConfirm,
  onOpenInviteModal,
  isStarting = false,
}) => {
  const { data: relationships, isLoading } = useGetFamilyRelationshipsQuery(undefined, { skip: !open });

  const activeRelationships = relationships?.filter((r) => r.status === 'active' && r.viewer_role === 'learner' && r.member_role === 'caregiver') || [];

  // Default selection: if active relationships exist, select the first one; otherwise solo mode
  const [selectedRef, setSelectedRef] = useState<string | 'solo'>(() => {
    return activeRelationships.length > 0 ? activeRelationships[0].relationship_ref : 'solo';
  });

  // Keep state updated if relationships load
  React.useEffect(() => {
    if (activeRelationships.length > 0 && selectedRef === 'solo' && relationships) {
      setSelectedRef(activeRelationships[0].relationship_ref);
    }
  }, [relationships]);

  const handleStart = () => {
    if (selectedRef === 'solo') {
      onConfirm(undefined, true);
    } else {
      onConfirm(selectedRef, false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth slotProps={{ paper: { style: { borderRadius: 16 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <PeopleOutlinedIcon color="primary" />
          <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
            Choose how to practice
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 3 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Select your practice mode for <strong>{scenarioTitle}</strong>.
        </Typography>

        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={32} />
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
            {/* Linked Family Members */}
            {activeRelationships.length > 0 ? (
              activeRelationships.map((rel: FamilyRelationship) => {
                const isSelected = selectedRef === rel.relationship_ref;
                return (
                  <Card
                    key={rel.relationship_ref}
                    variant="outlined"
                    onClick={() => setSelectedRef(rel.relationship_ref)}
                    sx={{
                      cursor: 'pointer',
                      borderRadius: 2,
                      borderColor: isSelected ? 'primary.main' : 'divider',
                      borderWidth: isSelected ? 2 : 1,
                      bgcolor: isSelected ? 'action.selected' : 'background.paper',
                      transition: 'all 0.2s ease',
                      '&:hover': { borderColor: 'primary.light' },
                    }}
                  >
                    <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2, p: 2, '&:last-child': { pb: 2 } }}>
                      <Radio checked={isSelected} value={rel.relationship_ref} onChange={() => setSelectedRef(rel.relationship_ref)} />
                      <Avatar
                        src={rel.member_avatar_url || undefined}
                        sx={{ bgcolor: 'primary.main', fontWeight: 'bold' }}
                      >
                        {rel.member_display_name.charAt(0).toUpperCase()}
                      </Avatar>
                      <Box sx={{ flexGrow: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                            Practice with caregiver ({rel.member_display_name})
                          </Typography>
                          <Chip
                            label={rel.role === 'caregiver' ? 'Caregiver' : 'Learner'}
                            size="small"
                            color="primary"
                            variant="filled"
                          />
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Shared session • Checkpoint responses & guide available for discussion
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <Alert
                severity="info"
                icon={<ShieldOutlinedIcon />}
                action={
                  onOpenInviteModal && (
                    <Button
                      color="primary"
                      size="small"
                      startIcon={<PersonAddOutlinedIcon />}
                      onClick={onOpenInviteModal}
                    >
                      Invite
                    </Button>
                  )
                }
                sx={{ borderRadius: 2 }}
              >
                No eligible caregiver is linked yet. Invite a caregiver to start shared practice.
              </Alert>
            )}
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          size="large"
          onClick={handleStart}
          disabled={isStarting || isLoading}
          sx={{ borderRadius: 2, px: 3, fontWeight: 'bold' }}
        >
          {isStarting ? 'Starting Session…' : 'Start Session'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
