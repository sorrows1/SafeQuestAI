import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  Box,
  Alert,
  IconButton,
  Tooltip,
  Paper,
  Divider,
  Chip,
  CircularProgress,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import SendIcon from '@mui/icons-material/Send';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import { useCreateFamilyInvitationMutation } from '@/store/api';
import type { FamilyRelationshipInvitation, FamilyRole } from '@/types';

interface InviteFamilyMemberModalProps {
  open: boolean;
  onClose: () => void;
}

export const InviteFamilyMemberModal: React.FC<InviteFamilyMemberModalProps> = ({ open, onClose }) => {
  const [email, setEmail] = useState('');
  const [familyRole, setFamilyRole] = useState<FamilyRole>('caregiver');
  const [deliveryLabel, setDeliveryLabel] = useState('');
  const [createdInvitation, setCreatedInvitation] = useState<FamilyRelationshipInvitation | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  const [createInvitation, { isLoading, error }] = useCreateFamilyInvitationMutation();

  const handleReset = () => {
    setEmail('');
    setFamilyRole('caregiver');
    setDeliveryLabel('');
    setCreatedInvitation(null);
    setCopiedLink(false);
    setCopiedCode(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const res = await createInvitation({
        learner_email: email.trim(),
        family_role: familyRole,
        delivery_label: deliveryLabel.trim() || undefined,
      }).unwrap();
      setCreatedInvitation(res);
    } catch {
      // Error handled by RTK mutation error state
    }
  };

  const shareUrl = createdInvitation?.token
    ? `${window.location.origin}/family/invitations/accept?secret=${encodeURIComponent(createdInvitation.token)}`
    : '';

  const handleCopyLink = () => {
    if (shareUrl) {
      navigator.clipboard.writeText(shareUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCode = () => {
    if (createdInvitation?.short_code) {
      navigator.clipboard.writeText(createdInvitation.short_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const errorMessage = error && 'data' in error ? (error.data as { detail?: string })?.detail || 'Failed to create invitation' : null;

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth slotProps={{ paper: { style: { borderRadius: 16 } } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <GroupAddIcon color="primary" />
          <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
            Invite a Family Member
          </Typography>
        </Box>
        <IconButton onClick={handleClose} size="small" aria-label="close">
          <CloseIcon />
        </IconButton>
      </DialogTitle>

      <Divider />

      <DialogContent sx={{ py: 3 }}>
        {!createdInvitation ? (
          <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <Typography variant="body2" color="text.secondary">
              Enter the email address of your family member (caregiver or learner) to generate a secure invitation link and short code.
            </Typography>

            <Alert severity="info" icon={<ShieldOutlinedIcon />} sx={{ borderRadius: 2 }}>
              Linking allows explicitly sharing scenario practices and discussion guides. It does <strong>not</strong> expose private companion chats, email addresses, or unshared activity.
            </Alert>

            {errorMessage && (
              <Alert severity="error" sx={{ borderRadius: 2 }}>
                {errorMessage}
              </Alert>
            )}

            <TextField
              select
              label="Your family role"
              value={familyRole}
              onChange={(e) => setFamilyRole(e.target.value as FamilyRole)}
              fullWidth
              disabled={isLoading}
              slotProps={{ select: { native: true } }}
            >
              <option value="caregiver">Caregiver (inviting a learner)</option>
              <option value="learner">Learner (inviting a caregiver)</option>
            </TextField>

            <TextField
              label="Family Member Email"
              type="email"
              placeholder="e.g. alex@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              disabled={isLoading}
              autoFocus
            />

            <TextField
              label="Optional Note or Label"
              placeholder="e.g. Alex's tablet"
              value={deliveryLabel}
              onChange={(e) => setDeliveryLabel(e.target.value)}
              fullWidth
              disabled={isLoading}
              helperText="Helpful label to identify who this invitation is for"
            />

            <Button
              type="submit"
              variant="contained"
              size="large"
              disabled={isLoading || !email.trim()}
              startIcon={isLoading ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
              sx={{ mt: 1, py: 1.2, borderRadius: 2, fontWeight: 'bold' }}
            >
              {isLoading ? 'Generating Invitation…' : 'Generate Secure Invitation'}
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Alert severity="success" sx={{ borderRadius: 2 }}>
              Invitation created successfully! Share the link or 8-character code below with <strong>{createdInvitation.delivery_label || email}</strong>.
            </Alert>

            {/* Share Link Card */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                INVITATION SHARE LINK (SINGLE-USE)
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                <TextField
                  value={shareUrl}
                  slotProps={{ input: { readOnly: true } }}
                  fullWidth
                  size="small"
                  sx={{ input: { fontFamily: 'monospace', fontSize: '0.85rem' } }}
                />
                <Tooltip title={copiedLink ? 'Copied Link!' : 'Copy Link'}>
                  <Button
                    variant={copiedLink ? 'contained' : 'outlined'}
                    color={copiedLink ? 'success' : 'primary'}
                    onClick={handleCopyLink}
                    startIcon={copiedLink ? <CheckIcon /> : <ContentCopyIcon />}
                    sx={{ whiteSpace: 'nowrap', minWidth: 120 }}
                  >
                    {copiedLink ? 'Copied' : 'Copy Link'}
                  </Button>
                </Tooltip>
              </Box>
            </Paper>

            {/* Short Code Card */}
            <Paper variant="outlined" sx={{ p: 2, borderRadius: 2, bgcolor: 'background.paper', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold', display: 'block', mb: 1 }}>
                HUMAN-ENTERED SHORT CODE
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2, my: 1 }}>
                <Chip
                  label={createdInvitation.short_code}
                  color="primary"
                  variant="filled"
                  sx={{
                    fontSize: '1.4rem',
                    fontWeight: 'bold',
                    py: 2.5,
                    px: 2,
                    letterSpacing: 2,
                    fontFamily: 'monospace',
                  }}
                />
                <Tooltip title={copiedCode ? 'Copied Code!' : 'Copy Code'}>
                  <IconButton color={copiedCode ? 'success' : 'primary'} onClick={handleCopyCode} size="large">
                    {copiedCode ? <CheckIcon /> : <ContentCopyIcon />}
                  </IconButton>
                </Tooltip>
              </Box>
              <Typography variant="caption" color="text.secondary">
                Your family member can type this short code on their device to preview and accept.
              </Typography>
            </Paper>

            <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
              This invitation will expire in 7 days.
            </Typography>
          </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, pb: 3.5 }}>
        {createdInvitation ? (
          <>
            <Button onClick={handleReset} variant="outlined" sx={{ borderRadius: 2 }}>
              Create Another Invitation
            </Button>
            <Button onClick={handleClose} variant="contained" sx={{ borderRadius: 2 }}>
              Done
            </Button>
          </>
        ) : (
          <Button onClick={handleClose} color="inherit">
            Cancel
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};
