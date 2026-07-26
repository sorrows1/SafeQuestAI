import { Box } from '@mui/material';
import { PublicHeader } from '@/components/public/PublicHeader';
import { HeroSection } from '@/components/public/HeroSection';
import { HowItWorksSection } from '@/components/public/HowItWorksSection';
import { ValuePropsSection } from '@/components/public/ValuePropsSection';
import { SafetyPrivacySection } from '@/components/public/SafetyPrivacySection';
import { GameplayPreviewSection } from '@/components/public/GameplayPreviewSection';
import { AccessibilityStatement } from '@/components/public/AccessibilityStatement';
import { PublicFooter } from '@/components/public/PublicFooter';

export function Landing() {
  return (
    <Box component="main" sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      <PublicHeader />
      <HeroSection />
      <HowItWorksSection />
      <ValuePropsSection />
      <SafetyPrivacySection />
      <GameplayPreviewSection />
      <AccessibilityStatement />
      <PublicFooter />
    </Box>
  );
}

