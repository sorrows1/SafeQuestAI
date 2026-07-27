import { Box, Chip, Divider, Paper, Typography } from "@mui/material";
import EmailIcon from "@mui/icons-material/Email";
import ReplyIcon from "@mui/icons-material/Reply";
import ForwardIcon from "@mui/icons-material/Forward";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import SecurityIcon from "@mui/icons-material/Security";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { ActorAvatar, ElementAttachment, ElementLinkPreview, ElementTimestamp, InspectableElement, SafeMediaPlaceholder } from "./SelectableMessage";
import { isCompleted, isSelected, type ScenarioSkinProps } from "./types";

export function EmailSkin({ scene, selection, onSelect, readOnly, testId }: ScenarioSkinProps) {
  const actors = new Map((scene.actors ?? []).map((actor) => [actor.actor_key, actor.display_name]));
  
  const headerElement = scene.elements.find((el) => el.element_type === "email_header" || el.presentation.subject);
  const appName = headerElement?.presentation.app_name || "Postbird Mail";
  const subjectText = headerElement?.presentation.subject || headerElement?.presentation.display_label || "Important Message";
  const securityNotice = headerElement?.presentation.security_notice;

  return (
    <Paper
      elevation={0}
      variant="outlined"
      aria-label="Email scenario"
      data-testid={testId}
      sx={{
        maxWidth: 800,
        mx: "auto",
        my: 2,
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "background.paper",
        borderColor: "divider",
        boxShadow: "0 4px 24px rgba(0,0,0,0.06)",
      }}
    >
      {/* Postbird Mail Header Bar */}
      <Box
        sx={{
          px: { xs: 2, sm: 3 },
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
            background: "linear-gradient(135deg, #0EA5E9 0%, #0284C7 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(14, 165, 233, 0.3)",
          }}
        >
          <EmailIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {appName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Secure Webmail Client
          </Typography>
        </Box>
        <StarBorderIcon sx={{ color: "text.secondary", cursor: "pointer" }} fontSize="small" />
      </Box>

      {/* Subject Line Banner */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
          {subjectText}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.75, flexWrap: "wrap" }}>
          <Chip label="Inbox" size="small" color="primary" variant="outlined" sx={{ height: 22, fontSize: "0.7rem", fontWeight: 700 }} />
          <Chip label="Simulation Thread" size="small" sx={{ height: 22, fontSize: "0.7rem" }} />
          <Chip
            icon={<SecurityIcon sx={{ fontSize: "12px !important", color: "success.main !important" }} />}
            label="Standard Encryption (TLS)"
            size="small"
            variant="outlined"
            sx={{ height: 22, fontSize: "0.675rem", fontWeight: 600, ml: "auto" }}
          />
        </Box>
      </Box>

      {/* Security Warning Notice Banner (If Present) */}
      {securityNotice && (
        <Box
          sx={{
            px: { xs: 2, sm: 3 },
            py: 1.25,
            bgcolor: "warning.50",
            color: "warning.dark",
            borderBottom: "1px solid",
            borderColor: "warning.200",
            display: "flex",
            alignItems: "center",
            gap: 1.25,
          }}
        >
          <WarningAmberIcon fontSize="small" color="warning" />
          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: "0.775rem" }}>
            {securityNotice}
          </Typography>
        </Box>
      )}

      {/* Email Messages list */}
      <Box sx={{ p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
        {scene.elements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No email messages in this thread.</Typography>
          </Box>
        ) : (
          scene.elements.map((element) => {
            const fromName = actors.get(element.actor_key ?? "") ?? element.presentation.display_label ?? "Scenario participant";
            const senderAddress = element.presentation.sender_address;
            const recipientSummary = element.presentation.recipient_summary || "To: User <user@safequest.app>";

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
                    bgcolor: "background.paper",
                    borderColor: "divider",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.02)",
                  }}
                >
                  {/* Email Header */}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.75 }}>
                    <ActorAvatar label={fromName} />
                    <Box sx={{ flexGrow: 1, overflow: "hidden" }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 1 }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {fromName}
                        </Typography>
                        <ElementTimestamp presentation={element.presentation} timestamp={element.timestamp} />
                      </Box>
                      {senderAddress && (
                        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", fontWeight: 600 }}>
                          &lt;{senderAddress}&gt;
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", fontSize: "0.7rem", opacity: 0.8 }}>
                        {recipientSummary}
                      </Typography>
                    </Box>
                  </Box>

                  <Divider sx={{ my: 1.5 }} />

                  {/* Email Body & Content */}
                  {element.element_type === "attachment" ? (
                    <ElementAttachment label={element.presentation.display_label} />
                  ) : element.element_type === "link_preview" ? (
                    <ElementLinkPreview label={element.presentation.display_label} />
                  ) : element.presentation.local_media_id ? (
                    <SafeMediaPlaceholder altText={element.presentation.alt_text} />
                  ) : (
                    <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", lineHeight: 1.65, color: "text.primary" }}>
                      {element.content}
                    </Typography>
                  )}

                  {/* Inert Quick Reply Bar */}
                  <Box sx={{ display: "flex", gap: 1, mt: 2.5, pt: 1.5, borderTop: "1px dashed", borderColor: "divider" }}>
                    <Chip
                      icon={<ReplyIcon sx={{ fontSize: 16 }} />}
                      label="Reply"
                      size="small"
                      variant="outlined"
                      clickable={false}
                      sx={{ borderRadius: 1.5, fontWeight: 600 }}
                    />
                    <Chip
                      icon={<ForwardIcon sx={{ fontSize: 16 }} />}
                      label="Forward"
                      size="small"
                      variant="outlined"
                      clickable={false}
                      sx={{ borderRadius: 1.5, fontWeight: 600 }}
                    />
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
