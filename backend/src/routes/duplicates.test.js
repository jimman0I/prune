import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The duplicate-scan endpoint's refusals.
 *
 * findDuplicates is mocked because it hashes real files; what is under
 * test is which requests are allowed to reach it at all, and what it is
 * handed when they are.
 */

const findDuplicates = vi.fn(async () => ({ groups: [], scanned: 0 }));
vi.mock('../services/duplicateScan.js', () => ({
  findDuplicates: (...a) => findDuplicates(...a)
}));

let settings = { excludeFolders: ['C:\\Users\\x\\Keep'], excludeExtensions: ['.iso'] };
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (p) => p
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const scan = (query) => server.call(`/duplicates${query}`);

describe('GET /duplicates', () => {
  it('needs a folder', async () => {
    expect((await scan('')).status).toBe(400);
    expect((await scan('?path=')).status).toBe(400);
    expect((await scan('?path=%20%20')).status).toBe(400);
    expect(findDuplicates).not.toHaveBeenCalled();
  });

  it('refuses a drive root and Windows itself, and says which', async () => {
    // Not because this deletes anything -- it does not -- but because a
    // scan rooted there spends two minutes and finds nothing anyone
    // should act on. The reason travels so the UI can print it.
    for (const path of ['C:\\', 'C:\\Windows', 'C:\\Windows\\System32']) {
      const res = await scan(`?path=${encodeURIComponent(path)}`);
      expect(res.status, path).toBe(400);
      expect(res.body.protected, path).toBe(true);
      expect(typeof res.body.error).toBe('string');
    }
    expect(findDuplicates).not.toHaveBeenCalled();
  });

  it("hands the scan the user's own exclusions, read fresh per request", async () => {
    // Read per scan rather than cached: they are edited on the Settings
    // screen, and a stale copy would search a folder the user has just
    // told the app to ignore.
    settings = { excludeFolders: ['A'], excludeExtensions: ['.zip'] };
    await scan('?path=C%3A%5CUsers%5Cx%5CDownloads');
    const [root, options] = findDuplicates.mock.calls[0];
    expect(root).toBe('C:\\Users\\x\\Downloads');
    expect(options.exclusions).toEqual({ excludeFolders: ['A'], excludeExtensions: ['.zip'] });
  });

  it('gives the scan an abort signal, so it is bounded rather than open-ended', async () => {
    // The route owns both bounds -- a timeout and the client going away.
    // A scan handed no signal is a hashing loop nobody can stop.
    //
    // Read at call time, not afterwards: req.on('close') fires on normal
    // completion too, so by the time the response has been read the
    // signal is legitimately aborted and an assertion made here would be
    // testing the wrong moment.
    let seen;
    findDuplicates.mockImplementationOnce(async (root, options) => {
      seen = { signal: options.signal, aborted: options.signal.aborted };
      return { groups: [] };
    });
    await scan('?path=C%3A%5CUsers%5Cx%5CDownloads');
    expect(seen.signal).toBeInstanceOf(AbortSignal);
    expect(seen.aborted).toBe(false);
  });

  it('stops scanning when the client goes away', async () => {
    // A user who navigates off the Duplicates screen mid-scan should not
    // leave a hashing loop running against their disk.
    let signal;
    const reachedTheScan = new Promise((resolve) => {
      findDuplicates.mockImplementationOnce(async (root, options) => {
        signal = options.signal;
        resolve();
        // Never settles on its own. The only way out is the abort.
        await new Promise((r) => options.signal.addEventListener('abort', r));
        return { groups: [] };
      });
    });

    const client = new AbortController();
    const request = server.call('/duplicates?path=C%3A%5CUsers%5Cx%5CDownloads', { signal: client.signal })
      .catch(() => 'client gone');
    await reachedTheScan;
    expect(signal.aborted).toBe(false);

    client.abort();
    await request;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });

  it('reports a failed scan as a 500 rather than an empty result', async () => {
    // An empty groups list means "searched, found nothing", which is a
    // different answer from "the search broke".
    findDuplicates.mockRejectedValueOnce(new Error('EACCES'));
    const res = await scan('?path=C%3A%5CUsers%5Cx%5CDownloads');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('EACCES');
  });
});
