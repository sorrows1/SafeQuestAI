import { Box, Chip, Paper, Typography } from "@mui/material";
import ChatBubbleOutlineOutlinedIcon from "@mui/icons-material/ChatBubbleOutlineOutlined";
import LockIcon from "@mui/icons-material/Lock";
import SendIcon from "@mui/icons-material/Send";
import TagIcon from "@mui/icons-material/Tag";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import { MessageBubble } from "@/components/messaging/MessageBubble";
import { ActorAvatar, ElementAttachment, ElementLinkPreview, ElementTimestamp, InspectableElement, SafeMediaPlaceholder } from "./SelectableMessage";
import { isCompleted, isSelected, type ScenarioSkinProps } from "./types";

export function ChatSkin({ scene, selection, onSelect, readOnly, testId }: ScenarioSkinProps) {
  const actors = new Map((scene.actors ?? []).map((actor) => [actor.actor_key, actor]));
  const actorOrder = Array.from(new Set(scene.elements.map((element) => element.actor_key).filter(Boolean)));

  // Extract presentation metadata if present
  const firstElement = scene.elements[0];
  const appName = firstElement?.presentation.app_name || "LumaChat";
  const channelName = firstElement?.presentation.channel_name || "direct-messages";
  const memberSummary = firstElement?.presentation.member_summary;
  const presenceSummary = firstElement?.presentation.presence_summary || "Encrypted simulation session";

  return (
    <Paper
      elevation={0}
      variant="outlined"
      aria-label="Chat scenario"
      data-testid={testId}
      sx={{
        maxWidth: 760,
        mx: "auto",
        my: 2,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        borderColor: "divider",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* LumaChat Header Bar */}
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
            background: "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(99, 102, 241, 0.3)",
          }}
        >
          <ChatBubbleOutlineOutlinedIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {appName}
            </Typography>
            <Chip
              icon={<TagIcon sx={{ fontSize: "12px !important" }} />}
              label={channelName}
              size="small"
              sx={{ height: 20, fontSize: "0.7rem", fontWeight: 700, bgcolor: "action.hover" }}
            />
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, color: "text.secondary", mt: 0.25 }}>
            <LockIcon sx={{ fontSize: 12, color: "success.main" }} />
            <Typography variant="caption" noWrap sx={{ fontSize: "0.725rem" }}>
              {presenceSummary}
            </Typography>
          </Box>
        </Box>
        {memberSummary && (
          <Chip
            icon={<PeopleAltOutlinedIcon sx={{ fontSize: "14px !important" }} />}
            label={memberSummary}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600, display: { xs: "none", sm: "inline-flex" } }}
          />
        )}
      </Box>

      {/* Message Feed Area */}
      <Box sx={{ p: { xs: 2, sm: 2.5 }, display: "flex", flexDirection: "column", gap: 1.5, minHeight: 180 }}>
        {scene.elements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No messages in this chat session.</Typography>
          </Box>
        ) : (
          scene.elements.map((element, index) => {
            const actor = actors.get(element.actor_key ?? "");
            const label = actor?.display_name ?? element.presentation.display_label ?? "Scenario participant";
            const role = actor?.role ?? (element.actor_key?.toLowerCase().includes('respondent') ? 'respondent' : element.actor_key?.toLowerCase().includes('initiator') ? 'initiator' : null);
            const isRight = role === 'respondent' || role === 'caregiver' || role === 'ai_companion' ? true : role === 'initiator' || role === 'learner' ? false : actorOrder.indexOf(element.actor_key ?? '') > 0;
            const previous = scene.elements[index - 1];
            const grouped = Boolean(previous && previous.actor_key === element.actor_key);
            const timestampLabel = element.presentation.timestamp_label ?? (grouped ? undefined : (previous && previous.actor_key !== element.actor_key ? '1 minute later' : 'Now'));
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
                      label={element.content}
                      size="small"
                      variant="outlined"
                      sx={{
                        fontSize: "0.725rem",
                        fontWeight: 600,
                        bgcolor: "action.hover",
                        borderColor: "divider",
                        color: "text.secondary",
                        maxWidth: "90%",
                      }}
                    />
                  </Box>
                </InspectableElement>
              );
            }

            const body =
              element.element_type === "attachment" ? (
                <ElementAttachment label={element.presentation.display_label} />
              ) : element.element_type === "link_preview" ? (
                <ElementLinkPreview label={element.presentation.display_label} />
              ) : element.presentation.local_media_id ? (
                <SafeMediaPlaceholder altText={element.presentation.alt_text} />
              ) : (
                <MessageBubble
                  content={element.content ?? ""}
                  speakerLabel={label}
                  side={isRight ? "right" : "left"}
                  pace="normal"
                  showAvatar={!grouped}
                  showLabel={!grouped}
                  selectable={element.selectable}
                />
              );

            return (
              <InspectableElement
                key={element.element_key}
                element={element}
                selected={isSelected(element, selection)}
                completed={isCompleted(element, selection)}
                onSelect={onSelect}
                readOnly={readOnly}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 1.5,
                    flexDirection: isRight ? "row-reverse" : "row",
                    width: "100%",
                  }}
                >
                  <Box sx={{ flexGrow: 1, maxWidth: "85%" }}>
                    {body}
                    {/* Timestamp rendered below MessageBubble (which handles its own avatar + label) */}
                    <Box sx={{ display: "flex", justifyContent: isRight ? "flex-end" : "flex-start", mt: 0.25 }}>
                      <ElementTimestamp presentation={{ ...element.presentation, timestamp_label: timestampLabel }} timestamp={grouped ? undefined : element.timestamp} />
                    </Box>
                  </Box>
                </Box>
              </InspectableElement>
            );
          })
        )}
      </Box>

      {/* Inert LumaChat Compose Bar */}
      <Box
        sx={{
          px: 2.5,
          py: 1.5,
          bgcolor: "background.default",
          borderTop: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1.5,
        }}
      >
        <Paper
          variant="outlined"
          sx={{
            flexGrow: 1,
            px: 2,
            py: 1,
            borderRadius: 3,
            bgcolor: "background.paper",
            borderColor: "divider",
            color: "text.secondary",
            fontSize: "0.875rem",
          }}
        >
          Message in #{channelName}... (practice chat view)
        </Paper>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0.8,
          }}
        >
          <SendIcon fontSize="small" />
        </Box>
      </Box>
    </Paper>
  );
}
