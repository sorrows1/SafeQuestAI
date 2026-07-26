/** Privacy-safe client telemetry bridge. It never sends analytics over the network. */
export type ClientTelemetryEvent = "skin.fallback" | "family.stream.reconnect" | "family.stream.offline";

const allowedKeys = new Set(["source", "status", "transport"]);

export function recordClientTelemetry(event: ClientTelemetryEvent, attributes: Record<string, unknown> = {}) {
  const safeAttributes = Object.fromEntries(
    Object.entries(attributes)
      .filter(([key, value]) => allowedKeys.has(key) && (typeof value === "string" || typeof value === "boolean" || typeof value === "number"))
      .map(([key, value]) => [key, typeof value === "string" ? value.slice(0, 80) : value]),
  );
  window.dispatchEvent(new CustomEvent("safequest:telemetry", { detail: { event, attributes: safeAttributes } }));
}
