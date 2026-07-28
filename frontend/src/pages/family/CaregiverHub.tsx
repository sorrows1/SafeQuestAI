import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { FamilyAppShell } from '@/components/family/FamilyAppShell';
import { InviteFamilyMemberModal } from '@/components/family/InviteFamilyMemberModal';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import PersonAddAlt1Icon from '@mui/icons-material/PersonAddAlt1';
import GroupIcon from '@mui/icons-material/Group';
import MailOutlineOutlinedIcon from '@mui/icons-material/MailOutlineOutlined';
import LoginIcon from '@mui/icons-material/Login';
import DoDisturbIcon from '@mui/icons-material/DoDisturb';
import BlockIcon from '@mui/icons-material/Block';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import LaunchIcon from '@mui/icons-material/Launch';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import KeyIcon from '@mui/icons-material/Key';
import {
  useAcceptFamilyInvitationAsRecipientMutation,
  useDeclineFamilyInvitationAsRecipientMutation,
  useGetFamilyInvitationsQuery,
  useGetFamilyRelationshipsQuery,
  useGetAuthorizedFamilySessionsQuery,
  useRevokeFamilyInvitationMutation,
  useUpdateFamilyRelationshipMutation,
  useJoinFamilySessionMutation,
} from '@/store/api';

export function CaregiverHub() {
  const navigate = useNavigate();
  const { data: invitations = [], isLoading: invitationsLoading, isError: invitationsError, refetch: refetchInvitations } = useGetFamilyInvitationsQuery();
  const { data: relationships = [], isLoading: relationshipsLoading, isError: relationshipsError, refetch: refetchRelationships } = useGetFamilyRelationshipsQuery();
  const { data: authorizedSessions = [], isLoading: sessionsLoading, isError: sessionsError, refetch: refetchSessions } = useGetAuthorizedFamilySessionsQuery(undefined, { pollingInterval: 10000 });
  const [acceptInvitation] = useAcceptFamilyInvitationAsRecipientMutation();
  const [declineInvitation] = useDeclineFamilyInvitationAsRecipientMutation();
  const [revokeInvitation] = useRevokeFamilyInvitationMutation();
  const [updateRelationship] = useUpdateFamilyRelationshipMutation();
  const [joinSession] = useJoinFamilySessionMutation();
  const [tabIndex, setTabIndex] = useState(0);
  const [snackbarMsg, setSnackbarMsg] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    type: 'revoke' | 'block' | 'unlink';
    ref: string;
    label: string;
  } | null>(null);

  const currentUserEmail = ''; // Will be set from auth context if available

  // Separate sent vs received invitations
  const sentInvitations = invitations.filter((inv: any) => inv.direction === 'sent');
  const receivedInvitations = invitations.filter((inv: any) => inv.direction === 'received');

  const handleCopy = (text: string, label: string) => {
    void navigator.clipboard.writeText(text);
    setSnackbarMsg(`${label} copied to clipboard`);
  };

  const handleAccept = async (ref: string) => {
    try {
      await acceptInvitation({ invitation_ref: ref }).unwrap();
      setSnackbarMsg('Invitation accepted! You are now linked with your family member.');
      void refetchInvitations();
      void refetchRelationships();
    } catch {
      setSnackbarMsg('Could not accept invitation. It may have expired or been revoked.');
    }
  };

  const handleDecline = async (ref: string) => {
    try {
      await declineInvitation({ invitation_ref: ref }).unwrap();
      setSnackbarMsg('Invitation declined.');
      void refetchInvitations();
    } catch {
      setSnackbarMsg('Could not decline invitation.');
    }
  };

  const handleJoinSession = async () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) {
      setJoinError('Please enter a valid session code.');
      return;
    }
    setJoining(true);
    setJoinError(null);
    try {
      const result = await joinSession({ session_code: code }).unwrap();
      setSnackbarMsg('Joined session successfully!');
      setJoinCode('');
      void refetchSessions();
      navigate(`/family/scenarios/${result.session.transcript_id}/sessions/${result.session.public_id}`);
    } catch (err: any) {
      if (err?.status === 404) setJoinError('Invalid session code. Check the code and try again.');
      else if (err?.status === 400) setJoinError('This session has ended.');
      else if (err?.status === 409) setJoinError('You are already a member of this session.');
      else if (err?.status === 403) setJoinError('You must be linked with the learner to join this session.');
      else setJoinError('Could not join session. Please try again.');
    } finally {
      setJoining(false);
    }
  };

  const handleRevoke = async (ref: string) => {
    try {
      await revokeInvitation(ref).unwrap();
      setSnackbarMsg('Invitation revoked.');
      void refetchInvitations();
    } catch {
      setSnackbarMsg('Could not revoke invitation.');
    }
    setConfirmAction(null);
  };

  const handleUpdateRelationship = async (ref: string, action: 'block' | 'unlink') => {
    try {
      await updateRelationship({ relationship_ref: ref, action: action }).unwrap();
      setSnackbarMsg(action === 'block' ? 'Family member blocked.' : 'Family link removed.');
      void refetchRelationships();
      void refetchSessions();
    } catch {
      setSnackbarMsg('Could not update relationship.');
    }
    setConfirmAction(null);
  };

  const tabs = [
    { label: 'Family Members', icon: <GroupIcon fontSize="small" /> },
    { label: 'Invitations', icon: <MailOutlineOutlinedIcon fontSize="small" /> },
    { label: 'Active Practice Sessions', icon: <PlayArrowIcon fontSize="small" /> },
  ];

  return (
    <FamilyAppShell>
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
        <Box sx={{ width: 44, height: 44, borderRadius: 2.5, bgcolor: 'primary.main', color: 'primary.contrastText', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <GroupIcon />
        </Box>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800 }}>Caregiver Hub</Typography>
          <Typography variant="caption" color="text.secondary">Manage family connections and practice sessions</Typography>
          <Button size="small" variant="contained" startIcon={<PersonAddAlt1Icon />} onClick={() => setInviteModalOpen(true)} sx={{ mt: 1, borderRadius: 2, textTransform: 'none' }}>Invite family member</Button>
        </Box>
      </Box>

      <ToggleButtonGroup
        value={tabIndex}
        exclusive
        onChange={(_, i) => i !== null && setTabIndex(i)}
        size="small"
        sx={{ mb: 3, flexWrap: 'wrap', gap: 0.5, '& .MuiToggleButton-root': { borderRadius: '20px !important', px: 2, textTransform: 'none', fontWeight: 700 } }}
      >
        {tabs.map((tab, i) => (
          <ToggleButton key={i} value={i} selected={tabIndex === i}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {tab.icon}
              {tab.label}
            </Box>
          </ToggleButton>
        ))}
      </ToggleButtonGroup>

      {/* Tab 0: Family Members */}
      {tabIndex === 0 && (
        <Stack spacing={2}>
          {relationshipsLoading && <Alert severity="info">Loading family members…</Alert>}
          {relationshipsError && <Alert severity="error" action={<Button onClick={() => void refetchRelationships()}>Retry</Button>}>Could not load family members.</Alert>}
          {relationships.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }} elevation={0} variant="outlined">
              <GroupIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
                No family members linked yet
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Send or accept an invitation to get started
              </Typography>
            </Paper>
          ) : (
            relationships.map((rel: any) => (
              <Card key={rel.relationship_ref} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent sx={{ pb: 1 }}>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: '50%', bgcolor: rel.role === 'caregiver' ? 'secondary.100' : 'primary.100', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '1rem' }}>
                      {rel.member_display_name?.charAt(0)?.toUpperCase() ?? '?'}
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {rel.member_display_name ?? 'Family Member'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {rel.member_role === 'caregiver' ? 'Caregiver' : rel.member_role === 'learner' ? 'Learner' : 'Family member'} · Connected {new Date(rel.accepted_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={rel.status}
                      color={rel.status === 'active' ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                    />
                  </Stack>
                </CardContent>
                {rel.status === 'active' && (
                  <CardActions sx={{ px: 2, pb: 2, pt: 0 }}>
                    <Button
                      size="small"
                      variant="outlined"
                      startIcon={<PlayArrowIcon />}
                      onClick={() => navigate(`/family/scenarios?with=${rel.relationship_ref}`)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      Start Practice Session
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      color="error"
                      startIcon={<BlockIcon />}
                      onClick={() => setConfirmAction({ type: 'block', ref: rel.relationship_ref, label: rel.member_display_name ?? 'this member' })}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, ml: 'auto' }}
                    >
                      Block
                    </Button>
                    <Button
                      size="small"
                      variant="text"
                      color="inherit"
                      startIcon={<LinkOffIcon />}
                      onClick={() => setConfirmAction({ type: 'unlink', ref: rel.relationship_ref, label: rel.member_display_name ?? 'this member' })}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                    >
                      Unlink
                    </Button>
                  </CardActions>
                )}
              </Card>
            ))
          )}
        </Stack>
      )}

      {/* Tab 1: Invitations */}
      {tabIndex === 1 && (
        <Stack spacing={2}>
          {invitationsLoading && <Alert severity="info">Loading invitations…</Alert>}
          {invitationsError && <Alert severity="error" action={<Button onClick={() => void refetchInvitations()}>Retry</Button>}>Could not load invitations.</Alert>}
          {invitations.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }} elevation={0} variant="outlined">
              <MailOutlineOutlinedIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
                No invitations
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Caregivers can send you an invitation to link your accounts
              </Typography>
            </Paper>
          ) : (
            <>
              {/* Received Invitations (no secret — accept directly) */}
              {receivedInvitations.length > 0 && (
                <>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', px: 1 }}>
                    Invitations For You
                  </Typography>
                  {receivedInvitations.map((inv: any) => (
                    <Card key={inv.invitation_ref} variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                          <PersonAddAlt1Icon color="primary" sx={{ fontSize: 32 }} />
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                              Family Invitation
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Status: {inv.status} · Expires: {new Date(inv.expires_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={inv.status === 'expired' ? 'Expired' : inv.status}
                            color={inv.status === 'pending' ? 'warning' : inv.status === 'accepted' ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                          />
                        </Stack>
                      </CardContent>
                      {inv.status === 'pending' && (
                        <CardActions sx={{ px: 2, pb: 2 }}>
                          <Button
                            variant="contained"
                            color="primary"
                            size="small"
                            startIcon={<CheckCircleOutlinedIcon />}
                            onClick={() => handleAccept(inv.invitation_ref)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                          >
                            Accept
                          </Button>
                          <Button
                            variant="outlined"
                            color="inherit"
                            size="small"
                            startIcon={<DoDisturbIcon />}
                            onClick={() => handleDecline(inv.invitation_ref)}
                            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                          >
                            Decline
                          </Button>
                        </CardActions>
                      )}
                    </Card>
                  ))}
                </>
              )}

              {/* Sent Invitations (have secret — show share link + code) */}
              {sentInvitations.length > 0 && (
                <>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, color: 'text.secondary', px: 1, mt: 1 }}>
                    Invitations You Sent
                  </Typography>
                  {sentInvitations.map((inv: any) => (
                    <Card key={inv.invitation_ref} variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent>
                        <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                              Invitation to {inv.delivery_label ?? 'a family member'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Status: {inv.status} · Expires: {new Date(inv.expires_at).toLocaleDateString()}
                            </Typography>
                          </Box>
                          <Chip
                            size="small"
                            label={inv.status === 'expired' ? 'Expired' : inv.status}
                            color={inv.status === 'pending' ? 'warning' : inv.status === 'accepted' ? 'success' : 'default'}
                            variant="outlined"
                            sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                          />
                        </Stack>

                        {inv.status === 'pending' && inv.short_code && (
                          <Box sx={{ mt: 2, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            <Chip
                              size="small"
                              icon={<KeyIcon sx={{ fontSize: '0.85rem !important' }} />}
                              label={`Code: ${inv.short_code}`}
                              variant="outlined"
                              color="primary"
                              onClick={() => handleCopy(inv.short_code, 'Short code')}
                              sx={{ fontWeight: 700, cursor: 'pointer' }}
                            />
                            <Button
                              size="small"
                              variant="text"
                              startIcon={<ContentCopyIcon />}
                              onClick={() => {
                                const shareUrl = `${window.location.origin}/family/invitations/accept?secret=${inv.token}`;
                                void handleCopy(shareUrl, 'Invitation link');
                              }}
                              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
                            >
                              Copy share URL
                            </Button>
                            <Button
                              size="small"
                              variant="text"
                              color="error"
                              onClick={() => setConfirmAction({ type: 'revoke', ref: inv.invitation_ref, label: 'this invitation' })}
                              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600, ml: 'auto' }}
                            >
                              Revoke
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </>
              )}
            </>
          )}
        </Stack>
      )}

      {/* Tab 2: Active Practice Sessions */}
      {tabIndex === 2 && (
        <Stack spacing={2}>
          {sessionsLoading && <Alert severity="info">Loading practice sessions…</Alert>}
          {sessionsError && <Alert severity="error" action={<Button onClick={() => void refetchSessions()}>Retry</Button>}>Could not load practice sessions.</Alert>}
          {authorizedSessions.length === 0 ? (
            <Paper sx={{ p: 4, textAlign: 'center', borderRadius: 3 }} elevation={0} variant="outlined">
              <PlayArrowIcon sx={{ fontSize: 48, opacity: 0.3, mb: 1 }} />
              <Typography color="text.secondary" sx={{ fontWeight: 600 }}>
                No active practice sessions
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                Linked family members can start a session, or enter a session code below
              </Typography>
            </Paper>
          ) : (
            authorizedSessions.map((session: any) => (
              <Card key={session.session_ref} variant="outlined" sx={{ borderRadius: 3 }}>
                <CardContent>
                  <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
                    <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: 'primary.100', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <PlayArrowIcon color="primary" />
                    </Box>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {session.state === 'waiting_for_participants' ? 'Family invitation awaiting join' : `Session #${session.transcript_id}`}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {session.role === 'caregiver' && session.state === 'waiting_for_participants' ? 'Invitation awaiting your join code' : `Role: ${session.role} · State: ${session.state}`}
                      </Typography>
                    </Box>
                    <Chip size="small" label={session.state === 'waiting_for_participants' ? 'Awaiting join' : session.state} variant="outlined" sx={{ fontWeight: 700, textTransform: 'capitalize' }} />
                  </Stack>
                </CardContent>
                {session.state !== 'completed' && session.state !== 'expired' && session.state !== 'abandoned' && !(session.role === 'caregiver' && session.state === 'waiting_for_participants') && (
                  <CardActions sx={{ px: 2, pb: 2 }}>
                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<LaunchIcon />}
                      onClick={() => navigate(`/family/scenarios/${session.transcript_id}/sessions/${session.session_ref}`)}
                      sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                    >
                      Enter Session
                    </Button>
                  </CardActions>
                )}
              </Card>
            ))
          )}

          {/* Join by Code Section */}
          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3, mt: 1 }}>
            <Stack spacing={1.5}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <LoginIcon fontSize="small" color="primary" />
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                  Join a Session by Code
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                Enter the 6-character session code shared by the learner
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                <TextField
                  size="small"
                  placeholder="e.g. ABC123"
                  value={joinCode}
                  onChange={(e) => { setJoinCode(e.target.value.toUpperCase().slice(0, 8)); setJoinError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleJoinSession(); }}
                  error={!!joinError}
                  helperText={joinError}
                  sx={{ flexGrow: 1, '& .MuiOutlinedInput-root': { borderRadius: 2, fontFamily: 'monospace', fontWeight: 700, letterSpacing: 2 } }}
                />
                <Button
                  variant="contained"
                  onClick={() => void handleJoinSession()}
                  disabled={joining || joinCode.trim().length < 4}
                  sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700, px: 3, minHeight: 40 }}
                >
                  {joining ? 'Joining...' : 'Join'}
                </Button>
              </Box>
            </Stack>
          </Paper>
        </Stack>
      )}

      {/* Confirmation Dialog */}
      <Dialog open={!!confirmAction} onClose={() => setConfirmAction(null)} maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>
          {confirmAction?.type === 'revoke' ? 'Revoke Invitation?' :
           confirmAction?.type === 'block' ? 'Block Family Member?' : 'Unlink Family Member?'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {confirmAction?.type === 'revoke'
              ? `This will cancel the invitation to ${confirmAction?.label}. They will no longer be able to accept it.`
              : confirmAction?.type === 'block'
              ? `This will block ${confirmAction?.label} from accessing any active or future sessions. You can unblock them later.`
              : `This will remove your connection with ${confirmAction?.label}. You can re-link later with a new invitation.`}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setConfirmAction(null)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => {
              if (!confirmAction) return;
              if (confirmAction.type === 'revoke') void handleRevoke(confirmAction.ref);
              else void handleUpdateRelationship(confirmAction.ref, confirmAction.type === 'block' ? 'block' : 'unlink');
            }}
            sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
          >
            {confirmAction?.type === 'revoke' ? 'Revoke' : confirmAction?.type === 'block' ? 'Block' : 'Unlink'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar Feedback */}
      <Snackbar
        open={!!snackbarMsg}
        autoHideDuration={4000}
        onClose={() => setSnackbarMsg(null)}
        message={snackbarMsg}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Container>
    <InviteFamilyMemberModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />
    </FamilyAppShell>
  );
}
