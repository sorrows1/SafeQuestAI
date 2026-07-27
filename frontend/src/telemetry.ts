/** Privacy-safe client telemetry bridge. It never sends analytics over the network. */
export type ClientTelemetryEvent = "skin.fallback" | "family.stream.reconnect" | "family.stream.offline";

const allowedValues: Record<string, ReadonlySet<string>> = {
  source: new Set(["skin_router"]),
  transport: new Set(["sse"]),
  status: new Set(["offline", "reconnecting"]),
};

export function recordClientTelemetry(event: ClientTelemetryEvent, attributes: Record<string, unknown> = {}) {
  const safeAttributes = Object.fromEntries(
    Object.entries(attributes)
      .filter(([key, value]) => typeof value === "string" && allowedValues[key]?.has(value))
      .map(([key, value]) => [key, value]),
  );
  window.dispatchEvent(new CustomEvent("safequest:telemetry", { detail: { event, attributes: safeAttributes } }));
}
