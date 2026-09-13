import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamDeepCleanScan, streamDeepCleanExecute } from './api.js';

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

describe('streamDeepCleanExecute', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('reports each cleaned rule as it arrives, and carries the ids in the URL', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      body: sseBody([
        'event: start\ndata: {"total":2}\n\n',
        'event: rule\ndata: {"id":"a","name":"A cache","freedBytes":100}\n\n',
        'event: rule\ndata: {"id":"b","name":"B cache","freedBytes":200}\n\n',
        'event: done\ndata: {"aborted":false,"freedBytes":300}\n\n'
      ])
    });

    const events = [];
    await streamDeepCleanExecute(['a', 'b'], (type, data) => events.push([type, data]));

    expect(events.map(([t]) => t)).toEqual(['start', 'rule', 'rule', 'done']);
    expect(events[1][1].name).toBe('A cache');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/deep-clean/execute/stream?ids=a,b'), expect.anything());
  });

  it('URL-encodes rule ids so a stray comma or space cannot split the list', async () => {
    fetch.mockResolvedValueOnce({ ok: true, body: sseBody([]) });
    await streamDeepCleanExecute(['weird id,with comma'], () => {});
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('ids=weird%20id%2Cwith%20comma'), expect.anything());
  });

  it('throws when the stream cannot be opened', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 500, body: null });
    await expect(streamDeepCleanExecute(['a'], () => {})).rejects.toThrow(/500/);
  });
});
