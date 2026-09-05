import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** How the Disk Map's scan endpoint reports the ways a scan can end.
 *
 * Three of them are not success, and they are genuinely different: the
 * folder is not there, the scan ran out of time with nothing to show, and
 * the scan ran out of time with a partial answer. Collapsing any pair of
 * those loses the thing the user needs to know.
 */

const scanDirectory = vi.fn(async () => ({ name: 'Downloads', size: 100, children: [] }));
vi.mock('../services/diskScan.js', () => ({
  scanDirectory: (...a) => scanDirectory(...a),
  DEFAULT_MAX_DEPTH: 4
}));

let settings = { excludeFolders: ['C:\\Keep'], excludeExtensions: ['.iso'] };
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (p) => p
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const scan = (q, options) => server.call(`/disk-scan${q}`, options);

/** Runs a request whose scan hangs until the route's own deadline fires.
 *
 * The deadline is a module constant, so the only way to reach that branch
 * without waiting 30 real seconds is to fake setTimeout -- and only
 * setTimeout, so the socket machinery underneath fetch keeps working. */
async function scanUntilDeadline(result) {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  try {
    let signal;
    const started = new Promise((resolve) => {
      scanDirectory.mockImplementationOnce(async (path, depth, sig) => {
        signal = sig;
        resolve();
        await new Promise((r) => sig.addEventListener('abort', r));
        return result;
      });
    });
    const request = scan('?path=C%3A%5C');
    await started;
    vi.advanceTimersByTime(30_000);
    expect(signal.aborted).toBe(true);
    return await request;
  } finally {
    vi.useRealTimers();
  }
}

describe('GET /disk-scan', () => {
  it('needs a path', async () => {
    const res = await scan('');
    expect(res.status).toBe(400);
    expect(scanDirectory).not.toHaveBeenCalled();
  });

  it('is a 404 when the folder could not be read', async () => {
    scanDirectory.mockResolvedValueOnce(null);
    const res = await scan('?path=C%3A%5Cnope');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('C:\\nope');
  });

  it('says a complete scan is complete', async () => {
    const res = await scan('?path=C%3A%5CUsers');
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(false);
  });

  it("marks a scan that ran out of time as truncated rather than pretending it's complete", async () => {
    // The size totals of a truncated scan are a real but incomplete lower
    // bound. A client that could not tell the difference would show a
    // wrong number with the same confidence as a right one.
    const res = await scanUntilDeadline({ name: 'C', size: 5, children: [] });
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(true);
  });

  it('is a 504, not a 404, when the deadline passed before there was anything to show', async () => {
    // Both come back from the walk as null, and they are opposite
    // answers: one means the folder is not there, the other means it is
    // there and too big to finish. Reporting the timeout as "could not
    // read C:\" would send the user looking for a problem that is not
    // theirs.
    const res = await scanUntilDeadline(null);
    expect(res.status).toBe(504);
    expect(res.body.error).toMatch(/took too long/);
  });

  it("passes the user's exclusions and the depth cap to the walk", async () => {
    settings = { excludeFolders: ['C:\\Games'], excludeExtensions: ['.vhdx'] };
    await scan('?path=C%3A%5CUsers');
    const [path, depth, signal, exclusions] = scanDirectory.mock.calls[0];
    expect(path).toBe('C:\\Users');
    expect(depth).toBe(4);
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(exclusions).toEqual({ excludeFolders: ['C:\\Games'], excludeExtensions: ['.vhdx'] });
  });

  it('stops scanning when the client goes away', async () => {
    // The bug this bounds was found dogfooding: a scan of a real "C:\"
    // pegged the process and every other route queued behind it. A user
    // who navigates off the screen should not leave that running.
    let signal;
    const started = new Promise((resolve) => {
      scanDirectory.mockImplementationOnce(async (path, depth, sig) => {
        signal = sig;
        resolve();
        await new Promise((r) => sig.addEventListener('abort', r));
        return null;
      });
    });

    const client = new AbortController();
    const request = scan('?path=C%3A%5C', { signal: client.signal }).catch(() => 'gone');
    await started;
    expect(signal.aborted).toBe(false);
    client.abort();
    await request;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });
});
