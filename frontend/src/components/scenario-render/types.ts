import type { FamilyMessage, RenderSkin } from '@/types';
export interface ScenarioSkinProps {
  messages: FamilyMessage[];
  detectiveMode: boolean;
  highlightedMessageIds: number[];
  onToggleMessage: (messageId: number) => void;
}
export interface SkinRouterProps extends ScenarioSkinProps {
  renderSkin: RenderSkin;
}
