import { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { useCreateFamilySessionMutation, useGetFamilyScenariosQuery } from '@/store/api';
import type { PublishedFamilyScenario } from '@/types';
export function FamilyScenarioLobby() {
  const navigate = useNavigate();
  const { data: scenarios = [], isLoading, isError } = useGetFamilyScenariosQuery();
  const [selected, setSelected] = useState<PublishedFamilyScenario | null>(null);
  const [detectiveMode, setDetectiveMode] = useState(false);
  const [parentUserId, setParentUserId] = useState('');
  const [createSession, { isLoading: creating, error }] = useCreateFamilySessionMutation();
  const start = async () => {
    if (!selected) return;
    const session = await createSession({
      transcriptId: selected.id,
      detective_mode: detectiveMode,
      ...(parentUserId ? { parent_user_id: Number(parentUserId) } : {}),
    }).unwrap();
    navigate(`/family/scenarios/${selected.id}/sessions/${session.id}`, { state: { session } });
  };
  if (isLoading)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  if (isError) return <Alert severity="error">Published family scenarios could not be loaded.</Alert>;
  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: { xs: 2, sm: 4 } }}>
      <Typography variant="h3">Practice talking it through</Typography>
      <Typography color="text.secondary" sx={{ mt: 1, mb: 3 }}>
        Choose a curated scenario. This is for discussion and support, not a test.
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 2,
        }}
      >
        {scenarios.map((scenario) => (
          <Card key={scenario.id} variant="outlined">
            <CardContent>
              <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                {scenario.category.replace('_', ' ')}
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                <Chip size="small" label={scenario.render_skin.replace('_', ' ')} />
                <Chip size="small" label={scenario.difficulty} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                {scenario.message_count} messages
              </Typography>
            </CardContent>
            <CardActions>
              <Button
                onClick={() => {
                  setSelected(scenario);
                  setDetectiveMode(false);
                  setParentUserId('');
                }}
              >
                Start together
              </Button>
            </CardActions>
          </Card>
        ))}
      </Box>
      <Dialog open={Boolean(selected)} onClose={() => !creating && setSelected(null)} fullWidth maxWidth="sm">
        <DialogTitle>Set up this discussion</DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2 }}>
            Leave the parent ID empty to use the solo companion flow. Enter the ID from the trusted family-linking flow when a parent is
            joining.
          </Typography>
          <TextField
            label="Linked parent account ID (optional)"
            value={parentUserId}
            onChange={(event) => setParentUserId(event.target.value.replace(/[^0-9]/g, ''))}
            inputMode="numeric"
            fullWidth
          />
          <FormControlLabel
            control={<Switch checked={detectiveMode} onChange={(event) => setDetectiveMode(event.target.checked)} />}
            label="Detective mode: highlight messages you want to discuss"
          />
          <Typography variant="body2" color="text.secondary">
            Detective mode helps identify content to talk about; it never creates a score.
          </Typography>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              The session could not be started. Check the linked parent ID and try again.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)} disabled={creating}>
            Cancel
          </Button>
          <Button onClick={start} variant="contained" disabled={creating || (parentUserId !== '' && !Number(parentUserId))}>
            Begin
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
