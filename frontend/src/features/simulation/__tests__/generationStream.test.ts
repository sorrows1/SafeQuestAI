import { configureStore } from '@reduxjs/toolkit';
import { openGenerationStream } from '../generationStream';
import reducer, { selectSimulationMessages, runStarted } from '../simulationViewerSlice';

describe('generation stream', () => {
  it('applies mocked SSE events in order, including a regenerate sequence', async () => {
    const frames = [
      'event: typing_start\ndata: {"sender":"initiator"}\n\n',
      'event: message\ndata: {"id":10,"sender":"initiator","content":"first","metadata":{"pace":"normal"}}\n\n',
      'event: turn_complete\ndata: {"sender":"initiator"}\n\n',
      'event: run_status\ndata: {"run_id":7,"status":"reset"}\n\n',
      'event: message\ndata: {"id":11,"sender":"respondent","content":"regenerated","metadata":{"pace":"quick"}}\n\n',
      'event: run_status\ndata: {"run_id":7,"status":"pending"}\n\n',
    ].join('');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(frames, { status: 200 })));
    const store = configureStore({ reducer: { simulationViewer: reducer } });
    store.dispatch(runStarted(7));
    openGenerationStream(7, 'token', store.dispatch as any);
    await vi.waitFor(() => expect(selectSimulationMessages(store.getState() as any)).toHaveLength(2));
    const messages = selectSimulationMessages(store.getState() as any);
    expect(messages.map((message) => message.content)).toEqual(['first', 'regenerated']);
    expect(store.getState().simulationViewer.typing).toBe(false);
    expect(store.getState().simulationViewer.runStatus).toBe('completed');
  });
});
