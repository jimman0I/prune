import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** GET /disk-scan/stream and GET /disk-scan/result/:id.
 *
 * The stream carries small, frequent events (progress) and a `complete`
 * message that deliberately does NOT carry the tree: on a big drive the tree
 * is tens of MB and is fetched separately as ordinary JSON.
 */

const scanDirectory = vi.fn();
vi.mock('../services/diskScan.js', () => ({
  scanDirectory: (...a) => scanDirectory(...a),
  DEFAULT_MAX_DEPTH: 4
}));

vi.mock('../services/settings.js', () => ({
  getSettings: async () => ({ excludeFolders: [], excludeExtensions: [] }),
  updateSettings: async (p) => p
}));

const getSystemDriveSpace = vi.fn();
vi.mock('../services/diskSpace.js', () => ({
  getSystemDriveSpace: (...a) => getSystemDriveSpace(...a)
}));

// The real store, wrapped so a test can see whether anything was stored.
const putSpy = vi.fn();
vi.mock('../lib/scanResults.js', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    putScanResult: (...a) => { putSpy(...a); return actual.putScanResult(...a); }
  };
});

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  getSystemDriveSpace.mockResolvedValue(null);
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Reads the whole SSE body and parses it into [{ event, data }]. */
async function readStream(query, options) {
  const res = await fetch(`${server.base}/disk-scan/stream${query}`, options);
  const text = await res.text();
  const events = text.split('\n\n').filter(Boolean).map((block) => {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = JSON.parse(/^data: (.*)$/m.exec(block)[1]);
    return { event, data };
  });
  return { res, events };
}

const TREE = { name: 'Users', size: 30, type: 'directory', children: [{ name: 'a', size: 30, type: 'file' }] };

/** A scan that reports files, then lingers long enough for 200 ms ticks. */
function slowScan({ files = [10, 20], lingerMs = 500, result = TREE } = {}) {
  scanDirectory.mockImplementationOnce(async (path, depth, sig, excl, onFile) => {
    for (const size of files) onFile(size);
    await sleep(lingerMs);
    return result;
  });
}

