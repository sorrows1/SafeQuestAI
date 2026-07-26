import { Box, Chip, Divider, Paper, Typography } from "@mui/material";
import DynamicFeedIcon from "@mui/icons-material/DynamicFeed";
import FavoriteBorderIcon from "@mui/icons-material/FavoriteBorder";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import ShareOutlinedIcon from "@mui/icons-material/ShareOutlined";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import PublicIcon from "@mui/icons-material/Public";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ScheduleIcon from "@mui/icons-material/Schedule";
import { ActorAvatar, ElementAttachment, ElementLinkPreview, ElementTimestamp, InspectableElement, SafeMediaPlaceholder } from "./SelectableMessage";
import { isSelected, type ScenarioSkinProps } from "./types";
import { panelTargetFor } from "./SceneArtifactPanel";

export function SocialFeedSkin({ scene, selection, onSelect, readOnly, panelNavigation, testId }: ScenarioSkinProps) {
  const actors = new Map((scene.actors ?? []).map((actor) => [actor.actor_key, actor.display_name]));

  const firstElement = scene.elements[0];
  const appName = firstElement?.presentation.app_name || "Dayline";

  const handleElementSelect = (elementKey: string) => {
    onSelect(elementKey);
    if (panelNavigation) {
      const target = panelTargetFor(scene, elementKey);
      if (target) panelNavigation.openPanel(target);
    }
  };

  return (
    <Paper
      elevation={0}
      variant="outlined"
      aria-label="Social feed scenario"
      data-testid={testId}
      sx={{
        maxWidth: 680,
        mx: "auto",
        my: 2,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        borderColor: "divider",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* Dayline Header Bar */}
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          bgcolor: "background.default",
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 40,
            height: 40,
            borderRadius: 2.5,
            background: "linear-gradient(135deg, #EC4899 0%, #D946EF 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(236, 72, 153, 0.3)",
          }}
        >
          <DynamicFeedIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {appName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Social Media Feed & Timeline
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Chip label="Timeline" size="small" color="secondary" sx={{ fontWeight: 700, height: 22 }} />
          <Chip label="Explore" size="small" variant="outlined" sx={{ fontWeight: 600, height: 22, display: { xs: "none", sm: "inline-flex" } }} />
        </Box>
      </Box>

      {/* Feed Cards Container */}
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 2 }}>
        {scene.elements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No social feed posts to display.</Typography>
          </Box>
        ) : (
          scene.elements.map((element) => {
            const label = actors.get(element.actor_key ?? "") ?? element.presentation.display_label ?? "Scenario participant";
            const isComment = element.element_type === "comment";
            const audience = element.presentation.audience_label;
            const location = element.presentation.location_label;
            const routine = element.presentation.routine_label;

            return (
              <InspectableElement
                key={element.element_key}
                element={element}
                selected={isSelected(element, selection)}
                onSelect={handleElementSelect}
                readOnly={readOnly}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2.25,
                    borderRadius: 2.5,
                    bgcolor: isComment ? "action.hover" : "background.paper",
                    borderColor: "divider",
                    ml: isComment ? { xs: 2, sm: 4 } : 0,
                    borderLeft: isComment ? "3px solid" : "1px solid",
                    borderLeftColor: isComment ? "secondary.main" : "divider",
                    boxShadow: isComment ? "none" : "0 2px 8px rgba(0,0,0,0.02)",
                  }}
                >
                  {/* Post Author Header */}
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5 }}>
                    <ActorAvatar label={label} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {label}
                        </Typography>
                        {isComment ? (
                          <Chip label="Comment" size="small" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
                        ) : audience ? (
                          <Chip
                            icon={<PublicIcon sx={{ fontSize: "11px !important" }} />}
                            label={audience}
                            size="small"
                            color="secondary"
                            variant="outlined"
                            sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }}
                          />
                        ) : null}
                      </Box>
                      <ElementTimestamp presentation={element.presentation} timestamp={element.timestamp} />
                    </Box>
                  </Box>

                  {/* Metadata Chips (Location/Routine) */}
                  {(location || routine) && (
                    <Box sx={{ display: "flex", gap: 1, mb: 1.25, flexWrap: "wrap" }}>
                      {location && (
                        <Chip
                          icon={<LocationOnIcon sx={{ fontSize: "12px !important" }} />}
                          label={location}
                          size="small"
                          sx={{ height: 20, fontSize: "0.675rem", bgcolor: "action.selected", fontWeight: 600 }}
                        />
                      )}
                      {routine && (
                        <Chip
                          icon={<ScheduleIcon sx={{ fontSize: "12px !important" }} />}
                          label={routine}
                          size="small"
                          sx={{ height: 20, fontSize: "0.675rem", bgcolor: "action.selected", fontWeight: 600 }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Post Body Content */}
                  {element.element_type === "attachment" ? (
                    <ElementAttachment label={element.presentation.display_label} />
                  ) : element.element_type === "link_preview" ? (
                    <ElementLinkPreview label={element.presentation.display_label} />
                  ) : element.presentation.local_media_id ? (
                    <SafeMediaPlaceholder altText={element.presentation.alt_text} />
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.6, color: "text.primary" }}>
                      {element.content}
                    </Typography>
                  )}

                  {/* Post Social Interaction Bar (Inert Visuals) */}
                  {!isComment && (
                    <>
                      <Divider sx={{ my: 1.5 }} />
                      <Box sx={{ display: "flex", justifyContent: "space-between", color: "text.secondary", px: 0.5 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, cursor: "default" }}>
                          <FavoriteBorderIcon fontSize="small" />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>Like</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, cursor: "default" }}>
                          <ChatBubbleOutlineOutlinedIcon fontSize="small" />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>Reply</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, cursor: "default" }}>
                          <ShareOutlinedIcon fontSize="small" />
                          <Typography variant="caption" sx={{ fontWeight: 600 }}>Share</Typography>
                        </Box>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, cursor: "default" }}>
                          <BookmarkBorderIcon fontSize="small" />
                        </Box>
                      </Box>
                    </>
                  )}
                </Paper>
              </InspectableElement>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
