export interface LandingSectionViewModel {
  id: 'how-it-works' | 'players' | 'caregivers' | 'safety-privacy' | 'accessibility';
  heading: string;
  description: string;
}

export const landingSections: LandingSectionViewModel[] = [
  { id: 'how-it-works', heading: 'How it works', description: 'Choose a reviewed scenario, talk through the moment, and practice asking for help.' },
  { id: 'players', heading: 'For players', description: 'A transparent companion supports discussion without grades or leaderboards.' },
  { id: 'caregivers', heading: 'For caregivers', description: 'Reviewed moments make calm family conversations easier to begin.' },
  { id: 'safety-privacy', heading: 'Safety and privacy', description: 'Safe Quest uses curated learning materials instead of live chats with strangers.' },
  { id: 'accessibility', heading: 'Accessibility', description: 'Theme, keyboard, and motion preferences are respected across the app.' },
];