describe('GET /disk-scan/stream', () => {
  it("sends the scan's own time limit, counting down, so the client never hard-codes it", async () => {
    slowScan({ lingerMs: 700 });
    const { events } = await readStream('?path=C%3A%5CUsers');

    const progress = events.filter((e) => e.event === 'progress');
    expect(progress.length).toBeGreaterThanOrEqual(2);
    for (const p of progress) {
      expect(Number.isFinite(p.data.remainingMs)).toBe(true);
      // The real limit is 30 s from the start of the request.
      expect(p.data.remainingMs).toBeLessThanOrEqual(30_000);
      expect(p.data.remainingMs).toBeGreaterThan(29_000);
    }
    // It is a countdown against a deadline, not a constant.
    expect(progress[progress.length - 1].data.remainingMs).toBeLessThan(progress[0].data.remainingMs);
  });

  it('needs a path, as a plain 400 and not a stream', async () => {
    const res = await fetch(`${server.base}/disk-scan/stream`);
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/json/);
    expect(scanDirectory).not.toHaveBeenCalled();
  });

  it('streams progress events on an interval, then a complete event', async () => {
    slowScan({ lingerMs: 500 });
    const { res, events } = await readStream('?path=C%3A%5CUsers');
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);

    const progress = events.filter((e) => e.event === 'progress');
    // ~500 ms of scanning at one event per ~200 ms.
    expect(progress.length).toBeGreaterThanOrEqual(2);
    expect(progress.length).toBeLessThanOrEqual(4);
    for (const p of progress) {
      expect(p.data).toMatchObject({ type: 'progress', files: 2, bytes: 30 });
    }
    expect(events.at(-1).event).toBe('complete');
    expect(events.filter((e) => e.event === 'complete')).toHaveLength(1);
  });

  it('reports percent null for a folder path and never asks for drive space', async () => {
    slowScan();
    const { events } = await readStream('?path=C%3A%5CUsers');
    const progress = events.filter((e) => e.event === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p.data.percent).toBeNull();
    expect(getSystemDriveSpace).not.toHaveBeenCalled();
  });

  it('reports a real percent for a whole-drive scan of C:', async () => {
    // 1000 in use (total 1500, free 500); 30 bytes processed -> 3 %.
    getSystemDriveSpace.mockResolvedValue({ totalBytes: 1500, freeBytes: 500 });
    slowScan({ files: [10, 20] });
    const { events } = await readStream('?path=C%3A%5C');
    const progress = events.filter((e) => e.event === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p.data.percent).toBe(3);
    expect(getSystemDriveSpace).toHaveBeenCalledTimes(1);
  });

  it('never reports 100, however far past the in-use figure the walk gets', async () => {
    getSystemDriveSpace.mockResolvedValue({ totalBytes: 100, freeBytes: 0 });
    slowScan({ files: [5000] });
    const { events } = await readStream('?path=C%3A%5C');
    const progress = events.filter((e) => e.event === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p.data.percent).toBe(99);
  });

  it('reports percent null when the drive space cannot be read', async () => {
    getSystemDriveSpace.mockRejectedValue(new Error('powershell died'));
    slowScan();
    const { events } = await readStream('?path=C%3A%5C');
    const progress = events.filter((e) => e.event === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p.data.percent).toBeNull();
    expect(events.at(-1).event).toBe('complete');
  });

  it('reports percent null for another drive letter, which has no in-use figure', async () => {
    getSystemDriveSpace.mockResolvedValue({ totalBytes: 1500, freeBytes: 500 });
    slowScan();
    const { events } = await readStream('?path=D%3A%5C');
    const progress = events.filter((e) => e.event === 'progress');
    expect(progress.length).toBeGreaterThan(0);
    for (const p of progress) expect(p.data.percent).toBeNull();
    expect(getSystemDriveSpace).not.toHaveBeenCalled();
  });

  it('complete carries the counts and a resultId but not the tree', async () => {
    slowScan({ lingerMs: 0 });
    const { events } = await readStream('?path=C%3A%5CUsers');
    const complete = events.find((e) => e.event === 'complete').data;
    expect(complete).toMatchObject({ type: 'complete', totalFiles: 2, totalBytes: 30, truncated: false });
    expect(typeof complete.resultId).toBe('string');
    expect(complete).not.toHaveProperty('children');
    expect(complete).not.toHaveProperty('tree');
    expect(JSON.stringify(complete)).not.toContain('Users');
  });

  it('passes the depth cap, a signal and the exclusions to the walk, plus onFile', async () => {
    slowScan({ lingerMs: 0 });
    await readStream('?path=C%3A%5CUsers');
    const [path, depth, signal, exclusions, onFile] = scanDirectory.mock.calls[0];
    expect(path).toBe('C:\\Users');
    expect(depth).toBe(4);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(exclusions).toEqual({ excludeFolders: [], excludeExtensions: [] });
    expect(typeof onFile).toBe('function');
  });

  it('serves the finished tree from /result/:id in the same shape as GET /', async () => {
    slowScan({ lingerMs: 0 });
    const { events } = await readStream('?path=C%3A%5CUsers');
    const { resultId } = events.find((e) => e.event === 'complete').data;
    const res = await server.call(`/disk-scan/result/${resultId}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ...TREE, truncated: false });
  });

  it('is a 404 for an unknown result id', async () => {
    const res = await server.call('/disk-scan/result/not-a-real-id');
    expect(res.status).toBe(404);
    expect(res.body.error).toBeTruthy();
  });

  it('emits an error event when the folder cannot be read', async () => {
    scanDirectory.mockResolvedValueOnce(null);
    const { events } = await readStream('?path=C%3A%5Cnope');
    const last = events.at(-1);
    expect(last.event).toBe('error');
    expect(last.data.type).toBe('error');
    expect(last.data.message).toContain('C:\\nope');
    expect(events.some((e) => e.event === 'complete')).toBe(false);
    expect(putSpy).not.toHaveBeenCalled();
  });

  it('emits a took-too-long error when the deadline passes with nothing to show', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      let signal;
      const started = new Promise((resolve) => {
        scanDirectory.mockImplementationOnce(async (path, depth, sig) => {
          signal = sig;
          resolve();
          await new Promise((r) => sig.addEventListener('abort', r));
          return null;
        });
      });
      const request = readStream('?path=C%3A%5C');
      await started;
      vi.advanceTimersByTime(30_000);
      expect(signal.aborted).toBe(true);
      const { events } = await request;
      expect(events.at(-1).event).toBe('error');
      expect(events.at(-1).data.message).toMatch(/took too long/);
    } finally {
      vi.useRealTimers();
    }
  });

  it('marks a scan that ran out of time but has a partial tree as truncated', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    try {
      const started = new Promise((resolve) => {
        scanDirectory.mockImplementationOnce(async (path, depth, sig) => {
          resolve();
          await new Promise((r) => sig.addEventListener('abort', r));
          return { name: 'C', size: 5, children: [] };
        });
      });
      const request = readStream('?path=C%3A%5C');
      await started;
      vi.advanceTimersByTime(30_000);
      const { events } = await request;
      expect(events.at(-1).event).toBe('complete');
      expect(events.at(-1).data.truncated).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('stops scanning and stores nothing when the client goes away', async () => {
    let signal;
    const started = new Promise((resolve) => {
      scanDirectory.mockImplementationOnce(async (path, depth, sig) => {
        signal = sig;
        resolve();
        await new Promise((r) => sig.addEventListener('abort', r));
        // A real walk hands back its partial tree after an abort.
        return { name: 'C', size: 5, children: [] };
      });
    });

    const client = new AbortController();
    const request = fetch(`${server.base}/disk-scan/stream?path=C%3A%5C`, { signal: client.signal })
      .then((r) => r.text())
      .catch(() => 'gone');
    await started;
    expect(signal.aborted).toBe(false);
    client.abort();
    await request;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
    // Let the route's post-scan code run before asserting on the store.
    await sleep(50);
    expect(putSpy).not.toHaveBeenCalled();
  });
});
