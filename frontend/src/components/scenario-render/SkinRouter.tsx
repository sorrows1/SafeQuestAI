import { Box, Paper, Typography } from "@mui/material";
import SecurityIcon from "@mui/icons-material/Security";
import type { ElementType, RenderSkin } from "@/types";
import { ChatSkin } from "./ChatSkin";
import { EmailSkin } from "./EmailSkin";
import { SocialFeedSkin } from "./SocialFeedSkin";
import { GameChatSkin } from "./GameChatSkin";
import { ForumSkin } from "./ForumSkin";
import { MarketplaceSkin } from "./MarketplaceSkin";
import { InspectableElement } from "./SelectableMessage";
import type { ScenarioSkinProps, SkinRouterProps } from "./types";

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
const capability = (id: RenderSkin, supportedElementTypes: ElementType[], previewFixture: string, Renderer: React.ComponentType<ScenarioSkinProps>): SkinCapability => ({
  id, version: "1.0", supportedElementTypes, fallbackSkin: "generic", responsiveModes: ["default", "compact"], previewFixture, Renderer,
  validate: ({ scene }) => scene.scene_schema_version === 1 && scene.skin_version === "1.0" && scene.elements.every((element) => supportedElementTypes.includes(element.element_type)),
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
  if (!capability || !capability.validate(props)) return <GenericFallbackSkin {...props} />;
  const Renderer = capability.Renderer;
  return <Renderer {...props} />;
}
