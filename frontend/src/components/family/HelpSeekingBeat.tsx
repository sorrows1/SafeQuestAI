import { Button, Link, Paper, Typography } from '@mui/material';
const resources: Record<string, { label: string; href: string }> = {
  cyberbullying: { label: 'StopBullying.gov', href: 'https://www.stopbullying.gov/' },
  scam: { label: 'FTC ReportFraud', href: 'https://reportfraud.ftc.gov/' },
  grooming: { label: 'NCMEC CyberTipline', href: 'https://www.missingkids.org/gethelpnow/cybertipline' },
  image_request: { label: 'NCMEC CyberTipline', href: 'https://www.missingkids.org/gethelpnow/cybertipline' },
  oversharing: { label: 'NCMEC CyberTipline', href: 'https://www.missingkids.org/gethelpnow/cybertipline' },
};
export function HelpSeekingBeat({ category, onContinue }: { category: string; onContinue: () => void }) {
  const resource = resources[category] ?? resources.oversharing;
  return (
    <Paper component="section" aria-label="Who you could tell" sx={{ maxWidth: 720, mx: 'auto', mt: 4, p: 4, textAlign: 'center' }}>
      <Typography variant="h4">If this happened for real, who could you tell?</Typography>
      <Typography sx={{ mt: 2 }}>
        A trusted adult—such as a parent, caregiver, teacher, counselor, or coach—can help you decide what to do next.
      </Typography>
      <Typography sx={{ mt: 2 }}>
        You can also find help from{' '}
        <Link href={resource.href} target="_blank" rel="noreferrer">
          {resource.label}
        </Link>
        .
      </Typography>
      <Button variant="contained" onClick={onContinue} sx={{ mt: 3 }}>
        Open our conversation guide
      </Button>
    </Paper>
  );
}
