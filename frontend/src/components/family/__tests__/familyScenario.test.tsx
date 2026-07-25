import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { ThemeProvider } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { darkTheme } from "@/theme";
import { SkinRouter } from "@/components/scenario-render/SkinRouter";
import { ConversationGuideView } from "../ConversationGuideView";
import { CheckpointPause } from "../CheckpointPause";
import type { FamilyMessage, RenderSkin } from "@/types";

vi.mock("@/store/api", () => ({ useGetConversationGuideQuery: () => ({ data: { id: 1, family_session_id: 1, scenario_summary: "A calm recap.", child_reasoning_excerpt: { one: "I would tell someone." }, discussion_prompts: ["Who feels safe to tell?"], completed_together: true, generated_at: "" }, isLoading: false, isError: false }) }));
const messages: FamilyMessage[] = [{ id: 11, sequence: 1, speaker_label: "Taylor", content: "Please keep this between us.", pace: "normal", is_checkpoint: false, checkpoint_prompt: null }];
function renderWithTheme(node: React.ReactElement) { return render(<ThemeProvider theme={darkTheme}>{node}</ThemeProvider>); }
function DetectiveHarness({ skin }: { skin: RenderSkin }) { const [selected, setSelected] = useState<number[]>([]); return <><SkinRouter renderSkin={skin} messages={messages} detectiveMode highlightedMessageIds={selected} onToggleMessage={(id) => setSelected((current) => current.includes(id) ? [] : [id])} /><output>{selected.join(",")}</output></>; }
describe("family scenario UI", () => {
  it.each<RenderSkin>(["chat", "email", "social_feed"])("uses identical detective selection for the %s skin", async (skin) => { renderWithTheme(<DetectiveHarness skin={skin} />); fireEvent.keyDown(screen.getByRole("button", { name: /select message 11/i }), { key: "Enter" }); expect(screen.getByText("11")).toBeTruthy(); fireEvent.keyDown(screen.getByRole("button", { name: /select message 11/i }), { key: " " }); expect(screen.getByText("", { selector: "output" })).toBeTruthy(); });
  it("keeps score-like language out of the conversation guide", () => { renderWithTheme(<ConversationGuideView sessionId={1} />); expect(screen.queryByText(/score|grade|percentage|incorrect|mistake/i)).toBeNull(); expect(screen.getByRole("region", { name: /conversation guide/i })).toBeTruthy(); });
  it("uses the same checkpoint component for parent-present and companion sessions", async () => { const onSubmit = vi.fn(); const { rerender } = renderWithTheme(<CheckpointPause prompt="What would you do?" detectiveMode={false} selectedCount={0} companionMode={false} onSubmit={onSubmit} onTagChange={vi.fn()} />); fireEvent.change(screen.getByLabelText(/what do you notice/i), { target: { value: "I would tell someone." } }); fireEvent.click(screen.getByRole("button", { name: /continue/i })); expect(onSubmit).toHaveBeenCalledWith("I would tell someone.", ""); rerender(<ThemeProvider theme={darkTheme}><CheckpointPause prompt="What would you do?" detectiveMode={false} selectedCount={0} companionMode onSubmit={onSubmit} onTagChange={vi.fn()} /></ThemeProvider>); expect(screen.getByRole("region", { name: /discussion pause/i })).toBeTruthy(); });
});
