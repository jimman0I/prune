import { describe, it, expect, vi, beforeEach } from 'vitest';
import { previewShred, streamShred } from './api.js';

global.fetch = vi.fn();

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

beforeEach(() => { vi.resetAllMocks(); });

describe('previewShred', () => {
  it('POSTs the paths and returns the counts', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ files: 3, bytes: 12, refused: [], truncated: false }) });
    const preview = await previewShred(['C:\\a', 'C:\\b']);
    expect(preview.files).toBe(3);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/shred\/preview$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ paths: ['C:\\a', 'C:\\b'] });
  });

  it("throws the server's message", async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 400, json: async () => ({ error: 'Give at least one file or folder to shred.' }) });
    await expect(previewShred([])).rejects.toThrow(/at least one/);
  });
});

describe('streamShred', () => {
  it('POSTs the paths, the passes and the confirmation, and reports events in order', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      body: sseBody([
        'event: start\ndata: {"passes":3}\n\n',
        'event: progress\ndata: {"filesDone":1,"bytesDone":5}\n\n',
        'event: done\ndata: {"shreddedFiles":1,"bytes":5}\n\n'
      ])
    });

    const events = [];
    await streamShred(['C:\\a'], 3, (type, data) => events.push([type, data]));

    expect(events.map(([t]) => t)).toEqual(['start', 'progress', 'done']);
    const [url, init] = fetch.mock.calls[0];
    expect(url).toMatch(/\/shred$/);
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({ paths: ['C:\\a'], passes: 3, confirmed: true });
  });

  it('passes the abort signal through, so Stop really closes the connection', async () => {
    fetch.mockResolvedValueOnce({ ok: true, body: sseBody([]) });
    const controller = new AbortController();
    await streamShred(['C:\\a'], 1, () => {}, controller.signal);
    expect(fetch.mock.calls[0][1].signal).toBe(controller.signal);
  });

  it('throws when the stream cannot be opened, with the server message when there is one', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 400, body: null, json: async () => ({ error: 'Shredding has to be confirmed.' }) });
    await expect(streamShred(['C:\\a'], 1, () => {})).rejects.toThrow(/confirmed|400/);
  });
});
