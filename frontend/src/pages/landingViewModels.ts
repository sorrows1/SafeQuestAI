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


export interface LandingLearningStepViewModel {
  id: 'inspect' | 'explain' | 'companion' | 'checkpoint' | 'progress' | 'review';
  title: string;
  description: string;
}

// Static product-copy fixtures only: no catalog data, annotations, tactic tags,
// or implied right answers are exposed to unauthenticated visitors.
export const landingLearningSteps: LandingLearningStepViewModel[] = [
  { id: 'inspect', title: 'Inspect the moment', description: 'Explore a reviewed fictional moment in a familiar communication format.' },
  { id: 'explain', title: 'Explain your thinking', description: 'Put your own words to what stands out and why.' },
  { id: 'companion', title: 'Ask the companion', description: 'Use a transparent, private guide to think through the situation.' },
  { id: 'checkpoint', title: 'Pause at a checkpoint', description: 'Make space for a calm conversation instead of rushing to an answer.' },
  { id: 'progress', title: 'Continue the discussion', description: 'Move through the scenario at a comfortable pace, with no scores.' },
  { id: 'review', title: 'Review together', description: 'Return to the conversation with a supportive family discussion guide.' },
];
