import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamDeepCleanScan } from './api.js';

global.fetch = vi.fn();

/** A ReadableStream of SSE text, delivered in whatever chunks the test
 * asks for -- including chunks that split an event mid-line, which is
 * exactly what a real socket does and the main thing worth testing. */
function sseBody(chunks) {
  const encoder = new TextEncoder();
  let i = 0;
  return {
    getReader: () => ({
      read: async () => (i < chunks.length
        ? { done: false, value: encoder.encode(chunks[i++]) }
        : { done: true, value: undefined })
    })
  };
}

describe('streamDeepCleanScan', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('reports each rule as it arrives, in order', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      body: sseBody([
        'event: start\ndata: {"total":2}\n\n',
        'event: rule\ndata: {"id":"a","sizeBytes":100}\n\n',
        'event: rule\ndata: {"id":"b","sizeBytes":200}\n\n',
        'event: done\ndata: {"aborted":false}\n\n'
      ])
    });

    const events = [];
    await streamDeepCleanScan((type, data) => events.push([type, data]));

    expect(events.map(([t]) => t)).toEqual(['start', 'rule', 'rule', 'done']);
    expect(events[1][1].id).toBe('a');
    expect(events[2][1].id).toBe('b');
  });

  it('handles an event split across two network chunks', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      body: sseBody(['event: rule\ndata: {"id":"a","size', 'Bytes":100}\n\n'])
    });
    const events = [];
    await streamDeepCleanScan((type, data) => events.push([type, data]));
    expect(events).toEqual([['rule', { id: 'a', sizeBytes: 100 }]]);
  });

  it('throws when the stream cannot be opened', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    await expect(streamDeepCleanScan(() => {})).rejects.toThrow(/500/);
  });
});
