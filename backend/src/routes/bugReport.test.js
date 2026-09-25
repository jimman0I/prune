import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** /bug-report -- opens a prefilled GitHub issue in the browser.
 *
 * The opener is swapped for a spy so no test launches a browser. What
 * matters here is that the address is built by the server from the title
 * and description alone. */

const opener = vi.fn();
vi.mock('../services/bugReport.js', async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    openBugReport: (input) => real.openBugReport(input, (...a) => { opener(...a); a.at(-1)(null); })
  };
});

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const post = (body) => server.call('/bug-report/open', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body ?? {})
});

describe('GET /bug-report/info', () => {
  it('answers the version, Windows version and architecture', async () => {
    const res = await server.call('/bug-report/info');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(['arch', 'version', 'windows']);
    for (const value of Object.values(res.body)) expect(typeof value).toBe('string');
  });
});

describe('POST /bug-report/open', () => {
  it('opens a prefilled issue built from the title and description', async () => {
    const res = await post({ title: 'Crash', description: 'It closed & vanished' });
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const opened = new URL(res.body.opened);
    expect(opened.origin + opened.pathname).toBe('https://github.com/jimman0I/prune/issues/new');
    expect(opened.searchParams.get('title')).toBe('Crash');
    expect(opened.searchParams.get('body')).toContain('It closed & vanished');
    expect(opener).toHaveBeenCalledTimes(1);
    expect(opener.mock.calls[0][1][0]).toBe(res.body.opened);
  });

  it('ignores any address sent with the request', async () => {
    /* Same rule as /update-check/open: the endpoint must never be an "open
     * anything in the browser" button for code that can reach this API. */
    const res = await post({ url: 'https://evil.example.com/', title: 't', description: 'd' });
    expect(res.status).toBe(200);
    expect(res.body.opened.startsWith('https://github.com/jimman0I/prune/issues/new?')).toBe(true);
    expect(opener.mock.calls[0][1][0].startsWith('https://github.com/jimman0I/prune/issues/new?')).toBe(true);
    expect(opener.mock.calls[0][1][0]).not.toContain('evil.example.com');
  });

  it('refuses an empty description without opening anything', async () => {
    const res = await post({ title: 't', description: '   ' });
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe('string');
    expect(opener).not.toHaveBeenCalled();
  });

  it('refuses a body with no description at all', async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(opener).not.toHaveBeenCalled();
  });
});
