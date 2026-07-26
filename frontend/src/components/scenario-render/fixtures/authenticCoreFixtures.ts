import type { FamilyMessage, FamilyScene, RenderSkin, SceneElement } from "@/types";

export interface SkinFixture {
  id: string;
  scene: FamilyScene;
  safeElementKey: string;
  obviousTargetKey: string;
  subtleTargetKey: string;
  checkpointElementKey: string;
}

const message = (id: number, sequence: number, speaker_label: string, content: string, checkpoint = false): FamilyMessage => ({
  id, sequence, speaker_label, content, pace: "normal", is_checkpoint: checkpoint,
  checkpoint_prompt: checkpoint ? "What detail would you pause to inspect with a trusted adult?" : null,
});
const element = (element_key: string, element_type: SceneElement["element_type"], sequence: number, accessible_label: string, content: string | null, presentation: SceneElement["presentation"] = {}, parent_element_key: string | null = null): SceneElement => ({
  element_key, element_type, parent_element_key, source_message_id: sequence + 100, sequence, content,
  presentation, selectable: true, accessible_label, semantic_role: "article",
});
const scene = (render_skin: RenderSkin, elements: SceneElement[], messages: FamilyMessage[]): FamilyScene => ({
  scene_schema_version: 1, skin_version: "1.0", render_skin, elements, messages,
  actors: [{ actor_key: "nova", display_name: "Nova" }, { actor_key: "riley", display_name: "Riley" }],
  supported_actions: ["select", "request_hint"],
});

