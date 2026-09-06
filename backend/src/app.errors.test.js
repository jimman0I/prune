import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from './testSupport/routeServer.js';

/** What a request gets when something goes wrong.
 *
 * Found while probing the uninstall route: a request whose body was not
 * valid JSON got Express's default error page -- HTML, with a full stack
 * trace and absolute paths through node_modules. Every other answer this
 * API gives is JSON with an `error` string, and every client reads it that
 * way, so the one response nobody planned was also the only one shaped
 * differently and the only one describing this machine's filesystem.
 *
 * The four handlers that had no try/catch of their own are covered here
 * too. An async handler that rejects does NOT reach an Express 4 error
 * handler -- the rejection escapes to process level and the request is
 * simply never answered.
 */

const getSystemDriveSpace = vi.fn(async () => ({ freeBytes: 1, totalBytes: 2 }));
vi.mock('./services/diskSpace.js', () => ({ getSystemDriveSpace: (...a) => getSystemDriveSpace(...a) }));

const getRecentHistory = vi.fn(async () => []);
const appendHistoryEntry = vi.fn(async () => {});
vi.mock('./services/uninstallHistory.js', () => ({
  getRecentHistory: (...a) => getRecentHistory(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a)
}));

const scanDriveViaMft = vi.fn(async () => ({ ok: true, tree: {}, stats: {}, driveLetter: 'C' }));
vi.mock('./services/mftScan.js', () => ({ scanDriveViaMft: (...a) => scanDriveViaMft(...a) }));

const emptyQuarantine = vi.fn(async () => ({ ok: true }));
vi.mock('./services/quarantine.js', async (importOriginal) => ({
  ...(await importOriginal()),
  emptyQuarantine: (...a) => emptyQuarantine(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

/** Sends a body express.json() cannot parse. */
const sendBadJson = (path, body = '{"programId": ') => server.call(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body
});

describe('a body that is not valid JSON', () => {
  it('is a 400 in the same shape as every other answer', async () => {
    const res = await sendBadJson('/uninstall');
    expect(res.status).toBe(400);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(typeof res.body.error).toBe('string');
  });

  it('does not describe this machine to whoever asked', async () => {
    // The actual defect. Express's default handler renders err.stack into
    // the page, which named the install directory, the node_modules path
    // and the internals of body-parser and raw-body.
    const raw = JSON.stringify(await sendBadJson('/uninstall'));
    for (const leak of ['node_modules', 'body-parser', 'raw-body', 'C:\\', 'at JSON.parse', '<pre>', 'SyntaxError']) {
      expect(raw, `leaked ${leak}`).not.toContain(leak);
    }
  });

  it('never reaches the handler', async () => {
    // express.json() throws before the route runs, which is the correct
    // order: a request that could not be parsed has not asked for
    // anything, least of all for the quarantine to be emptied.
    const res = await sendBadJson('/quarantine/empty');
    expect(res.status).toBe(400);
    expect(emptyQuarantine).not.toHaveBeenCalled();
  });

  it('is refused for being unparseable, not for being unauthorised', async () => {
    // The guard runs first and would have said 403. This is the ordinary
    // case: our own window sending something malformed.
    const res = await sendBadJson('/settings');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/JSON/i);
  });
});

describe('a body too large to accept', () => {
  it('says so, as JSON, rather than rendering a stack trace', async () => {
    // express.json() caps a body at 100kb. The Disk Map's file-icon
    // request is the one that sends a real list, so this is reachable
    // without anyone being malicious.
    const huge = JSON.stringify({ extensions: Array.from({ length: 40_000 }, (_, i) => `.ext${i}`) });
    const res = await server.call('/file-icons', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: huge
    });
    expect(res.status).toBe(413);
    expect(typeof res.body.error).toBe('string');
    expect(JSON.stringify(res.body)).not.toContain('node_modules');
  });
});

describe('a request for something that is not there', () => {
  it('is a 404 in the same shape as every other answer', async () => {
    // Express's own fallback renders "Cannot GET /api/nope" as HTML. It
    // leaks nothing, but it is the one response in the app a client
    // cannot read the way it reads all the others.
    const res = await server.call('/nope');
    expect(res.status).toBe(404);
    expect(res.headers.get('content-type')).toMatch(/application\/json/);
    expect(typeof res.body.error).toBe('string');
    expect(JSON.stringify(res.body)).not.toContain('<pre>');
  });

  it('says which method and path, because the answer is usually the method', async () => {
    // /uninstall exists; GET is what does not. "There is no such
    // endpoint" would send someone checking the path they already had
    // right.
    const res = await server.call('/uninstall');
    expect(res.status).toBe(404);
    expect(res.body.error).toContain('GET');
    expect(res.body.error).toContain('/api/uninstall');
  });

  it('does not echo an unbounded path back', async () => {
    // The path is the caller's own string. Repeating it is useful and is
    // what the rest of this app's messages do, but a URL has no length
    // limit worth trusting and a log line does.
    const res = await server.call(`/${'x'.repeat(4000)}`);
    expect(res.status).toBe(404);
    expect(res.body.error.length).toBeLessThan(300);
  });

  it('does not intercept a route that does exist', async () => {
    const res = await server.call('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('still comes second to the guard', async () => {
    // A web page asking for a path that does not exist gets 403, not
    // 404. Which endpoints this app does and does not have is not
    // something an untrusted caller gets to map.
    const res = await server.callAsWebPage('/nope');
    expect(res.status).toBe(403);
  });
});

describe('the handlers that had no try/catch of their own', () => {
  // An async handler that rejects does not reach an Express 4 error
  // handler. Before these were fixed the request was never answered at
  // all: the socket stayed open until something else timed out, which
  // from the UI is indistinguishable from a scan that is still running.
  it('answers when the disk-space read fails', async () => {
    getSystemDriveSpace.mockRejectedValueOnce(new Error('WMI unavailable'));
    const res = await server.call('/disk-space');
    expect(res.status).toBe(500);
    expect(typeof res.body.error).toBe('string');
  });

  it('answers when the history read fails', async () => {
    getRecentHistory.mockRejectedValueOnce(new Error('EACCES'));
    const res = await server.call('/uninstall-history');
    expect(res.status).toBe(500);
  });

  it('answers when the history write fails', async () => {
    appendHistoryEntry.mockRejectedValueOnce(new Error('EACCES'));
    const res = await server.call('/uninstall-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ programName: 'Thing' })
    });
    expect(res.status).toBe(500);
  });

  it('answers when the MFT scan throws rather than returning a result', async () => {
    scanDriveViaMft.mockRejectedValueOnce(new Error('elevation failed'));
    const res = await server.call('/mft-scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ driveLetter: 'C' })
    });
    expect(res.status).toBe(500);
  });
});
