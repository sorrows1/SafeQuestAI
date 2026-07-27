import { Box, Chip, Paper, Typography } from "@mui/material";
import StorefrontIcon from "@mui/icons-material/Storefront";
import VerifiedIcon from "@mui/icons-material/Verified";
import LocalOfferIcon from "@mui/icons-material/LocalOffer";
import { ActorAvatar, ElementAttachment, ElementLinkPreview, ElementTimestamp, InspectableElement, SafeMediaPlaceholder } from "./SelectableMessage";
import { isCompleted, isSelected, type ScenarioSkinProps } from "./types";

export function MarketplaceSkin({ scene, selection, onSelect, readOnly, testId }: ScenarioSkinProps) {
  const actors = new Map((scene.actors ?? []).map((actor) => [actor.actor_key, actor.display_name]));

  const firstElement = scene.elements[0];
  const appName = firstElement?.presentation.app_name || "SwapSquare";
  const surfaceLabel = firstElement?.presentation.surface_label || "Peer-to-Peer Marketplace";

  return (
    <Paper
      elevation={0}
      variant="outlined"
      aria-label="Marketplace scenario"
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
      {/* SwapSquare Header */}
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
            background: "linear-gradient(135deg, #10B981 0%, #059669 100%)",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 2px 8px rgba(16, 185, 129, 0.3)",
          }}
        >
          <StorefrontIcon fontSize="small" />
        </Box>
        <Box sx={{ flexGrow: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {appName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {surfaceLabel}
          </Typography>
        </Box>
        <Chip
          icon={<VerifiedIcon sx={{ fontSize: "14px !important" }} />}
          label="Verified Platform"
          size="small"
          color="success"
          variant="outlined"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      {/* Item Listing Spotlight Box */}
      <Box sx={{ px: { xs: 2, sm: 3 }, py: 2, bgcolor: "action.hover", borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 2, flexWrap: "wrap" }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, fontSize: { xs: "1rem", sm: "1.15rem" } }}>
              Gaming Gear & Item Trade Listing
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Category: Digital Items & Electronics
            </Typography>
          </Box>
          <Chip
            icon={<LocalOfferIcon sx={{ fontSize: 14 }} />}
            label="$150.00"
            color="success"
            sx={{ fontWeight: 800, fontSize: "0.9rem", px: 0.5 }}
          />
        </Box>
      </Box>

      {/* Marketplace Conversation / Details */}
      <Box sx={{ p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
        {scene.elements.length === 0 ? (
          <Box sx={{ p: 4, textAlign: "center", color: "text.secondary" }}>
            <Typography variant="body2">No marketplace listings to display.</Typography>
          </Box>
        ) : (
          scene.elements.map((element) => {
            const seller = actors.get(element.actor_key ?? "") ?? element.presentation.display_label ?? "Marketplace User";

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
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1.5, flexWrap: "wrap" }}>
                    <ActorAvatar label={seller} />
                    <Box sx={{ flexGrow: 1 }}>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
                        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                          {seller}
                        </Typography>
                        <Chip label="Seller / Trader" size="small" variant="outlined" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700 }} />
                        <Chip label="★ 4.9 (28 sales)" size="small" sx={{ height: 18, fontSize: "0.65rem", fontWeight: 700, bgcolor: "action.hover" }} />
                      </Box>
                      <ElementTimestamp presentation={element.presentation} timestamp={element.timestamp} />
                    </Box>
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
                </Paper>
              </InspectableElement>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
