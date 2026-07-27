import type { PublishedFamilyScenario, RenderSkin } from '@/types';

export interface ScenarioCardViewModel {
  id: number;
  title: string;
  summary: string;
  categoryLabel: string;
  difficultyLabel: string;
  skin: RenderSkin;
  durationLabel: string;
  learningObjectives: string[];
  participationOptions: Array<'solo_with_companion' | 'family_invite' | 'join_family'>;
  lifecycle: 'not_started' | 'active' | 'completed';
  lifecycleLabel: string;
  lifecycleColor: 'default' | 'primary' | 'success';
  lifecycleIcon: string;
  lifecycleDescription: string;
  actionLabel: string;
  featuredActionLabel: string;
  contextSummary: string;
  hasActiveSession: boolean;
  hasCompletedSession: boolean;
  sessionRef: string | null;
}

const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

export function toScenarioCardViewModel(scenario: PublishedFamilyScenario): ScenarioCardViewModel {
  const lifecycle = scenario.lifecycle ?? 'not_started';
  const hasActiveSession = lifecycle === 'active';
  const hasCompletedSession = lifecycle === 'completed';

  let lifecycleLabel = 'Not Started';
  let lifecycleColor: 'default' | 'primary' | 'success' = 'default';
  let lifecycleIcon = 'play-circle';
  let lifecycleDescription = 'Ready to begin';
  let actionLabel = 'Start Scenario';
  let featuredActionLabel = 'Start Featured Activity';
  let contextSummary = 'New activity ready';

  if (hasActiveSession) {
    lifecycleLabel = 'In Progress';
    lifecycleColor = 'primary';
    lifecycleIcon = 'refresh-cw';
    lifecycleDescription = 'Resume your session';
    actionLabel = 'Continue Practice';
    featuredActionLabel = 'Continue Featured Activity';
    contextSummary = 'Active session in progress';
  } else if (hasCompletedSession) {
    lifecycleLabel = 'Completed';
    lifecycleColor = 'success';
    lifecycleIcon = 'check-circle';
    lifecycleDescription = 'See your results';
    actionLabel = 'Restart Fresh Attempt';
    featuredActionLabel = 'Restart Featured Activity';
    contextSummary = 'Completed activity';
  }

  return {
    id: scenario.id,
    title: scenario.title,
    summary: scenario.summary,
    categoryLabel: titleCase(scenario.category),
    difficultyLabel: `${scenario.difficulty} difficulty`,
    skin: scenario.render_skin,
    durationLabel: `About ${Math.max(5, Math.ceil(scenario.message_count * 0.75))} minutes`,
    learningObjectives: scenario.learning_objectives,
    participationOptions: ['solo_with_companion', 'family_invite', 'join_family'],
    lifecycle,
    lifecycleLabel,
    lifecycleColor,
    lifecycleIcon,
    lifecycleDescription,
    actionLabel,
    featuredActionLabel,
    contextSummary,
    hasActiveSession,
    hasCompletedSession,
    sessionRef: scenario.session_ref ?? null,
  };
}
