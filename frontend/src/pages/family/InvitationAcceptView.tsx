import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  Avatar,
  Divider,
  Stack,
  Card,
  CardContent,
} from '@mui/material';
import ShieldIcon from '@mui/icons-material/Shield';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import ErrorOutlinedIcon from '@mui/icons-material/ErrorOutlined';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import {
  usePreviewFamilyInvitationQuery,
  useAcceptFamilyInvitationMutation,
  useDeclineFamilyInvitationMutation,
} from '@/store/api';
import { FamilyTopBar } from '@/components/family/FamilyTopBar';

export const InvitationAcceptView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const secretParam = searchParams.get('secret') || '';

  const [codeInput, setCodeInput] = useState('');
  const [activeSecret, setActiveSecret] = useState(secretParam);
  const [acceptedSuccess, setAcceptedSuccess] = useState(false);
  const [declinedSuccess, setDeclinedSuccess] = useState(false);

  const {
    data: preview,
    isLoading: isPreviewLoading,
    isError: isPreviewError,
  } = usePreviewFamilyInvitationQuery(activeSecret, {
    skip: !activeSecret || activeSecret.length < 6,
  });

  const [acceptInvitation, { isLoading: isAccepting, error: acceptError }] = useAcceptFamilyInvitationMutation();
  const [declineInvitation, { isLoading: isDeclining }] = useDeclineFamilyInvitationMutation();

  const handleCodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (codeInput.trim()) {
      const cleanCode = codeInput.trim();
      setActiveSecret(cleanCode);
      setSearchParams({ secret: cleanCode });
    }
  };

  const handleAccept = async () => {
    if (!activeSecret) return;
    try {
      await acceptInvitation({ secret: activeSecret }).unwrap();
      setAcceptedSuccess(true);
    } catch {
      // Handled by acceptError state
    }
  };

  const handleDecline = async () => {
    if (!activeSecret) return;
    try {
      await declineInvitation({ secret: activeSecret }).unwrap();
      setDeclinedSuccess(true);
    } catch {
      // Handled gracefully
    }
  };

  const formatExpiry = (isoString?: string) => {
    if (!isoString) return 'Soon';
    try {
      return new Date(isoString).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <FamilyTopBar />

      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper
          elevation={2}
          variant="outlined"
          sx={{
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            bgcolor: 'background.paper',
            borderColor: 'divider',
          }}
        >
          {/* Header Icon */}
          <Avatar
            sx={{
              width: 64,
              height: 64,
              mx: 'auto',
              mb: 2.5,
              bgcolor: acceptedSuccess ? 'success.main' : declinedSuccess ? 'action.disabled' : 'primary.main',
              color: 'common.white',
              boxShadow: acceptedSuccess ? '0 0 20px rgba(76, 175, 80, 0.4)' : '0 0 20px rgba(25, 118, 210, 0.4)',
            }}
          >
            {acceptedSuccess ? <CheckCircleOutlinedIcon fontSize="large" /> : <PersonAddIcon fontSize="large" />}
          </Avatar>

          {/* Success State - Accepted */}
          {acceptedSuccess ? (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1, letterSpacing: '-0.01em' }}>
                Family Relationship Linked!
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                You are now connected with <strong>{preview?.inviter_display_name || 'your family member'}</strong>. You can view linked members, practice together, and access shared discussion guides in the Caregiver Hub.
              </Typography>
              <Stack spacing={2} sx={{ mt: 3 }}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => navigate('/family/hub')}
                  sx={{ borderRadius: 2.5, py: 1.4, fontWeight: 700, fontSize: '1rem' }}
                >
                  Go to Caregiver Hub
                </Button>
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => navigate('/family/scenarios')}
                  sx={{ borderRadius: 2.5, py: 1.2, fontWeight: 600 }}
                >
                  Browse Practice Scenarios
                </Button>
              </Stack>
            </Box>
          ) : declinedSuccess ? (
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Invitation Declined
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                You have declined this family invitation. No relationship was created.
              </Typography>
              <Button
                variant="contained"
                onClick={() => navigate('/family/scenarios')}
                sx={{ mt: 1, borderRadius: 2.5, px: 3, py: 1 }}
              >
                Return to Scenarios
              </Button>
            </Box>
          ) : !activeSecret ? (
            /* Input Short Code State */
            <Box>
              <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                Family Invitation
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.6 }}>
                Enter the 8-character invitation short code or paste the secret link token to connect with your family member.
              </Typography>

              <Box component="form" onSubmit={handleCodeSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <TextField
                  label="Short Code or Secret Token"
                  placeholder="e.g. A7B9-K2M4"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  sx={{
                    input: {
                      textAlign: 'center',
                      fontFamily: 'monospace',
                      fontSize: '1.25rem',
                      letterSpacing: 3,
                      fontWeight: 700,
                    },
                  }}
                />
                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  disabled={!codeInput.trim()}
                  sx={{ borderRadius: 2.5, py: 1.4, fontWeight: 700 }}
                >
                  Preview Invitation
                </Button>
              </Box>
            </Box>
          ) : isPreviewLoading ? (
            /* Loading State */
            <Box sx={{ py: 5 }}>
              <CircularProgress size={52} thickness={4} />
              <Typography variant="body1" color="text.secondary" sx={{ mt: 2.5, fontWeight: 500 }}>
                Validating family invitation code…
              </Typography>
            </Box>
          ) : isPreviewError || !preview ? (
            /* Invalid / Expired / Revoked Error State */
            <Box>
              <Alert
                severity="error"
                icon={<ErrorOutlinedIcon fontSize="large" />}
                sx={{ borderRadius: 3, mb: 3, textAlign: 'left', p: 2 }}
              >
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>
                  Invitation Unavailable
                </Typography>
                This invitation link or code is invalid, expired, already accepted, or intended for a different account.
              </Alert>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Please ask your family member to generate a new invitation from their Caregiver Hub.
              </Typography>

              <Box component="form" onSubmit={handleCodeSubmit} sx={{ mt: 3, display: 'flex', gap: 1.5 }}>
                <TextField
                  placeholder="Enter another code"
                  value={codeInput}
                  onChange={(e) => setCodeInput(e.target.value)}
                  size="small"
                  fullWidth
                />
                <Button type="submit" variant="outlined" disabled={!codeInput.trim()} sx={{ borderRadius: 2 }}>
                  Try Code
                </Button>
              </Box>

              <Button
                startIcon={<ArrowBackIcon />}
                onClick={() => navigate('/family/scenarios')}
                sx={{ mt: 3, textTransform: 'none' }}
                color="inherit"
              >
                Back to Scenarios
              </Button>
            </Box>
          ) : (
            /* Preview State with Accept / Decline */
            <Box sx={{ textAlign: 'left' }}>
              <Typography variant="h5" sx={{ fontWeight: 800, textAlign: 'center', mb: 2.5 }}>
                Accept Family Invitation?
              </Typography>

              <Card
                variant="outlined"
                sx={{
                  my: 3,
                  borderRadius: 3,
                  bgcolor: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'primary.main', width: 52, height: 52, fontWeight: 700, fontSize: '1.2rem' }}>
                      {preview.inviter_display_name.charAt(0).toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        {preview.inviter_display_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Invited you to practice together as family • Expires: {formatExpiry(preview.expires_at)}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 2 }} />

                  <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                    <ShieldIcon color="primary" sx={{ mt: 0.3, fontSize: 24 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {preview.sharing_summary ||
                        'Linking enables practice with caregiver for explicitly shared scenario sessions. It will never expose private companion chats, email addresses, or unshared activity.'}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>

              {acceptError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {('data' in acceptError && (acceptError.data as { detail?: string })?.detail) || 'Failed to accept invitation'}
                </Alert>
              )}

              <Stack direction="row" spacing={2} sx={{ mt: 3.5 }}>
                <Button
                  variant="outlined"
                  color="inherit"
                  fullWidth
                  size="large"
                  onClick={handleDecline}
                  disabled={isDeclining || isAccepting}
                  startIcon={<CancelOutlinedIcon />}
                  sx={{ borderRadius: 2.5, py: 1.2 }}
                >
                  Decline
                </Button>
                <Button
                  variant="contained"
                  color="primary"
                  fullWidth
                  size="large"
                  onClick={handleAccept}
                  disabled={isAccepting || isDeclining}
                  startIcon={isAccepting ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlinedIcon />}
                  sx={{ borderRadius: 2.5, py: 1.3, fontWeight: 700 }}
                >
                  {isAccepting ? 'Accepting…' : 'Accept Invitation'}
                </Button>
              </Stack>
            </Box>
          )}
        </Paper>
      </Container>
    </Box>
  );
};
