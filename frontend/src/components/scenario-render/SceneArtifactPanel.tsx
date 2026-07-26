import { Box, Button, Chip, Divider, Drawer, Stack, Typography } from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { FamilyScene, SceneElement } from "@/types";
import { InspectableElement } from "./SelectableMessage";
import type { ScenePanelNavigation, SceneSelection } from "./types";

interface SceneArtifactPanelProps {
  scene: FamilyScene;
  selection: SceneSelection;
  onSelect: (elementKey: string) => void;
  navigation: ScenePanelNavigation;
}

const panelElementTypes = new Set([
  "profile", "game_profile", "attachment", "link_preview", "site_section",
  "listing", "forum_thread",
]);

export function panelTargetFor(scene: FamilyScene, elementKey: string): string | null {
  const element = scene.elements.find((item) => item.element_key === elementKey);
  if (!element) return null;
  if (panelElementTypes.has(element.element_type) || element.presentation.panel_kind) return element.element_key;
  return element.relationships?.find((relationship) => {
    const target = scene.elements.find((item) => item.element_key === relationship.target_element_key);
    return Boolean(target && (panelElementTypes.has(target.element_type) || target.presentation.panel_kind));
  })?.target_element_key ?? null;
}

function relatedElements(scene: FamilyScene, root: SceneElement): SceneElement[] {
  const keys = new Set([root.element_key]);
  for (const element of scene.elements) {
    if (element.parent_element_key === root.element_key) keys.add(element.element_key);
  }
  for (const relationship of root.relationships ?? []) keys.add(relationship.target_element_key);
  return scene.elements.filter((element) => keys.has(element.element_key));
}

/**
 * A contained, controller-owned detail surface. It never follows href values
 * or loads media: links are practice artifacts and keep their stable keys.
 */
export function SceneArtifactPanel({ scene, selection, onSelect, navigation }: SceneArtifactPanelProps) {
  const root = navigation.activeElementKey
    ? scene.elements.find((element) => element.element_key === navigation.activeElementKey)
    : undefined;
  const elements = root ? relatedElements(scene, root) : [];
  if (!root) return null;

  return (
    <Drawer
      anchor="right"
      open={Boolean(root)}
      onClose={navigation.closePanel}
      slotProps={{ paper: { sx: { width: { xs: "100%", sm: 420 }, p: 2.5 } } }}
    >
      <Box role="region" aria-label="Scene detail panel" data-testid="scene-detail-panel">
        <Stack direction="row" spacing={1} sx={{ mb: 2, alignItems: "center" }}>
          {navigation.canGoBack && (
            <Button size="small" startIcon={<ArrowBackIcon />} onClick={navigation.goBack}>Back</Button>
          )}
          <Button size="small" sx={{ ml: "auto" }} startIcon={<CloseIcon />} onClick={navigation.closePanel}>Close</Button>
        </Stack>
        <Typography variant="overline" color="text.secondary">Contained scenario detail</Typography>
        <Typography variant="h6" sx={{ fontWeight: 800, mb: 0.5 }}>
          {root.presentation.display_label ?? root.accessible_label}
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          This practice panel stays inside SafeQuest. External links and media do not open here.
        </Typography>
        <Divider sx={{ mb: 2 }} />
        <Stack spacing={1.5}>
          {elements.map((element) => (
            <InspectableElement
              key={element.element_key}
              element={element}
              selected={selection.selectedElementKeys.includes(element.element_key)}
              onSelect={onSelect}
            >
              <Box sx={{ p: 1.75, border: "1px solid", borderColor: "divider", borderRadius: 2.5, bgcolor: "background.paper" }}>
                <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{element.accessible_label}</Typography>
                {element.content && <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", mt: 0.5, color: "text.primary" }}>{element.content}</Typography>}
                
                <Box sx={{ display: "flex", gap: 0.75, mt: 1, flexWrap: "wrap" }}>
                  {element.presentation.profile_handle && (
                    <Chip size="small" label={element.presentation.profile_handle} color="primary" variant="outlined" sx={{ fontWeight: 700 }} />
                  )}
                  {element.presentation.account_age_label && (
                    <Chip size="small" label={element.presentation.account_age_label} sx={{ fontSize: "0.675rem" }} />
                  )}
                  {element.presentation.audience_label && (
                    <Chip size="small" label={`Audience: ${element.presentation.audience_label}`} color="secondary" variant="outlined" sx={{ fontWeight: 600 }} />
                  )}
                  {element.presentation.location_label && (
                    <Chip size="small" label={`Location: ${element.presentation.location_label}`} sx={{ fontSize: "0.675rem" }} />
                  )}
                  {element.presentation.trade_link_label && (
                    <Chip size="small" label={element.presentation.trade_link_label} color="warning" variant="outlined" sx={{ fontWeight: 600 }} />
                  )}
                  {(element.presentation.badges ?? []).map((badge) => (
                    <Chip key={badge} size="small" label={badge} color="info" sx={{ fontWeight: 700, fontSize: "0.65rem" }} />
                  ))}
                  {(element.presentation.stats ?? []).map((stat) => (
                    <Chip key={stat} size="small" label={stat} variant="outlined" sx={{ fontSize: "0.65rem" }} />
                  ))}
                </Box>

                {element.presentation.href && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1.25, display: "block" }}>
                    <OpenInNewIcon sx={{ fontSize: 13, verticalAlign: "text-bottom", mr: 0.5 }} /> Inert practice-site destination: {element.presentation.href}
                  </Typography>
                )}
              </Box>
            </InspectableElement>
          ))}
        </Stack>
      </Box>
    </Drawer>
  );
}
