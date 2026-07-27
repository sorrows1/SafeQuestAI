import { Box, Chip, Paper, Typography } from "@mui/material";
import SportsEsportsIcon from "@mui/icons-material/SportsEsports";
import TagIcon from "@mui/icons-material/Tag";
import ShieldIcon from "@mui/icons-material/Shield";
import { ActorAvatar, ElementAttachment, ElementLinkPreview, ElementTimestamp, InspectableElement, SafeMediaPlaceholder } from "./SelectableMessage";
import { isCompleted, isSelected, type ScenarioSkinProps } from "./types";

export function GameChatSkin({ scene, selection, onSelect, readOnly, testId }: ScenarioSkinProps) {
  const actors = new Map((scene.actors ?? []).map((actor) => [actor.actor_key, actor.display_name]));

  const firstElement = scene.elements[0];
  const appName = firstElement?.presentation.app_name || "PixelPort";
  const channelName = firstElement?.presentation.channel_name || "general-game-chat";
  const memberSummary = firstElement?.presentation.member_summary || "Squad Lobby";

  return (
    <Paper
      elevation={0}
      variant="outlined"
      aria-label="Gaming chat scenario"
      data-testid={testId}
      sx={{
        maxWidth: 760,
        mx: "auto",
        my: 2,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "#1E1E2E", // Dark gaming backdrop theme
        color: "#CDD6F4",
        borderColor: "rgba(255,255,255,0.1)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
      }}
    >
      {/* PixelPort Gaming Server Header */}
      <Box
        sx={{
          px: { xs: 2, sm: 2.5 },
          py: 1.75,
          bgcolor: "#181825",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
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
            background: "linear-gradient(135deg, #89B4FA 0%, #74C7EC 100%)",
            color: "#11111B",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(137, 180, 250, 0.3)",
          }}
        >
          <SportsEsportsIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <TagIcon sx={{ fontSize: 16, color: "#89B4FA" }} />
            <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "#F5E0DC", lineHeight: 1.2 }}>
              {channelName}
            </Typography>
          </Box>
          <Typography variant="caption" sx={{ color: "#A6ADC8", fontSize: "0.725rem" }}>
            {appName} Gaming Server
          </Typography>
        </Box>
        <Chip
          icon={<ShieldIcon sx={{ fontSize: "14px !important", color: "#A6E3A1 !important" }} />}
          label={memberSummary}
          size="small"
          sx={{ bgcolor: "rgba(166, 227, 161, 0.15)", color: "#A6E3A1", fontWeight: 700, fontSize: "0.65rem" }}
        />
      </Box>

      {/* Gaming Chat Stream */}
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 1.5 }}>
        {scene.elements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "#A6ADC8" }}>
            <Typography variant="body2">No game chat activity present.</Typography>
          </Box>
        ) : (
          scene.elements.map((element) => {
            const label = actors.get(element.actor_key ?? "") ?? element.presentation.display_label ?? "Gamer";
            const isRight = element.presentation.alignment === "end";
            const isSystem = element.semantic_role === "system" || Boolean((element.presentation as Record<string, unknown>).is_system);

            if (isSystem) {
              return (
                <InspectableElement
                  key={element.element_key}
                  element={element}
                  selected={isSelected(element, selection)}
                  completed={isCompleted(element, selection)}
                  onSelect={onSelect}
                  readOnly={readOnly}
                >
                  <Box sx={{ display: "flex", justifyContent: "center", my: 0.5 }}>
                    <Chip
                      label={`[SYSTEM]: ${element.content}`}
                      size="small"
                      sx={{
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        fontFamily: "monospace",
                        bgcolor: "rgba(249, 226, 175, 0.12)",
                        color: "#F9E2AF",
                        border: "1px dashed rgba(249, 226, 175, 0.4)",
                        maxWidth: "95%",
                      }}
                    />
                  </Box>
                </InspectableElement>
              );
            }

            return (
              <InspectableElement
                key={element.element_key}
                element={element}
                selected={isSelected(element, selection)}
                completed={isCompleted(element, selection)}
                onSelect={onSelect}
                readOnly={readOnly}
              >
                <Box sx={{ display: "flex", gap: 1.5, alignItems: "flex-start" }}>
                  <ActorAvatar label={label} />
                  <Box sx={{ flexGrow: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5, flexWrap: "wrap" }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 800, color: "#89B4FA", fontSize: "0.875rem" }}>
                        {label}
                      </Typography>
                      {isRight && (
                        <Chip
                          label="Player"
                          size="small"
                          sx={{ height: 16, fontSize: "0.6rem", bgcolor: "#CBA6F7", color: "#11111B", fontWeight: 700 }}
                        />
                      )}
                      <ElementTimestamp presentation={element.presentation} timestamp={element.timestamp} />
                    </Box>

                    {/* Message Bubble Card */}
                    <Paper
                      elevation={0}
                      sx={{
                        p: 1.75,
                        borderRadius: 2,
                        bgcolor: isRight ? "#313244" : "#181825",
                        color: "#CDD6F4",
                        border: "1px solid rgba(255,255,255,0.06)",
                      }}
                    >
                      {element.element_type === "attachment" ? (
                        <ElementAttachment label={element.presentation.display_label} />
                      ) : element.element_type === "link_preview" ? (
                        <ElementLinkPreview label={element.presentation.display_label} />
                      ) : element.presentation.local_media_id ? (
                        <SafeMediaPlaceholder altText={element.presentation.alt_text} />
                      ) : (
                        <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.55 }}>
                          {element.content}
                        </Typography>
                      )}
                    </Paper>
                  </Box>
                </Box>
              </InspectableElement>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
