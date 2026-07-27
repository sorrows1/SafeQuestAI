import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  familySessionEventReceived,
  familySessionStreamStatusSet,
  selectFamilySessionLastEventId,
} from "./familySessionSlice";
import type { FamilySessionEvent } from "@/types";
import { recordClientTelemetry } from "@/telemetry";

const RECOVERABLE_EVENTS = new Set([
  "state_changed", "reveal", "finding_validated", "checkpoint_response",
  "caregiver_comment", "companion_shared_feedback", "completed", "guide_ready",
]);

/**
 * Authenticated fetch-stream SSE with ordered replay. EventSource cannot carry
 * the bearer token, so this keeps the authorization contract intact and falls
 * back to periodic detail refetches whenever streaming is unavailable.
 */
export function useFamilySessionEvents(
  sessionId: number | string | null,
  onAuthoritativeChange: () => void,
) {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.accessToken);
  const lastEventId = useAppSelector(selectFamilySessionLastEventId);
  const cursor = useRef(lastEventId);

  useEffect(() => {
    cursor.current = Math.max(cursor.current, lastEventId);
  }, [lastEventId]);

  useEffect(() => {
    if (!sessionId || !token) return undefined;
    const controller = new AbortController();
    let pollTimer: number | undefined;
    let reconnectTimer: number | undefined;

    const poll = () => {
      dispatch(familySessionStreamStatusSet("offline"));
      recordClientTelemetry("family.stream.offline", { status: "offline" });
      onAuthoritativeChange();
      pollTimer = window.setInterval(onAuthoritativeChange, 10_000);
    };

    const receive = (block: string) => {
      const id = Number(block.match(/^id:\s*(\d+)$/m)?.[1]);
      const data = block.match(/^data:\s*(.+)$/m)?.[1];
      if (!Number.isInteger(id) || !data) return;
      try {
        const event = JSON.parse(data) as FamilySessionEvent;
        if (event.id !== id || event.id <= cursor.current) return;
        cursor.current = event.id;
        dispatch(familySessionEventReceived(event));
        if (RECOVERABLE_EVENTS.has(event.event_type)) onAuthoritativeChange();
      } catch {
        // A malformed transient event is ignored; the next detail refetch is authoritative.
      }
    };

    const connect = async () => {
      dispatch(familySessionStreamStatusSet(cursor.current ? "reconnecting" : "connecting"));
      if (cursor.current) recordClientTelemetry("family.stream.reconnect", { transport: "sse" });
      try {
        const response = await fetch(`/api/family/sessions/${sessionId}/events`, {
          headers: {
            Authorization: `Bearer ${token}`,
            "Last-Event-ID": String(cursor.current),
          },
          signal: controller.signal,
        });
        if (!response.ok || !response.body) throw new Error("stream unavailable");
        dispatch(familySessionStreamStatusSet("connected"));
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffered = "";
        while (!controller.signal.aborted) {
          const chunk = await reader.read();
          if (chunk.done) break;
          buffered += decoder.decode(chunk.value, { stream: true });
          let boundary = buffered.indexOf("\n\n");
          while (boundary >= 0) {
            receive(buffered.slice(0, boundary));
            buffered = buffered.slice(boundary + 2);
            boundary = buffered.indexOf("\n\n");
          }
        }
        if (!controller.signal.aborted) {
          dispatch(familySessionStreamStatusSet("reconnecting"));
          reconnectTimer = window.setTimeout(() => void connect(), 700);
        }
      } catch {
        if (!controller.signal.aborted) poll();
      }
    };

    void connect();
    return () => {
      controller.abort();
      if (pollTimer) window.clearInterval(pollTimer);
      if (reconnectTimer) window.clearTimeout(reconnectTimer);
      dispatch(familySessionStreamStatusSet("idle"));
    };
  }, [dispatch, onAuthoritativeChange, sessionId, token]);
}
