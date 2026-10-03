import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** Changing the app's language brings the right-click menu's captions with it.
 *
 * The captions are text in the registry (services/explorerMenu.js), so a
 * language change is the one settings save that has to reach them. It is only
 * ever a repair of entries that already exist -- never a creation -- and a save
 * that does not touch the language does not read the registry at all. */

const stored = { theme: 'dark', language: 'en' };
const updateSettings = vi.fn(async (partial) => ({ ...stored, ...partial }));
const repair = vi.hoisted(() => vi.fn());
vi.mock('../services/settings.js', () => ({
  getSettings: async () => stored,
  updateSettings: (...a) => updateSettings(...a)
}));
vi.mock('../services/explorerMenu.js', () => ({
  getExplorerMenu: vi.fn(), setExplorerMenu: vi.fn(), repairExplorerMenu: (...a) => repair(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); repair.mockResolvedValue({ action: 'none' }); });

const put = (body) => server.call('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('PUT /settings and the menu captions', () => {
  it('repairs the captions after a language change is saved', async () => {
    const res = await put({ language: 'el' });
    expect(res.status).toBe(200);
    expect(repair).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.invocationCallOrder[0]).toBeLessThan(repair.mock.invocationCallOrder[0]);
  });

  it('leaves the registry alone when the save has nothing to do with the language', async () => {
    await put({ theme: 'light' });
    await put({ minimizeToTray: true });
    expect(repair).not.toHaveBeenCalled();
  });

  it('a repair that fails does not fail the save', async () => {
    repair.mockRejectedValue(new Error('Access is denied'));
    const res = await put({ language: 'de' });
    expect(res.status).toBe(200);
    expect(res.body.language).toBe('de');
  });

  it('a failed save never touches the registry', async () => {
    updateSettings.mockRejectedValueOnce(new Error('EACCES'));
    const res = await put({ language: 'fr' });
    expect(res.status).toBe(500);
    expect(repair).not.toHaveBeenCalled();
  });
});
