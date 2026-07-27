import type { FamilyScene, FamilySessionCapabilities, RenderSkin, SceneElement } from "@/types";

export interface SceneSelection {
  selectedElementKeys: readonly string[];
  /** Elements whose discussion has been completed by the session controller. */
  completedElementKeys?: readonly string[];
}

export interface ScenePanelNavigation {
  activeElementKey: string | null;
  canGoBack: boolean;
  openPanel: (elementKey: string) => void;
  closePanel: () => void;
  goBack: () => void;
}

export interface ScenarioSkinProps {
  scene: FamilyScene;
  selection: SceneSelection;
  onSelect: (elementKey: string) => void;
  capabilities?: Pick<FamilySessionCapabilities, "can_request_hint" | "can_submit_flag_attempt">;
  readOnly?: boolean;
  /** Controller-owned, non-persistent detail-panel navigation. */
  panelNavigation?: ScenePanelNavigation;
  testId?: string;
}

export interface SkinRouterProps extends ScenarioSkinProps {
  renderSkin?: RenderSkin;
}

export function isSelected(element: SceneElement, selection: SceneSelection): boolean {
  return selection.selectedElementKeys.includes(element.element_key);
}

export function isCompleted(element: SceneElement, selection: SceneSelection): boolean {
  return selection.completedElementKeys?.includes(element.element_key) ?? false;
}
