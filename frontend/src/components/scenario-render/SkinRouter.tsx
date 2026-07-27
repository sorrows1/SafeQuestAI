import { useEffect } from "react";
import { Box, Paper, Typography } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import type { ElementType, PresentationToken, RenderSkin, SceneElement } from "@/types";
import { ChatSkin } from "./ChatSkin";
import { EmailSkin } from "./EmailSkin";
import { SocialFeedSkin } from "./SocialFeedSkin";
import { GameChatSkin } from "./GameChatSkin";
import { ForumSkin } from "./ForumSkin";
import { MarketplaceSkin } from "./MarketplaceSkin";
import { InspectableElement } from "./SelectableMessage";
import type { ScenarioSkinProps, SkinRouterProps } from "./types";
import { recordClientTelemetry } from "@/telemetry";

export interface SkinCapability {
  id: RenderSkin;
  version: string;
  supportedElementTypes: readonly ElementType[];
  fallbackSkin: "generic";
  responsiveModes: readonly ("default" | "compact")[];
  previewFixture: string;
  validate: (props: ScenarioSkinProps) => boolean;
  Renderer: React.ComponentType<ScenarioSkinProps>;
}

const common: ElementType[] = ["conversation", "message", "profile", "profile_field", "attachment", "link_preview", "system_event", "action"];
const ELEMENT_KEY = new RegExp("^[a-zA-Z0-9_-]{1,255}" + String.fromCharCode(36));
const MAX_PRESENTATION_VALUES: Partial<Record<keyof PresentationToken, number>> = {
  display_label: 160, timestamp_label: 100, alt_text: 500, app_name: 80, surface_label: 120,
  channel_name: 120, member_summary: 240, presence_summary: 160, sender_address: 254,
  recipient_summary: 254, subject: 240, security_notice: 300, audience_label: 120,
  location_label: 160, routine_label: 160, profile_handle: 100, account_age_label: 120,
  trade_link_label: 160, bio: 500,
};

function hasSafePresentation(element: SceneElement): boolean {
  const { href, badges = [], stats = [] } = element.presentation;
  if (href && (!href.startsWith("/") || href.startsWith("//"))) return false;
  if (![...badges, ...stats].every((value) => Boolean(value.trim()) && value.length <= 160)) return false;
  return Object.entries(MAX_PRESENTATION_VALUES).every(([key, max]) => {
    const value = element.presentation[key as keyof PresentationToken];
    return value == null || typeof value !== "string" || value.length <= max!;
  });
}

/** Runtime guard for previews and API payloads before a skin reads presentation data. */
export function hasSafeSceneContract({ scene }: ScenarioSkinProps): boolean {
  const keys = new Set<string>();
  return scene.elements.every((element) => {
    if (!ELEMENT_KEY.test(element.element_key) || keys.has(element.element_key)) return false;
    keys.add(element.element_key);
    return hasSafePresentation(element);
  });
}
const capability = (id: RenderSkin, supportedElementTypes: ElementType[], previewFixture: string, Renderer: React.ComponentType<ScenarioSkinProps>): SkinCapability => ({
  id, version: "1.0", supportedElementTypes, fallbackSkin: "generic", responsiveModes: ["default", "compact"], previewFixture, Renderer,
  validate: (props) => props.scene.scene_schema_version === 1 && props.scene.skin_version === "1.0" && hasSafeSceneContract(props) && props.scene.elements.every((element) => supportedElementTypes.includes(element.element_type)),
});

/** Single registry consumed by the player and future admin/fixture previews. */
export const skinRegistry: Record<RenderSkin, SkinCapability> = {
  chat: capability("chat", common, "gaming_chat_boundary_pressure_demo", ChatSkin),
  email: capability("email", [...common, "email", "email_thread", "email_message", "email_header"], "email_thread_preview", EmailSkin),
  social_feed: capability("social_feed", [...common, "feed", "post", "comment"], "pause_before_posting_demo", SocialFeedSkin),
  game_chat: capability("game_chat", [...common, "game_profile", "game_stat", "game_badge", "server", "channel", "member"], "game_chat_preview", GameChatSkin),
  forum: capability("forum", [...common, "forum_thread", "forum_post", "comment", "site_section"], "forum_preview", ForumSkin),
  marketplace: capability("marketplace", [...common, "listing", "seller", "price", "listing_field"], "marketplace_preview", MarketplaceSkin),
};

export function GenericFallbackSkin({ scene, selection, onSelect, readOnly, testId }: ScenarioSkinProps) {
  return (
    <Box role="region" aria-label="Generic scenario view" data-testid={testId} sx={{ maxWidth: 760, mx: "auto", py: 2 }}>
      <Paper
        elevation={0}
        variant="outlined"
        sx={{
          p: 2,
          mb: 2,
          borderRadius: 2,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          borderColor: "divider",
        }}
      >
        <SecurityIcon color="primary" />
        <Box>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
            Standard Scenario Display
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Rendering scenario content using accessible default presentation primitives.
          </Typography>
        </Box>
      </Paper>

      {scene.elements.map((element) => (
        <InspectableElement
          key={element.element_key}
          element={element}
          selected={selection.selectedElementKeys.includes(element.element_key)}
          completed={selection.completedElementKeys?.includes(element.element_key)}
          onSelect={onSelect}
          readOnly={readOnly}
        >
          <Paper variant="outlined" sx={{ p: 2, mb: 1.5, borderRadius: 2 }}>
            <Typography variant="subtitle2" color="primary.main" sx={{ mb: 0.5, fontWeight: 700 }}>
              {element.accessible_label}
            </Typography>
            {element.content && (
              <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {element.content}
              </Typography>
            )}
          </Paper>
        </InspectableElement>
      ))}
    </Box>
  );
}

export function SkinRouter({ renderSkin, ...props }: SkinRouterProps) {
  const id = renderSkin ?? props.scene.render_skin;
  const capability = skinRegistry[id];
  const usesFallback = !capability || !capability.validate(props);
  useEffect(() => {
    if (usesFallback) recordClientTelemetry("skin.fallback", { source: "skin_router" });
  }, [usesFallback]);
  if (usesFallback) return <GenericFallbackSkin {...props} />;
  const Renderer = capability.Renderer;
  return <Renderer {...props} />;
}
