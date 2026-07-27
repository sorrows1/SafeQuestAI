import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Box,
  Typography,
  Button,
  Chip,
  Avatar,
  Card,
  CardContent,
  CardActions,
  Divider,
  IconButton,
  Tooltip,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  CircularProgress,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import PeopleIcon from '@mui/icons-material/People';
import MailOutlinedIcon from '@mui/icons-material/MailOutlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import CheckIcon from '@mui/icons-material/Check';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import BlockIcon from '@mui/icons-material/Block';
import ShieldOutlinedIcon from '@mui/icons-material/ShieldOutlined';
import LaunchIcon from '@mui/icons-material/Launch';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import {
  useGetFamilyRelationshipsQuery,
  useGetFamilyInvitationsQuery,
  useGetAuthorizedFamilySessionsQuery,
  useRevokeFamilyInvitationMutation,
  useUpdateFamilyRelationshipMutation,
} from '@/store/api';
import type { FamilyRelationship, FamilyRelationshipInvitation, FamilyAuthorizedSession } from '@/types';
import { FamilyTopBar } from '@/components/family/FamilyTopBar';
import { InviteFamilyMemberModal } from '@/components/family/InviteFamilyMemberModal';

export const CaregiverHub: React.FC = () => {
  const navigate = useNavigate();
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [tabValue, setTabValue] = useState(0);

  // Unlink / Block confirmation dialog state
  const [targetRelationship, setTargetRelationship] = useState<{ rel: FamilyRelationship; action: 'unlink' | 'block' } | null>(null);

  // Copy feedback state for short codes / links
  const [copiedCodeMap, setCopiedCodeMap] = useState<Record<string, boolean>>({});

  // RTK Query Hooks
  const { data: relationships, isLoading: isRelLoading } = useGetFamilyRelationshipsQuery();
  const { data: invitations, isLoading: isInvLoading } = useGetFamilyInvitationsQuery();
  const { data: authorizedSessions, isLoading: isSesLoading } = useGetAuthorizedFamilySessionsQuery();

  const [revokeInvitation, { isLoading: isRevoking }] = useRevokeFamilyInvitationMutation();
  const [updateRelationship, { isLoading: isUpdatingRel }] = useUpdateFamilyRelationshipMutation();

  const activeRelationships = relationships?.filter((r) => r.status === 'active') || [];
  const pendingInvitations = invitations?.filter((i) => i.status === 'pending') || [];

  const activeSessions = authorizedSessions?.filter((s) => s.state !== 'completed' && s.state !== 'abandoned' && s.state !== 'expired') || [];
  const reviewSessions = authorizedSessions?.filter((s) => s.state === 'completion_review' || s.state === 'completed') || [];

  const handleCopySecret = (ref: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeMap((prev) => ({ ...prev, [ref]: true }));
    setTimeout(() => {
      setCopiedCodeMap((prev) => ({ ...prev, [ref]: false }));
    }, 2500);
  };

  const handleRevokeInvitation = async (invitationRef: string) => {
    try {
      await revokeInvitation(invitationRef).unwrap();
    } catch {
      // Handled by RTK Query cache invalidation
    }
  };

  const handleConfirmRelationshipAction = async () => {
    if (!targetRelationship) return;
    try {
      await updateRelationship({
        relationship_ref: targetRelationship.rel.relationship_ref,
        action: targetRelationship.action,
      }).unwrap();
      setTargetRelationship(null);
    } catch {
      // Handled by RTK Query
    }
  };

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return 'N/A';
    try {
      return new Date(isoString).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <FamilyTopBar />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {/* Header Bar */}
        <Paper
          elevation={0}
          variant="outlined"
          sx={{
            p: 3.5,
            mb: 4,
            borderRadius: 3,
            bgcolor: 'background.paper',
            borderColor: 'divider',
            display: 'flex',
            flexDirection: { xs: 'column', sm: 'row' },
            alignItems: { xs: 'flex-start', sm: 'center' },
            justifyContent: 'space-between',
            gap: 2,
          }}
        >
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.01em' }}>
              Caregiver & Family Hub
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage family links, monitor practice sessions, and access joint discussion guides.
            </Typography>
          </Box>

          <Button
            variant="contained"
            size="large"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviteModalOpen(true)}
            sx={{
              borderRadius: 2.5,
              px: 3,
              py: 1.3,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              boxShadow: '0 4px 14px rgba(25, 118, 210, 0.3)',
              '&:hover': { transform: 'translateY(-1px)' },
              transition: 'transform 0.2s ease',
            }}
          >
            Invite Family Member
          </Button>
        </Paper>

        {/* Quick Metric Cards */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr', md: 'repeat(4, 1fr)' }, gap: 3, mb: 4 }}>
          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderColor: 'primary.main' },
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(25, 118, 210, 0.15)', color: 'primary.main', width: 52, height: 52 }}>
              <PeopleIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {activeRelationships.length}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Linked Family Members
              </Typography>
            </Box>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderColor: 'secondary.main' },
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(156, 39, 176, 0.15)', color: 'secondary.main', width: 52, height: 52 }}>
              <MailOutlinedIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {pendingInvitations.length}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Pending Invitations
              </Typography>
            </Box>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderColor: 'info.main' },
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(2, 136, 209, 0.15)', color: 'info.main', width: 52, height: 52 }}>
              <PlayCircleOutlinedIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {activeSessions.length}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Active Practice Sessions
              </Typography>
            </Box>
          </Paper>

          <Paper
            variant="outlined"
            sx={{
              p: 2.5,
              borderRadius: 3,
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              transition: 'all 0.2s ease',
              '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', borderColor: 'success.main' },
            }}
          >
            <Avatar sx={{ bgcolor: 'rgba(46, 125, 50, 0.15)', color: 'success.main', width: 52, height: 52 }}>
              <AssignmentTurnedInIcon />
            </Avatar>
            <Box>
              <Typography variant="h4" sx={{ fontWeight: 800 }}>
                {reviewSessions.length}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                Guides for Review
              </Typography>
            </Box>
          </Paper>
        </Box>

        {/* Tab Navigation */}
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
          <Tabs value={tabValue} onChange={(_, val) => setTabValue(val)} textColor="primary" indicatorColor="primary">
            <Tab label={`Family Members (${activeRelationships.length})`} id="hub-tab-0" />
            <Tab label={`Invitations (${pendingInvitations.length})`} id="hub-tab-1" />
            <Tab label={`Active Sessions (${activeSessions.length})`} id="hub-tab-2" />
            <Tab label={`Completed Discussions (${reviewSessions.length})`} id="hub-tab-3" />
          </Tabs>
        </Box>

        {/* TAB 0: Family Members & Relationships */}
        {tabValue === 0 && (
          <Box>
            <Alert severity="info" icon={<ShieldOutlinedIcon />} sx={{ mb: 3, borderRadius: 2 }}>
              Family relationships give caregivers access to joint scenario checkpoints and discussion guides without revealing private AI companion conversations or non-shared activity.
            </Alert>

            {isRelLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : relationships && relationships.length > 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                {relationships.map((rel) => (
                  <Card key={rel.relationship_ref} variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar src={rel.member_avatar_url || undefined} sx={{ width: 56, height: 56, bgcolor: 'primary.main', fontWeight: 'bold' }}>
                          {rel.member_display_name.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box sx={{ flexGrow: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="h6" sx={{ fontWeight: 'bold' }}>
                              {rel.member_display_name}
                            </Typography>
                            <Chip
                              label={rel.status === 'active' ? (rel.role === 'caregiver' ? 'Caregiver' : 'Learner') : rel.status.toUpperCase()}
                              color={rel.status === 'active' ? 'primary' : 'default'}
                              size="small"
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Connected on {formatDate(rel.accepted_at)}
                          </Typography>
                        </Box>
                      </Box>

                      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                        Role: <strong>{rel.role === 'caregiver' ? 'Caregiver (Observes & Reviews)' : 'Learner (Practices Scenarios)'}</strong>
                      </Typography>

                      {rel.status === 'active' && (
                        <Typography variant="caption" color="text.disabled" sx={{ display: 'block' }}>
                          Historical shared session guides remain available if unlinked.
                        </Typography>
                      )}
                    </CardContent>

                    {rel.status === 'active' && (
                      <>
                        <Divider />
                        <CardActions sx={{ justifyContent: 'flex-end', px: 2, py: 1.5 }}>
                          <Button
                            size="small"
                            color="inherit"
                            onClick={() => setTargetRelationship({ rel, action: 'unlink' })}
                          >
                            Unlink
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<BlockIcon />}
                            onClick={() => setTargetRelationship({ rel, action: 'block' })}
                          >
                            Block
                          </Button>
                        </CardActions>
                      </>
                    )}
                  </Card>
                ))}
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                <PeopleIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  No Linked Family Members
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 450, mx: 'auto', mb: 2 }}>
                  Invite a parent, guardian, or learner to connect accounts and practice digital safety scenarios together.
                </Typography>
                <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setInviteModalOpen(true)} sx={{ borderRadius: 2, mt: 1 }}>
                  Invite Family Member
                </Button>
              </Paper>
            )}
          </Box>
        )}

        {/* TAB 1: Invitations */}
        {tabValue === 1 && (
          <Box>
            {isInvLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : invitations && invitations.length > 0 ? (
              <Stack spacing={2}>
                {invitations.map((inv: FamilyRelationshipInvitation) => {
                  const shareUrl = inv.token ? `${window.location.origin}/family/invitations/accept?secret=${encodeURIComponent(inv.token)}` : '';
                  const isCopied = copiedCodeMap[inv.invitation_ref] || false;

                  return (
                    <Card key={inv.invitation_ref} variant="outlined" sx={{ borderRadius: 3 }}>
                      <CardContent sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: { sm: 'center' }, justifyContent: 'space-between', gap: 2 }}>
                        <Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                              {inv.delivery_label || 'Family Invitation'}
                            </Typography>
                            <Chip
                              label={inv.status.toUpperCase()}
                              size="small"
                              color={inv.status === 'pending' ? 'warning' : inv.status === 'accepted' ? 'success' : 'default'}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            Created: {formatDate(inv.created_at)} • Expires: {formatDate(inv.expires_at)}
                          </Typography>
                        </Box>

                        {inv.status === 'pending' && (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                            {inv.short_code && (
                              <Chip
                                label={`Code: ${inv.short_code}`}
                                variant="outlined"
                                color="primary"
                                onClick={() => handleCopySecret(inv.invitation_ref, inv.short_code || '')}
                                icon={isCopied ? <CheckIcon /> : <ContentCopyIcon />}
                                sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}
                              />
                            )}

                            {shareUrl && (
                              <Tooltip title={isCopied ? 'Link Copied!' : 'Copy Share Link'}>
                                <IconButton color="primary" onClick={() => handleCopySecret(inv.invitation_ref, shareUrl)}>
                                  {isCopied ? <CheckIcon /> : <ContentCopyIcon />}
                                </IconButton>
                              </Tooltip>
                            )}

                            <Button
                              size="small"
                              color="error"
                              startIcon={<CancelOutlinedIcon />}
                              disabled={isRevoking}
                              onClick={() => handleRevokeInvitation(inv.invitation_ref)}
                            >
                              Revoke
                            </Button>
                          </Box>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </Stack>
            ) : (
              <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                <MailOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  No Active Invitations
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Generate a share link or short code to invite family members.
                </Typography>
                <Button variant="contained" startIcon={<PersonAddIcon />} onClick={() => setInviteModalOpen(true)} sx={{ borderRadius: 2 }}>
                  Create Invitation
                </Button>
              </Paper>
            )}
          </Box>
        )}

        {/* TAB 2: Active Practice Sessions */}
        {tabValue === 2 && (
          <Box>
            {isSesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : activeSessions.length > 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                {activeSessions.map((session: FamilyAuthorizedSession) => (
                  <Card key={session.session_ref} variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          Scenario #{session.transcript_id}
                        </Typography>
                        <Chip label={session.state.replace(/_/g, ' ')} size="small" color="info" />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                        Role: <strong>{session.role}</strong> • Started: {formatDate(session.started_at)}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 2 }}>
                      <Button
                        variant="contained"
                        fullWidth
                        startIcon={<LaunchIcon />}
                        onClick={() => navigate(`/family/scenarios/${session.transcript_id}/sessions/${session.session_ref}`)}
                        sx={{ borderRadius: 2 }}
                      >
                        Enter Session
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                <PlayCircleOutlinedIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  No Active Sessions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Start a practice scenario from the Scenario Library.
                </Typography>
                <Button variant="contained" onClick={() => navigate('/family/scenarios')} sx={{ borderRadius: 2 }}>
                  Browse Scenario Library
                </Button>
              </Paper>
            )}
          </Box>
        )}

        {/* TAB 3: Completed Discussions & Guides */}
        {tabValue === 3 && (
          <Box>
            {isSesLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                <CircularProgress />
              </Box>
            ) : reviewSessions.length > 0 ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
                {reviewSessions.map((session: FamilyAuthorizedSession) => (
                  <Card key={session.session_ref} variant="outlined" sx={{ borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 'bold' }}>
                          Scenario #{session.transcript_id} Guide
                        </Typography>
                        <Chip label={session.state === 'completed' ? 'Completed' : 'Review Ready'} color="success" size="small" />
                      </Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Completed: {formatDate(session.completed_at || session.started_at)}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions sx={{ p: 2 }}>
                      <Button
                        variant="outlined"
                        fullWidth
                        startIcon={<AssignmentTurnedInIcon />}
                        onClick={() => navigate(`/family/scenarios/${session.transcript_id}/sessions/${session.session_ref}`)}
                        sx={{ borderRadius: 2 }}
                      >
                        View Discussion Guide
                      </Button>
                    </CardActions>
                  </Card>
                ))}
              </Box>
            ) : (
              <Paper variant="outlined" sx={{ p: 6, textAlign: 'center', borderRadius: 3 }}>
                <AssignmentTurnedInIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" sx={{ fontWeight: 'bold', mb: 1 }}>
                  No Discussion Guides Yet
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Complete a practice scenario with your family member to generate joint discussion prompts.
                </Typography>
              </Paper>
            )}
          </Box>
        )}
      </Container>

      {/* Invite Family Member Modal */}
      <InviteFamilyMemberModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />

      {/* Unlink / Block Confirmation Dialog */}
      <Dialog
        open={Boolean(targetRelationship)}
        onClose={() => setTargetRelationship(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { style: { borderRadius: 16 } } }}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <InfoOutlinedIcon color={targetRelationship?.action === 'block' ? 'error' : 'warning'} />
          <Typography variant="h6" component="span" sx={{ fontWeight: 'bold' }}>
            {targetRelationship?.action === 'block' ? 'Block Family Member?' : 'Unlink Family Member?'}
          </Typography>
        </DialogTitle>
        <DialogContent>
          <DialogContentText color="text.secondary">
            {targetRelationship?.action === 'block'
              ? `Blocking ${targetRelationship.rel.member_display_name} will end active sharing and prevent them from sending future family invitations to your account.`
              : `Unlinking ${targetRelationship?.rel.member_display_name} will stop active session notifications. Historical completed conversation guides will remain accessible.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 3 }}>
          <Button onClick={() => setTargetRelationship(null)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmRelationshipAction}
            color={targetRelationship?.action === 'block' ? 'error' : 'warning'}
            variant="contained"
            disabled={isUpdatingRel}
            sx={{ borderRadius: 2, px: 3 }}
          >
            {isUpdatingRel ? 'Updating…' : targetRelationship?.action === 'block' ? 'Block' : 'Unlink'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};
