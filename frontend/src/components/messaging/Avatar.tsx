import { memo, useMemo } from 'react';
import { Avatar as MuiAvatar } from '@mui/material';
import PersonOutlineIcon from '@mui/icons-material/Person';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';

export interface AvatarProps {
  speakerLabel: string;
  role?: 'initiator' | 'respondent';
}

/** Stable role-based avatar; it deliberately has no random or render-count input. */
export const Avatar = memo(function Avatar({ speakerLabel, role }: AvatarProps) {
  const avatar = useMemo(() => {
    const normalizedRole = role ?? (speakerLabel.toLowerCase().includes('initiator') ? 'initiator' : 'respondent');
    return normalizedRole === 'initiator'
      ? { icon: <SmartToyOutlinedIcon fontSize="small" />, color: 'secondary.main' }
      : { icon: <PersonOutlineIcon fontSize="small" />, color: 'primary.main' };
  }, [role, speakerLabel]);

  return (
    <MuiAvatar role="img" aria-label={speakerLabel} sx={{ width: 32, height: 32, bgcolor: avatar.color }}>
      {avatar.icon}
    </MuiAvatar>
  );
});
