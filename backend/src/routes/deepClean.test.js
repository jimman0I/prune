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
const executeRulesProgressively = vi.fn(async (ruleIds, emit) => {
  for (const id of ruleIds) emit({ id, name: id, freedBytes: 5 });
  return { aborted: false, total: ruleIds.length, executed: ruleIds.length, freedBytes: 5 * ruleIds.length };
});
// Presence is a real filesystem question, asked per rule by the /rules
// route. These fixtures name no real paths, so the honest default is
// false; individual tests override it.
const rulePathsExist = vi.fn(() => false);

vi.mock('../lib/cleanerRules.js', () => ({
  executeRules: (...a) => executeRules(...a),
  executeRulesProgressively: (...a) => executeRulesProgressively(...a),
  scanAllRules: (...a) => scanAllRules(...a),
  loadCleanerRules: (...a) => loadCleanerRules(...a),
  scanRulesProgressively: (...a) => scanRulesProgressively(...a),
  rulePathsExist: (...a) => rulePathsExist(...a)
}));

const guards = { excludeFolders: ['C:\\Keep'], excludeExtensions: ['.psd'] };
vi.mock('../services/settings.js', () => ({
  getSettings: async () => ({ excludeFolders: ['C:\\Keep'], excludeExtensions: ['.psd'] }),
  cleanGuardsFrom: () => guards,
  updateSettings: async (p) => p
}));

const listCookieDomains = vi.fn(async () => ({ domains: [{ domain: 'example.com', count: 3 }], errors: [] }));
vi.mock('../lib/cleanerActions/cookieDomains.js', () => ({
  listCookieDomains: (...a) => listCookieDomains(...a)
}));

const listInstalledPrograms = vi.fn(async () => [
  { id: 'league', name: 'League of Legends' },
  { id: 'steam', name: 'Steam' }
]);
vi.mock('../services/programs.js', () => ({
  listInstalledPrograms: (...a) => listInstalledPrograms(...a)
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

describe('GET /deep-clean/execute/stream', () => {
  it('streams a start, a line per cleaned rule, and a done -- the BleachBit-style clean output', async () => {
    const res = await fetch(`${server.base}/deep-clean/execute/stream?ids=temp,thumbs`);
    expect(res.headers.get('content-type')).toMatch(/text\/event-stream/);
    expect(res.headers.get('x-accel-buffering')).toBe('no');

    const body = await res.text();
    expect(body).toContain('event: start');
    expect(body).toContain('"total":2');
    expect(body).toContain('event: rule');
    expect(body).toContain('"id":"temp"');
    expect(body).toContain('event: done');
    expect(body).toContain('"freedBytes":10');
    expect(executeRulesProgressively).toHaveBeenCalledWith(['temp', 'thumbs'], expect.any(Function), expect.objectContaining(guards));
  });

  it('refuses an empty or missing id list rather than cleaning nothing silently', async () => {
    for (const url of ['/deep-clean/execute/stream', '/deep-clean/execute/stream?ids=']) {
      const res = await server.call(url);
      expect(res.status).toBe(400);
    }
    expect(executeRulesProgressively).not.toHaveBeenCalled();
  });

  it('reports a failure as an error event on the open stream', async () => {
    executeRulesProgressively.mockRejectedValueOnce(new Error('locked'));
    const body = await (await fetch(`${server.base}/deep-clean/execute/stream?ids=temp`)).text();
    expect(body).toContain('event: error');
    expect(body).toContain('locked');
    expect(body).not.toContain('event: done');
  });

  it('stops cleaning when the client goes away', async () => {
    let signal;
    const started = new Promise((resolve) => {
      executeRulesProgressively.mockImplementationOnce(async (ids, emit, options) => {
        signal = options.signal;
        resolve();
        await new Promise((r) => options.signal.addEventListener('abort', r));
        return { aborted: true, freedBytes: 0 };
      });
    });

    const client = new AbortController();
    const request = fetch(`${server.base}/deep-clean/execute/stream?ids=temp`, { signal: client.signal })
      .then((r) => r.text())
      .catch(() => 'gone');
    await started;
    expect(signal.aborted).toBe(false);
    client.abort();
    await request;
    await vi.waitFor(() => expect(signal.aborted).toBe(true));
  });
});

describe('GET /deep-clean/rules', () => {
  it('groups the rules by category with sizes left honestly unmeasured', async () => {
    // null renders as a dash. That is "not measured", which is a
    // different statement from "measured and empty".
    //
    // The endpoint does now touch the filesystem, which it did not when
    // this test was written: it asks whether each rule's paths EXIST,
    // which is an existsSync per path rather than the directory walk a
    // size needs. 74 rules in 126ms, against most of a minute for sizes.
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

  it('says whether each rule applies to this machine, before any scan', async () => {
    // Without this the "hide cleaners that don't apply" setting had
    // nothing to filter on until a full scan finished, so the list opened
    // showing Firefox, Opera and Vivaldi to someone who has none of them
    // and the setting looked broken.
    rulePathsExist.mockImplementation((rule) => rule.id === 'temp');
    const res = await server.call('/deep-clean/rules');

    const items = res.body.categories.flatMap((c) => c.items);
    expect(items.find((i) => i.id === 'temp').present).toBe(true);
    expect(items.filter((i) => i.present === false).length).toBe(items.length - 1);
  });
});

describe('GET /deep-clean/cookie-domains', () => {
  it('returns whatever listCookieDomains resolves, verbatim', async () => {
    const res = await server.call('/deep-clean/cookie-domains');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ domains: [{ domain: 'example.com', count: 3 }], errors: [] });
  });

  it('responds 500 with the error message if the scan throws', async () => {
    listCookieDomains.mockRejectedValueOnce(new Error('sqlite3.exe not found'));
    const res = await server.call('/deep-clean/cookie-domains');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('sqlite3.exe not found');
  });
});

describe('the real installed-programs list feeds every scan route', () => {
  it('GET /rules calls rulePathsExist with installedProgramNames built from the real list', async () => {
    await server.call('/deep-clean/rules');
    expect(listInstalledPrograms).toHaveBeenCalled();
    const guardsArg = rulePathsExist.mock.calls[0][1];
    expect(guardsArg.installedProgramNames.has('league of legends')).toBe(true);
    expect(guardsArg.installedProgramNames.has('steam')).toBe(true);
    expect(guardsArg.installedProgramNames.has('epic games launcher')).toBe(false);
  });

  it('GET /scan calls scanAllRules with installedProgramNames merged into the existing guards', async () => {
    await server.call('/deep-clean/scan');
    const guardsArg = scanAllRules.mock.calls[0][0];
    expect(guardsArg.excludeFolders).toEqual(['C:\\Keep']); // the existing settings-derived guard, untouched
    expect(guardsArg.installedProgramNames.has('steam')).toBe(true);
  });

  it('GET /scan/stream calls scanRulesProgressively with installedProgramNames merged into the existing guards', async () => {
    const res = await server.call('/deep-clean/scan/stream');
    void res; // the route streams; reaching here without throwing is enough to prove the guards were built
    const guardsArg = scanRulesProgressively.mock.calls[0][1];
    expect(guardsArg.excludeFolders).toEqual(['C:\\Keep']);
    expect(guardsArg.installedProgramNames.has('league of legends')).toBe(true);
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
