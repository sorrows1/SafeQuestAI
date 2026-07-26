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
}

const titleCase = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
export function toScenarioCardViewModel(scenario: PublishedFamilyScenario): ScenarioCardViewModel {
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
  };
}
