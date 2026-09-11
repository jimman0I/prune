import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** /update-check -- the route that decides whether the app is allowed to
 * reach the network at all.
 *
 * The whole promise of the setting is in the first test: with it off,
 * the checker is never called, so no request can leave the machine.
 */

const getSettings = vi.fn();
vi.mock('../services/settings.js', () => ({
  getSettings: (...a) => getSettings(...a),
  updateSettings: vi.fn(),
  settingsPath: vi.fn(),
  cleanGuardsFrom: vi.fn(() => ({}))
}));

const check = vi.fn();
const lastResult = vi.fn();
const openReleasePage = vi.fn(async (url) => ({ ok: true, opened: url }));
vi.mock('../services/updateCheck.js', () => ({
  appVersion: () => '2.3.4',
  updateChecker: { check: (...a) => check(...a), lastResult: (...a) => lastResult(...a) },
  openReleasePage: (...a) => openReleasePage(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  lastResult.mockReturnValue(null);
});

const newer = {
  current: '2.3.4', latest: '2.3.5', newer: true,
  url: 'https://github.com/jimman0I/prune/releases/tag/v2.3.5'
};

describe('GET /update-check', () => {
  it('never checks while the setting is off, and still reports the running version', async () => {
    getSettings.mockResolvedValue({});
    const res = await server.call('/update-check');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: false, current: '2.3.4' });
    expect(check).not.toHaveBeenCalled();
  });

  it('treats anything but an explicit true as off', async () => {
    // A hand-edited settings file saying "true" as a string, or 1, is not
    // consent to reach the network.
    for (const value of ['true', 1, 'yes', null]) {
      getSettings.mockResolvedValue({ updateCheck: value });
      const res = await server.call('/update-check');
      expect(res.body.enabled).toBe(false);
    }
    expect(check).not.toHaveBeenCalled();
  });

  it('checks when the setting is on, and passes the answer through', async () => {
    getSettings.mockResolvedValue({ updateCheck: true });
    check.mockResolvedValue(newer);

    const res = await server.call('/update-check');
    expect(check).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ enabled: true, ...newer });
  });

  it('passes a failed check through as an answer', async () => {
    getSettings.mockResolvedValue({ updateCheck: true });
    check.mockResolvedValue({ current: '2.3.4', error: 'GitHub answered 403' });

    const res = await server.call('/update-check');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ enabled: true, current: '2.3.4', error: 'GitHub answered 403' });
  });
});

describe('POST /update-check/open', () => {
  const open = (body) => server.call('/update-check/open', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {})
  });

  it('opens the page of the newer release the last check found', async () => {
    lastResult.mockReturnValue(newer);
    const res = await open();

    expect(res.status).toBe(200);
    expect(openReleasePage).toHaveBeenCalledWith(newer.url);
  });

  it('ignores any address sent with the request', async () => {
    /* The page comes from the last check, never from the caller. A route
     * that opened whatever URL it was sent would be an "open anything in
     * the browser" button for any code that can reach this API. */
    lastResult.mockReturnValue(newer);
    await open({ url: 'https://evil.example.com/' });
    expect(openReleasePage).toHaveBeenCalledWith(newer.url);
  });

  it('refuses when no check has found a newer release', async () => {
    for (const last of [null, { ...newer, newer: false }]) {
      lastResult.mockReturnValue(last);
      const res = await open();
      expect(res.status).toBe(409);
    }
    expect(openReleasePage).not.toHaveBeenCalled();
  });
});
