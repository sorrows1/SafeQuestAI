import { Box, Chip, Paper, Typography } from "@mui/material";
import ForumIcon from "@mui/icons-material/Forum";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { ActorAvatar, ElementAttachment, ElementLinkPreview, ElementTimestamp, InspectableElement, SafeMediaPlaceholder } from "./SelectableMessage";
import { isCompleted, isSelected, type ScenarioSkinProps } from "./types";

export function ForumSkin({ scene, selection, onSelect, readOnly, testId }: ScenarioSkinProps) {
  const actors = new Map((scene.actors ?? []).map((actor) => [actor.actor_key, actor.display_name]));

  const firstElement = scene.elements[0];
  const appName = firstElement?.presentation.app_name || "LoopForum";
  const surfaceLabel = firstElement?.presentation.surface_label || "Community Discussion Thread";

  return (
    <Paper
      elevation={0}
      variant="outlined"
      aria-label="Forum scenario"
      data-testid={testId}
      sx={{
        maxWidth: 780,
        mx: "auto",
        my: 2,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        borderColor: "divider",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* LoopForum Header */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
          py: 2,
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
            background: "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(245, 158, 11, 0.3)",
          }}
        >
          <ForumIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", fontSize: "0.7rem", textTransform: "uppercase", letterSpacing: 0.5 }}>
            f/general &gt; {surfaceLabel}
          </Typography>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {appName}
          </Typography>
        </Box>
        <Chip label="Public Thread" size="small" variant="outlined" color="warning" sx={{ height: 22, fontWeight: 700 }} />
      </Box>

      {/* Forum Thread Content */}
      <Box sx={{ p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
        {scene.elements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No forum posts in this thread.</Typography>
          </Box>
        ) : (
          scene.elements.map((element, idx) => {
            const author = actors.get(element.actor_key ?? "") ?? element.presentation.display_label ?? "Forum Member";
            const isOP = idx === 0;

            return (
              <InspectableElement
                key={element.element_key}
                element={element}
                selected={isSelected(element, selection)}
                completed={isCompleted(element, selection)}
                onSelect={onSelect}
                readOnly={readOnly}
              >
                <Paper
                  variant="outlined"
                  sx={{
                    p: { xs: 2, sm: 2.5 },
                    borderRadius: 2.5,
                    bgcolor: isOP ? "action.hover" : "background.paper",
                    borderColor: isOP ? "warning.light" : "divider",
                    display: "flex",
                    gap: { xs: 1.5, sm: 2 },
                  }}
                >
                  {/* Vote Side Rail */}
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 0.5,
                      color: "text.secondary",
                      pt: 0.5,
                    }}
                  >
                    <ArrowUpwardIcon fontSize="small" sx={{ color: "warning.main" }} />
                    <Typography variant="caption" sx={{ fontWeight: 800 }}>
                      {isOP ? 42 : 12}
                    </Typography>
                    <ArrowDownwardIcon fontSize="small" />
                  </Box>

                  {/* Post Details */}
                  <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1, flexWrap: "wrap" }}>
                      <ActorAvatar label={author} />
                      <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                        {author}
                      </Typography>
                      {isOP && (
                        <Chip label="OP" size="small" color="warning" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 800 }} />
                      )}
                      <ElementTimestamp presentation={element.presentation} timestamp={element.timestamp} />
                    </Box>

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
                  </Box>
                </Paper>
              </InspectableElement>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
