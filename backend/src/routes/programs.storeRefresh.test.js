import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /programs/store/refresh: starts a new Store scan behind the list the
 * screen holds, and answers at once. The screen reads the result a few seconds
 * later through GET /store. */

const refreshStoreAppsNow = vi.fn(() => true);
vi.mock('../services/storeApps.js', () => ({
  getStoreApps: async () => [],
  getStorePackage: async () => null,
  forgetStoreApp: () => {},
  refreshStoreAppsNow: (...a) => refreshStoreAppsNow(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

describe('POST /programs/store/refresh', () => {
  it('starts a scan and answers 202 without waiting for it', async () => {
    const res = await server.call('/programs/store/refresh', { method: 'POST' });
    expect(res.status).toBe(202);
    expect(refreshStoreAppsNow).toHaveBeenCalledTimes(1);
  });

  it('takes nothing from the request', async () => {
    await server.call('/programs/store/refresh', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packageFullName: 'x', path: 'C:\\' })
    });
    expect(refreshStoreAppsNow).toHaveBeenCalledWith();
  });

  it('is not reachable by a GET', async () => {
    const res = await server.call('/programs/store/refresh');
    expect(res.status).not.toBe(202);
    expect(refreshStoreAppsNow).not.toHaveBeenCalled();
  });
});