/** Development/visual-test scenes only: annotations are fixture metadata, never API payloads. */
export const authenticCoreFixtures: Record<RenderSkin, SkinFixture> = {
  chat: {
    id: "phase6-chat-profile", safeElementKey: "chat-safe", obviousTargetKey: "chat-link", subtleTargetKey: "chat-profile", checkpointElementKey: "chat-message",
    scene: scene("chat", [
      element("chat-safe", "message", 0, "Message from Riley", "Nice match! I only use the public lobby when I play with people I do not know yet."),
      element("chat-message", "message", 1, "Message from Nova", "I can trade you a rare item, but use my private page so nobody else grabs it.", { app_name: "LumaChat", channel_name: "game-night", member_summary: "3 members", presence_summary: "Nova is online" }),
      element("chat-profile", "profile", 1, "Nova profile", "Profile card", { panel_kind: "profile", profile_handle: "@NovaPlays", account_age_label: "Account opened recently", badges: ["Top trader"], stats: ["12 trades"], bio: "Competitive player looking for teammates." }),
      element("chat-link", "link_preview", 1, "Private trade page link", "Private trade page", { panel_kind: "linked_site", href: "/practice/trade", display_label: "Private trade page" }, "chat-profile"),
    ], [message(100, 0, "Riley", "Nice match!"), message(101, 1, "Nova", "I can trade you a rare item.", true)]),
  },
  email: {
    id: "phase6-email-thread", safeElementKey: "email-safe", obviousTargetKey: "email-link", subtleTargetKey: "email-sender", checkpointElementKey: "email-body",
    scene: scene("email", [
      element("email-safe", "email_message", 0, "Email from School Club", "The club meeting is in the usual room.", { sender_address: "club@school.example", recipient_summary: "To: Riley" }),
      element("email-subject", "email_header", 1, "Email subject", "Action required: account review", { app_name: "Postbird Mail", subject: "Action required: account review", security_notice: "Check sender details before responding." }),
      element("email-body", "email_message", 1, "Email from Luma Account Team", "Your account will close today. Confirm your details using the attached form.", { sender_address: "accounts@luma-check.example", recipient_summary: "To: Riley", timestamp_label: "Today, 4:30 PM" }),
      element("email-sender", "profile_field", 1, "Sender domain", "luma-check.example", { sender_address: "accounts@luma-check.example" }, "email-body"),
      element("email-link", "link_preview", 1, "Account confirmation link", "Confirm account", { panel_kind: "linked_site", href: "/practice/account-check", display_label: "Confirm account" }, "email-body"),
      element("email-attachment", "attachment", 1, "Account review attachment", "account-review.pdf", { panel_kind: "attachment", display_label: "account-review.pdf" }, "email-body"),
    ], [message(100, 0, "School Club", "The club meeting is in the usual room."), message(101, 1, "Luma Account Team", "Your account will close today.", true)]),
  },
  social_feed: {
    id: "phase6-social-profile", safeElementKey: "social-safe", obviousTargetKey: "social-audience", subtleTargetKey: "social-location", checkpointElementKey: "social-post",
    scene: scene("social_feed", [
      element("social-safe", "post", 0, "Jordan post", "Lovely weather for a walk this weekend.", { app_name: "Dayline", audience_label: "Friends" }),
      element("social-post", "post", 1, "Riley post", "Friday practice again at the community centre after school — come say hi!", { app_name: "Dayline", audience_label: "Public", location_label: "Community centre", routine_label: "Friday after school" }),
      element("social-profile", "profile", 1, "Riley profile", "Riley’s profile", { panel_kind: "profile", profile_handle: "@riley.moves", bio: "Posts about clubs and games." }),
      element("social-audience", "profile_field", 1, "Audience: Public", "Public", { audience_label: "Public" }, "social-profile"),
      element("social-location", "profile_field", 1, "Location: Community centre", "Community centre", { location_label: "Community centre", routine_label: "Friday after school" }, "social-profile"),
    ], [message(100, 0, "Jordan", "Lovely weather."), message(101, 1, "Riley", "Friday practice again.", true)]),
  },
  game_chat: {
    id: "phase6-game-profile", safeElementKey: "game-safe", obviousTargetKey: "game-invite", subtleTargetKey: "game-profile", checkpointElementKey: "game-invite",
    scene: scene("game_chat", [
      element("game-safe", "message", 0, "Message from Riley", "I am staying in the public lobby."),
      element("game-invite", "server", 1, "Private server invite", "Join the private server to claim your reward.", { app_name: "PixelPort", channel_name: "#lobby", member_summary: "18 members" }),
      element("game-profile", "game_profile", 1, "Nova game profile", "Nova profile", { panel_kind: "profile", profile_handle: "NovaPlays", account_age_label: "New account", trade_link_label: "Reward claim link", badges: ["Season starter"], stats: ["2 public matches"] }),
    ], [message(100, 0, "Riley", "I am staying public."), message(101, 1, "Nova", "Join private server.", true)]),
  },
  forum: {
    id: "phase6-forum-thread", safeElementKey: "forum-safe", obviousTargetKey: "forum-form", subtleTargetKey: "forum-post", checkpointElementKey: "forum-thread",
    scene: scene("forum", [
      element("forum-safe", "forum_post", 0, "Post by Jordan", "Keep personal details broad in public threads."),
      element("forum-thread", "forum_thread", 1, "Weekend plans forum thread", "Post your full schedule so people can plan around you.", { app_name: "LoopForum", panel_kind: "thread", surface_label: "Weekend plans" }),
      element("forum-post", "forum_post", 1, "Post by HelpfulGuide", "Post your full schedule so people can plan around you.", {}, "forum-thread"),
      element("forum-form", "site_section", 1, "Schedule form section", "Share routine details", { panel_kind: "linked_site", href: "/practice/schedule", display_label: "Schedule form" }, "forum-thread"),
    ], [message(100, 0, "Jordan", "Keep details broad."), message(101, 1, "HelpfulGuide", "Post your schedule.", true)]),
  },
  marketplace: {
    id: "phase6-marketplace-listing", safeElementKey: "market-safe", obviousTargetKey: "market-payment", subtleTargetKey: "market-seller", checkpointElementKey: "market-listing",
    scene: scene("marketplace", [
      element("market-safe", "listing", 0, "Verified listing", "Use the marketplace payment tools."),
      element("market-listing", "listing", 1, "Rare item listing", "Pay outside the marketplace and I can hold it for you.", { app_name: "SwapSquare", panel_kind: "listing", surface_label: "Rare item listing" }),
      element("market-seller", "seller", 1, "QuickTrade seller profile", "QuickTrade", { panel_kind: "profile", profile_handle: "QuickTrade", account_age_label: "Joined this week", bio: "Fast private deals." }, "market-listing"),
      element("market-payment", "listing_field", 1, "Payment instructions", "Pay outside the marketplace", { display_label: "Payment instructions" }, "market-listing"),
    ], [message(100, 0, "Verified seller", "Use payment tools."), message(101, 1, "QuickTrade", "Pay outside.", true)]),
  },
};

export const fixtureMatrix = {
  themes: ["light", "dark"], viewports: ["mobile", "tablet", "desktop"],
  interactionStates: ["selected", "validating", "validated_concern", "validated_safe", "hint"],
} as const;
