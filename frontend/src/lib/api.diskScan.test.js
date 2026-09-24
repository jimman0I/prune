import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchDiskScan, stopDiskScan } from './api.js';

global.fetch = vi.fn();

describe('fetchDiskScan', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('returns the scan tree on success', async () => {
    const tree = { name: 'C:\\', size: 1000, children: [{ name: 'a.txt', size: 1000 }] };
    fetch.mockResolvedValueOnce({ ok: true, json: async () => tree });
    const result = await fetchDiskScan('C:\\');
    expect(result).toEqual(tree);
  });

  it('URL-encodes the path query param', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'x', size: 0 }) });
    await fetchDiskScan('C:\\Users\\Jim\\My Documents');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent('C:\\Users\\Jim\\My Documents')), expect.anything());
  });

  it('throws on API error', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Could not read "X" -- it may not exist or may not be accessible.' }) });
    await expect(fetchDiskScan('X')).rejects.toThrow('Could not read "X"');
  });

  // Lets a caller (DiskMap.jsx) actually cancel the underlying HTTP request
  // -- e.g. on unmount or when the user navigates to a different folder
  // before a huge scan finishes -- rather than leaving it running unheard.
  it('forwards an AbortSignal to fetch', async () => {
    const controller = new AbortController();
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'x', size: 0 }) });
    await fetchDiskScan('C:\\', controller.signal);
    expect(fetch).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ signal: controller.signal }));
  });

  it('without onProgress it does not touch the stream endpoint', async () => {
    fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'x', size: 0 }) });
    await fetchDiskScan('C:\\', undefined, {});
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0][0]).not.toContain('/disk-scan/stream');
  });
});

/** SSE text delivered in the given chunks, shaped like a fetch body. */
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
const sse = (type, data) => `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;

describe('fetchDiskScan with onProgress', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  const tree = { name: 'C:\\', size: 5, children: [] };
  const complete = { type: 'complete', totalFiles: 3, totalBytes: 5, truncated: false, resultId: 'abc 1' };

  it('streams progress, then fetches the result by id and returns the tree', async () => {
    const p1 = { type: 'progress', files: 1, bytes: 2, percent: 10 };
    const p2 = { type: 'progress', files: 2, bytes: 4, percent: null };
    fetch
      .mockResolvedValueOnce({ ok: true, body: sseBody([sse('progress', p1), sse('progress', p2), sse('complete', complete)]) })
      .mockResolvedValueOnce({ ok: true, json: async () => tree });

    const events = [];
    const controller = new AbortController();
    const result = await fetchDiskScan('C:\\Users\\Jim', controller.signal, { onProgress: (e) => events.push(e) });

    expect(result).toEqual(tree);
    expect(events).toEqual([p1, p2, complete]);
    expect(fetch.mock.calls[0][0]).toContain(`/disk-scan/stream?path=${encodeURIComponent('C:\\Users\\Jim')}`);
    expect(fetch.mock.calls[1][0]).toContain('/disk-scan/result/abc%201');
    expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ signal: controller.signal }));
  });

  it('rejects with the message of an error event', async () => {
    fetch.mockResolvedValueOnce({ ok: true, body: sseBody([sse('error', { message: 'Scan timed out' })]) });
    await expect(fetchDiskScan('C:\\', undefined, { onProgress: () => {} })).rejects.toThrow('Scan timed out');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('throws when the stream ends without complete or error', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      body: sseBody([sse('progress', { type: 'progress', files: 1, bytes: 1, percent: null })])
    });
    await expect(fetchDiskScan('C:\\', undefined, { onProgress: () => {} })).rejects.toThrow(/ended/i);
  });

  it('throws the server error when the result fetch fails', async () => {
    fetch
      .mockResolvedValueOnce({ ok: true, body: sseBody([sse('complete', complete)]) })
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: 'Scan result expired' }) });
    await expect(fetchDiskScan('C:\\', undefined, { onProgress: () => {} })).rejects.toThrow('Scan result expired');
  });
});

describe('scan stop', () => {
  beforeEach(() => { vi.resetAllMocks(); });

  it('forwards the start event, which carries the id Stop needs', async () => {
    const onProgress = vi.fn();
    fetch
      .mockResolvedValueOnce({
        ok: true,
        body: sseBody([
          sse('start', { type: 'start', scanId: 'abc-123', remainingMs: 30000 }),
          sse('complete', { type: 'complete', totalFiles: 1, totalBytes: 1, truncated: true, resultId: 'r1' })
        ])
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ name: 'x', size: 1 }) });

    await fetchDiskScan('C:\\', undefined, { onProgress });

    expect(onProgress).toHaveBeenCalledWith({ type: 'start', scanId: 'abc-123', remainingMs: 30000 });
  });

  it('stopDiskScan POSTs to the stop endpoint with the id encoded', async () => {
    fetch.mockResolvedValueOnce({ ok: true });
    expect(await stopDiskScan('a/b c')).toBe(true);

    const [url, options] = fetch.mock.calls[0];
    expect(url).toContain('/disk-scan/stop/a%2Fb%20c');
    expect(options.method).toBe('POST');
  });

  it('stopDiskScan resolves false, never throws, for a scan that already ended or a dead backend', async () => {
    fetch.mockResolvedValueOnce({ ok: false, status: 404 });
    expect(await stopDiskScan('gone')).toBe(false);
    fetch.mockRejectedValueOnce(new Error('network'));
    expect(await stopDiskScan('gone')).toBe(false);
  });
});
