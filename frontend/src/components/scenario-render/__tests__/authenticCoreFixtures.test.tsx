import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { ThemeProvider, createTheme } from "@mui/material";
import { describe, expect, it, vi } from "vitest";
import { FamilyGameplayView } from "@/pages/family/FamilyGameplayView";
import { SkinRouter, skinRegistry } from "../SkinRouter";
import { authenticCoreFixtures, fixtureMatrix, type SkinFixture } from "../fixtures/authenticCoreFixtures";
import type { FamilyScene, RenderSkin } from "@/types";
import type { ScenePanelNavigation } from "../types";

const theme = createTheme();

function renderThemed(node: React.ReactElement) {
  return render(<ThemeProvider theme={theme}>{node}</ThemeProvider>);
}

const fixtureEntries = Object.entries(authenticCoreFixtures) as Array<[RenderSkin, SkinFixture]>;

describe("Phase 5 skin registry contract", () => {
  it("declares a versioned, responsive fixture for every registered skin", () => {
    expect(Object.keys(authenticCoreFixtures).sort()).toEqual(Object.keys(skinRegistry).sort());
    for (const [skin, fixture] of fixtureEntries) {
      expect(skinRegistry[skin].version).toBe("1.0");
      expect(skinRegistry[skin].responsiveModes).toEqual(["default", "compact"]);
      expect(skinRegistry[skin].previewFixture).toBeTruthy();
      expect(fixture.id).toBeTruthy();
    }
    expect(fixtureMatrix.themes).toEqual(["light", "dark"]);
    expect(fixtureMatrix.viewports).toEqual(["mobile", "tablet", "desktop"]);
    expect(fixtureMatrix.interactionStates).toContain("validated_concern");
  });

  it("runs selection, keyboard, completed, and read-only behavior through every registry entry", () => {
    for (const [skin, fixture] of fixtureEntries) {
      const select = vi.fn();
      const { rerender, unmount } = renderThemed(
        <SkinRouter scene={fixture.scene} renderSkin={skin} selection={{ selectedElementKeys: [] }} onSelect={select} />,
      );
      const target = screen.getByTestId(`scene-element-${fixture.safeElementKey}`);
      fireEvent.keyDown(target, { key: "Enter" });
      expect(select).toHaveBeenCalledWith(fixture.safeElementKey);
      expect(target.getAttribute("role")).toBe("button");

      rerender(
        <ThemeProvider theme={theme}>
          <SkinRouter
            scene={fixture.scene}
            renderSkin={skin}
            selection={{ selectedElementKeys: [], completedElementKeys: [fixture.safeElementKey] }}
            onSelect={select}
          />
        </ThemeProvider>,
      );
      expect(screen.getByTestId("scene-element-" + fixture.safeElementKey).getAttribute("aria-label")).toMatch(/discussion completed/i);
      expect(screen.getByText("DISCUSSION COMPLETED")).toBeTruthy();

      rerender(
        <ThemeProvider theme={theme}>
          <SkinRouter scene={fixture.scene} renderSkin={skin} selection={{ selectedElementKeys: [] }} onSelect={select} readOnly />
        </ThemeProvider>,
      );
      const readOnlyTarget = screen.getByTestId(`scene-element-${fixture.safeElementKey}`);
      expect(readOnlyTarget.getAttribute("role")).toBeNull();
      fireEvent.click(readOnlyTarget);
      expect(select).toHaveBeenCalledTimes(1);
      unmount();
    }
  });

  it("uses the accessible fallback for unsupported versions and unsafe presentation tokens", () => {
    const fixture = authenticCoreFixtures.chat;
    const select = vi.fn();
    const unsupportedVersion = { ...fixture.scene, skin_version: "2.0" } as unknown as FamilyScene;
    const { rerender } = renderThemed(
      <SkinRouter scene={unsupportedVersion} renderSkin="chat" selection={{ selectedElementKeys: [] }} onSelect={select} />,
    );
    expect(screen.getByRole("region", { name: "Generic scenario view" })).toBeTruthy();

    const unsafeScene = {
      ...fixture.scene,
      elements: fixture.scene.elements.map((element) => element.element_key === "chat-link"
        ? { ...element, presentation: { ...element.presentation, href: "https://example.invalid" } }
        : element),
    };
    rerender(
      <ThemeProvider theme={theme}>
        <SkinRouter scene={unsafeScene} renderSkin="chat" selection={{ selectedElementKeys: [] }} onSelect={select} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("region", { name: "Generic scenario view" })).toBeTruthy();
    fireEvent.keyDown(screen.getByTestId("scene-element-chat-link"), { key: "Enter" });
    expect(select).toHaveBeenCalledWith("chat-link");
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
