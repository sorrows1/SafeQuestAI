import { describe, expect, it } from "vitest";
import { recordClientTelemetry } from "@/telemetry";

describe("client telemetry", () => {
  it("dispatches only allow-listed, non-content dimensions", () => {
    let detail: unknown;
    const listener = (event: Event) => { detail = (event as CustomEvent).detail; };
    window.addEventListener("safequest:telemetry", listener, { once: true });
    recordClientTelemetry("skin.fallback", { source: "skin_router", reasoning: "private thought", session: "fs_secret" });
    expect(detail).toEqual({ event: "skin.fallback", attributes: { source: "skin_router" } });
  });
});
