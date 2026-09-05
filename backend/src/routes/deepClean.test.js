import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** Deep Clean's routes: one that deletes, and one that streams.
 *
 * executeRules is mocked -- it removes real files. What is under test is
 * which requests reach it, and whether the user's own exclusions travel
 * with them; a clean that ran without the guards would delete out of a
 * folder the user had explicitly told the app to leave alone.
 */

const executeRules = vi.fn(async (ruleIds) => ({ removed: ruleIds.length, bytes: 0 }));
const scanAllRules = vi.fn(() => [{ category: 'System', items: [] }]);
const loadCleanerRules = vi.fn(() => [
  { id: 'temp', category: 'System', name: 'Temporary files' },
  { id: 'thumbs', category: 'System', name: 'Thumbnail cache' },
  { id: 'chrome-cache', category: 'Browsers', name: 'Chrome cache' }
]);
const scanRulesProgressively = vi.fn(async (emit) => {
  emit({ id: 'temp', sizeBytes: 10 });
  emit({ id: 'thumbs', sizeBytes: 20 });
  return { totalBytes: 30 };
});

vi.mock('../lib/cleanerRules.js', () => ({
  executeRules: (...a) => executeRules(...a),
  scanAllRules: (...a) => scanAllRules(...a),
  loadCleanerRules: (...a) => loadCleanerRules(...a),
  scanRulesProgressively: (...a) => scanRulesProgressively(...a)
}));

const guards = { excludeFolders: ['C:\\Keep'], excludeExtensions: ['.psd'] };
vi.mock('../services/settings.js', () => ({
  getSettings: async () => ({ excludeFolders: ['C:\\Keep'], excludeExtensions: ['.psd'] }),
  cleanGuardsFrom: () => guards,
  updateSettings: async (p) => p
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const execute = (body) => server.call('/deep-clean/execute', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

describe('POST /deep-clean/execute', () => {
  it('refuses anything that is not a non-empty list of rules', async () => {
    // An empty or malformed list must not fall through to "clean
    // everything". This is the endpoint that deletes.
    for (const body of [undefined, {}, { ruleIds: [] }, { ruleIds: 'temp' }, { ruleIds: null }]) {
      const res = await execute(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
    }
    expect(executeRules).not.toHaveBeenCalled();
  });

  it("carries the user's exclusions into the deletion", async () => {
    // The guards are what keep a clean out of folders the user has
    // excluded. A clean that ran without them would look identical from
    // outside and would delete things it was told not to.
    const res = await execute({ ruleIds: ['temp', 'thumbs'] });
    expect(res.status).toBe(200);
    expect(executeRules).toHaveBeenCalledWith(['temp', 'thumbs'], guards);
  });

  it('is not reachable by a GET', async () => {
    const res = await server.call('/deep-clean/execute');
    expect(res.status).toBe(404);
    expect(executeRules).not.toHaveBeenCalled();
  });
});

describe('GET /deep-clean/rules', () => {
  it('groups the rules by category with sizes left honestly unmeasured', async () => {
    // null renders as a dash. That is "not measured", which is a
    // different statement from "measured and empty" -- and this endpoint
    // touches no filesystem at all.
    const res = await server.call('/deep-clean/rules');
    expect(res.status).toBe(200);
    expect(res.body.categories.map((c) => c.category)).toEqual(['System', 'Browsers']);
    expect(res.body.categories[0].items).toHaveLength(2);
    for (const category of res.body.categories) {
      for (const item of category.items) {
        expect(item.sizeBytes).toBeNull();
        expect(item.fileCount).toBeNull();
      }
    }
  });
});

describe('GET /deep-clean/scan/stream', () => {
  it('streams a start, a line per rule, and a done', async () => {
    // The one-shot scan takes ~19 seconds and says nothing until it is
    // over, which is indistinguishable from being stuck.
    const res = await fetch(`${server.base}/deep-clean/scan/stream`);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    // A proxy that buffered this would reassemble it into exactly the
    // all-at-once behaviour the stream exists to avoid.
    expect(res.headers.get('x-accel-buffering')).toBe('no');

    const body = await res.text();
    expect(body).toContain('event: start');
    expect(body).toContain('"total":3');
    expect(body).toContain('event: rule');
    expect(body).toContain('"id":"temp"');
    expect(body).toContain('event: done');
    expect(body).toContain('"totalBytes":30');
  });

  it('reports a failure as an error event on the open stream', async () => {
    // The stream has already sent its 200 by the time a rule can fail, so
    // there is no status code left to say anything with.
    scanRulesProgressively.mockRejectedValueOnce(new Error('EACCES'));
    const body = await (await fetch(`${server.base}/deep-clean/scan/stream`)).text();
    expect(body).toContain('event: error');
    expect(body).toContain('EACCES');
    expect(body).not.toContain('event: done');
  });

  it('stops walking the filesystem when the client goes away', async () => {
    // Covers both the Abort button and the user simply navigating away.
    let signal;
    const started = new Promise((resolve) => {
      scanRulesProgressively.mockImplementationOnce(async (emit, options) => {
        signal = options.signal;
        resolve();
        await new Promise((r) => options.signal.addEventListener('abort', r));
        return { totalBytes: 0 };
      });
    });

    const client = new AbortController();
    const request = fetch(`${server.base}/deep-clean/scan/stream`, { signal: client.signal })
      .then((r) => r.text())
      .catch(() => 'gone');
    await started;
    expect(signal.aborted).toBe(false);
    client.abort();
    await request;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });
});
