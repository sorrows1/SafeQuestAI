import { describe, expect, it } from "vitest";
import { normalizeSimulationStatus } from "../simulationViewerSlice";

describe("normalizeSimulationStatus", () => {
  it.each([
    ["running", "running"],
    ["paused", "paused"],
    ["awaiting_admin", "awaiting_admin"],
    ["ready_for_review", "ready_for_review"],
    ["approved", "approved"],
    ["rejected", "rejected"],
    ["limit_reached", "limit_reached"],
    ["failed", "failed"],
  ] as const)("preserves runtime status %s", (input, expected) => {
    expect(normalizeSimulationStatus(input)).toBe(expected);
  });

  it("maps queued, legacy, and unknown statuses conservatively", () => {
    expect(normalizeSimulationStatus("queued")).toBe("idle");
    expect(normalizeSimulationStatus("completed")).toBe("completed");
    expect(normalizeSimulationStatus("unexpected")).toBe("idle");
  });
});
