import { Button, Stack } from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';

export interface ReviewDecisionControlsProps {
  disabled?: boolean;
  onDecision: (status: 'approved' | 'rejected') => void;
}

/** Shared by live and historical review so both surfaces use the same decision path. */
export function ReviewDecisionControls({ disabled = false, onDecision }: ReviewDecisionControlsProps) {
  return (
    <Stack direction="row" spacing={1}>
      <Button size="small" variant="contained" color="success" startIcon={<CheckIcon />} disabled={disabled} onClick={() => onDecision('approved')}>
        Approve
      </Button>
      <Button size="small" variant="outlined" color="error" startIcon={<CloseIcon />} disabled={disabled} onClick={() => onDecision('rejected')}>
        Reject
      </Button>
    </Stack>
  );
}
