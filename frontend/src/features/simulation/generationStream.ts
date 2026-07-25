import type { AppDispatch } from '@/store';
import { connectionStatusChanged, messageReceived, runStatusChanged, typingStarted, typingStopped } from './simulationViewerSlice';

interface StreamMessage { id: number; sender: string; content: string; metadata?: { pace?: string; [key: string]: unknown }; }

/**
 * An EventSource-compatible SSE wrapper which uses fetch so the existing Bearer
 * authentication contract is preserved. It only dispatches small Redux actions.
 */
export function openGenerationStream(runId: number, accessToken: string, dispatch: AppDispatch) {
  const abortController = new AbortController();
  let sequence = 0;
  dispatch(connectionStatusChanged('connecting'));

  void (async () => {
    try {
      const response = await fetch(`/api/admin/generation/runs/${runId}/stream`, {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: 'text/event-stream' },
        signal: abortController.signal,
      });
      if (!response.ok || !response.body) throw new Error(`Stream connection failed (${response.status})`);
      dispatch(connectionStatusChanged('connected'));
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!abortController.signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';
        for (const frame of frames) handleFrame(frame, dispatch, () => ++sequence);
      }
      if (!abortController.signal.aborted) dispatch(connectionStatusChanged('disconnected'));
    } catch {
      if (!abortController.signal.aborted) {
        dispatch(connectionStatusChanged('error'));
        dispatch(typingStopped());
      }
    }
  })();

  return () => abortController.abort();
}

function handleFrame(frame: string, dispatch: AppDispatch, nextSequence: () => number) {
  const event = frame.match(/^event:\s*(.+)$/m)?.[1];
  const rawData = frame.match(/^data:\s*(.+)$/m)?.[1];
  if (!event || !rawData) return;
  try {
    const data = JSON.parse(rawData) as StreamMessage & { status?: string };
    if (event === 'typing_start') dispatch(typingStarted());
    if (event === 'turn_complete') dispatch(typingStopped());
    if (event === 'message') dispatch(messageReceived({ id: data.id, sequence: nextSequence(), sender: data.sender, content: data.content, pace: data.metadata?.pace ?? 'normal', metadata: data.metadata }));
    if (event === 'run_status' && data.status) dispatch(runStatusChanged(data.status));
  } catch {
    // Ignore malformed frames; a later valid event still updates the viewer.
  }
}
