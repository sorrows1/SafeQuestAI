import type { KeyboardEvent, ReactNode } from "react";
import { Avatar, Box, Chip, Typography, Paper } from "@mui/material";
import FlagIcon from "@mui/icons-material/Flag";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import LinkIcon from "@mui/icons-material/Link";
import ImageIcon from "@mui/icons-material/Image";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import type { PresentationToken, SceneElement } from "@/types";

interface InspectableElementProps {
  element: SceneElement;
  selected: boolean;
  onSelect: (elementKey: string) => void;
  readOnly?: boolean;
  children: ReactNode;
}

/** Shared, keyboard-operable selection treatment for every semantic element. */
export function InspectableElement({ element, selected, onSelect, readOnly = false, children }: InspectableElementProps) {
  const interactive = element.selectable && !readOnly;
  const select = () => interactive && onSelect(element.element_key);
  const key = (event: KeyboardEvent<HTMLDivElement>) => {
    if (interactive && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      select();
    }
  };

  return (
    <Box
      data-testid={`scene-element-${element.element_key}`}
      role={interactive ? "button" : undefined}
      aria-pressed={interactive ? selected : undefined}
      aria-label={interactive ? `${element.accessible_label}; select for discussion` : element.accessible_label}
      tabIndex={interactive ? 0 : undefined}
      onClick={select}
      onKeyDown={key}
      sx={{
        position: "relative",
        borderRadius: 2.5,
        cursor: interactive ? "pointer" : "default",
        minHeight: 44,
        boxSizing: "border-box",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        outline: selected ? "3px solid" : "none",
        outlineColor: "primary.main",
        boxShadow: selected ? "0 0 16px rgba(25, 118, 210, 0.35)" : "none",
        bgcolor: selected ? "action.selected" : "transparent",
        p: selected ? { xs: 1, sm: 1.25 } : { xs: 0.25, sm: 0.5 },
        "&:hover": interactive ? {
          transform: "translateY(-1px)",
          boxShadow: selected ? "0 0 18px rgba(25, 118, 210, 0.45)" : "0 4px 12px rgba(0,0,0,0.06)",
        } : {},
        "&:focus-visible": {
          outline: "3px solid",
          outlineColor: "primary.main",
          outlineOffset: "2px",
        },
      }}
    >
      {selected && (
        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.75 }}>
          <Chip
            size="small"
            color="primary"
            icon={<FlagIcon sx={{ fontSize: "0.875rem !important" }} />}
            label="SELECTED FOR DISCUSSION"
            sx={{ fontWeight: 700, fontSize: "0.65rem", height: 22, textTransform: "uppercase", letterSpacing: 0.5 }}
          />
        </Box>
      )}
      {children}
    </Box>
  );
}

export function ActorAvatar({ label }: { label?: string | null }) {
  const initial = label?.trim().slice(0, 1).toUpperCase() || "?";
  
  const colors = [
    "linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)",
    "linear-gradient(135deg, #EC4899 0%, #D946EF 100%)",
    "linear-gradient(135deg, #14B8A6 0%, #0D9488 100%)",
    "linear-gradient(135deg, #F59E0B 0%, #D97706 100%)",
    "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
  ];
  const charCode = (label || "?").charCodeAt(0);
  const bg = colors[charCode % colors.length];

  return (
    <Avatar
      aria-label={label ? `${label} avatar` : "Actor avatar"}
      sx={{
        background: bg,
        fontWeight: 700,
        fontSize: "0.9rem",
        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
        width: 38,
        height: 38,
        flexShrink: 0,
      }}
    >
      {initial}
    </Avatar>
  );
}

export function ElementTimestamp({ presentation, timestamp }: { presentation: PresentationToken; timestamp?: string | null }) {
  const label = presentation.timestamp_label ?? timestamp;
  return label ? (
    <Typography variant="caption" color="text.secondary" sx={{ fontSize: "0.725rem", opacity: 0.85, whiteSpace: "nowrap" }}>
      {label}
    </Typography>
  ) : null;
}

export function SafeMediaPlaceholder({ altText }: { altText?: string | null }) {
  return (
    <Box
      role="img"
      aria-label={altText || "Media placeholder"}
      sx={{
        minHeight: 120,
        borderRadius: 2,
        bgcolor: "action.hover",
        border: "1px dashed",
        borderColor: "divider",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 1,
        color: "text.secondary",
        p: 2,
        my: 1,
      }}
    >
      <ImageIcon sx={{ fontSize: 32, opacity: 0.6 }} />
      <Typography variant="caption" align="center" sx={{ fontWeight: 500 }}>
        {altText || "Media attachment (sandboxed display)"}
      </Typography>
    </Box>
  );
}

export function ElementAttachment({ label }: { label?: string | null }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 1.5,
        mt: 1,
        px: 1.75,
        py: 1.25,
        borderRadius: 2,
        bgcolor: "background.paper",
        borderColor: "divider",
        maxWidth: "100%",
        boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
      }}
    >
      <Box sx={{ p: 0.75, borderRadius: 1, bgcolor: "primary.50", color: "primary.main", display: "flex" }}>
        <AttachFileIcon fontSize="small" />
      </Box>
      <Box sx={{ overflow: "hidden" }}>
        <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontSize: "0.825rem" }}>
          {label || "Attachment.file"}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          Secured file artifact
        </Typography>
      </Box>
    </Paper>
  );
}

export function ElementLinkPreview({ label }: { label?: string | null }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        mt: 1,
        p: 1.5,
        borderRadius: 2,
        borderLeft: "4px solid",
        borderLeftColor: "primary.main",
        bgcolor: "action.hover",
        display: "flex",
        flexDirection: "column",
        gap: 0.5,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, color: "primary.main" }}>
        <LinkIcon fontSize="small" />
        <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Link Preview
        </Typography>
        <OpenInNewIcon sx={{ fontSize: 14, ml: "auto", opacity: 0.6 }} />
      </Box>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {label || "Linked external resource"}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap>
        Safe preview — link destination is sandboxed
      </Typography>
    </Paper>
  );
}
