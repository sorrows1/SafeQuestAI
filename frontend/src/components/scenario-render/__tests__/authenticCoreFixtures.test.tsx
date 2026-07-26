import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { FamilyGameplayView } from "@/pages/family/FamilyGameplayView";
import { SkinRouter } from "../SkinRouter";
import { authenticCoreFixtures, fixtureMatrix } from "../fixtures/authenticCoreFixtures";
import type { ScenePanelNavigation } from "../types";

const theme = createTheme();

function renderThemed(node: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

describe("authentic core fixture contracts", () => {
  it("covers every registered skin and its visual test matrix", () => {
    expect(Object.keys(authenticCoreFixtures).sort()).toEqual([
      "chat", "email", "forum", "game_chat", "marketplace", "social_feed",
    ]);
    expect(fixtureMatrix.themes).toEqual(["light", "dark"]);
    expect(fixtureMatrix.viewports).toEqual(["mobile", "tablet", "desktop"]);
    expect(fixtureMatrix.interactionStates).toContain("validated_concern");
  });

  it("selects stable server element keys across message, header, post field, attachment, and linked-site artifacts", () => {
    const cases = [
      ["chat", "chat-message"],
      ["email", "email-subject"],
      ["social_feed", "social-audience"],
      ["email", "email-attachment"],
      ["email", "email-link"],
    ] as const;
    for (const [skin, key] of cases) {
      const select = vi.fn();
      const fixture = authenticCoreFixtures[skin];
      const { unmount } = renderThemed(
        <SkinRouter scene={fixture.scene} renderSkin={skin} selection={{ selectedElementKeys: [] }} onSelect={select} />,
      );
      const target = screen.getByTestId(`scene-element-${key}`);
      fireEvent.keyDown(target, { key: "Enter" });
      expect(select).toHaveBeenCalledWith(key);
      expect(target.getAttribute("role")).toBe("button");
      unmount();
    }
  });

  it("keeps profile, attachment, and linked-site navigation contained while preserving selection keys", () => {
    const fixture = authenticCoreFixtures.chat;
    function Harness() {
      const [selected, setSelected] = useState<string[]>([]);
      const [history, setHistory] = useState<string[]>([]);
      const navigation: ScenePanelNavigation = {
        activeElementKey: history[history.length - 1] ?? null,
        canGoBack: history.length > 1,
        openPanel: (key) => setHistory((current) => current[current.length - 1] === key ? current : [...current, key]),
        closePanel: () => setHistory([]),
        goBack: () => setHistory((current) => current.slice(0, -1)),
      };
      return <>
        <FamilyGameplayView
          renderSkin="chat"
          scene={fixture.scene}
          messages={fixture.scene.messages}
          highlightedMessageIds={[]}
          selectedElementKeys={selected}
          onSelectElement={(key) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key])}
          panelNavigation={navigation}
          onToggleMessage={vi.fn()}
          onSceneScroll={vi.fn()}
          sceneRef={{ current: null }}
          showNewContent={false}
          onJumpToNewest={vi.fn()}
        />
        <output aria-label="selected keys">{selected.join(",")}</output>
      </>;
    }
    renderThemed(<Harness />);
    fireEvent.click(screen.getByTestId("scene-element-chat-profile"));
    const panel = screen.getByRole("region", { name: "Scene detail panel" });
    expect(within(panel).getByText(/external links and media do not open/i)).toBeTruthy();
    fireEvent.keyDown(within(panel).getByTestId("scene-element-chat-link"), { key: "Enter" });
    expect(screen.getByLabelText("selected keys").textContent).toContain("chat-link");
    fireEvent.click(within(panel).getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("region", { name: "Scene detail panel" })).toBeNull();
  });
});
