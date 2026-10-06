import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /programs/store/remove.
 *
 * Two things were wrong with removing a Store app. The route re-ran the whole
 * Store scan (every package folder walked for its size) just to find one
 * package, so the Uninstall button sat for seconds before anything happened.
 * And once the app was gone the cached list still held it, so the screen
 * re-read the list and showed the app that had just been removed. */

const getStorePackage = vi.fn();
const forgetStoreApp = vi.fn();
const getStoreApps = vi.fn(async () => []);
vi.mock('../services/storeApps.js', () => ({
  getStorePackage: (...a) => getStorePackage(...a),
  forgetStoreApp: (...a) => forgetStoreApp(...a),
  getStoreApps: (...a) => getStoreApps(...a)
}));

const removeStoreApp = vi.fn();
vi.mock('../services/removeStoreApp.js', () => ({ removeStoreApp: (...a) => removeStoreApp(...a) }));

const FULL = 'Microsoft.Paint_11.2.0.0_x64__8wekyb3d8bbwe';
const remove = (body) => server.call('/programs/store/remove', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  getStorePackage.mockResolvedValue({ name: 'Paint', packageFullName: FULL, nonRemovable: false });
  removeStoreApp.mockResolvedValue({ ok: true });
});

describe('POST /programs/store/remove', () => {
  it('looks up the one package, and never re-reads the whole Store list', async () => {
    const res = await remove({ packageFullName: FULL });
    expect(res.status).toBe(200);
    expect(getStorePackage).toHaveBeenCalledWith(FULL);
    expect(getStoreApps).not.toHaveBeenCalled();
    expect(removeStoreApp).toHaveBeenCalledWith({ name: 'Paint', packageFullName: FULL, nonRemovable: false });
  });

  it('takes the removed app out of the cached list, so the screen stops showing it', async () => {
    const res = await remove({ packageFullName: FULL });
    expect(res.body).toEqual({ ok: true, name: 'Paint' });
    expect(forgetStoreApp).toHaveBeenCalledWith(FULL);
  });

  it('leaves the cached list alone when the removal failed', async () => {
    removeStoreApp.mockResolvedValue({ ok: false, error: 'The app is running.' });
    const res = await remove({ packageFullName: FULL });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('The app is running.');
    expect(forgetStoreApp).not.toHaveBeenCalled();
  });

  it('says the app is no longer installed when Windows does not know the package', async () => {
    getStorePackage.mockResolvedValue(null);
    const res = await remove({ packageFullName: FULL });
    expect(res.status).toBe(404);
    expect(removeStoreApp).not.toHaveBeenCalled();
  });

  it('refuses a request with no package name', async () => {
    for (const body of [{}, { packageFullName: '' }, { packageFullName: 5 }]) {
      expect((await remove(body)).status).toBe(400);
    }
    expect(getStorePackage).not.toHaveBeenCalled();
  });
});
