import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /forced-uninstall/scan, and the user's exclusions.
 *
 * The normal uninstall scan has always left out folders the user excluded. The
 * forced scan, the broadest search Prune makes, did not read the list at all.
 * It now applies the same folder list and the registry-key list. */

const scanForcedUninstall = vi.fn();
vi.mock('../services/forcedUninstall.js', () => ({ scanForcedUninstall: (...a) => scanForcedUninstall(...a) }));
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => [] }));

let settings = {};
vi.mock('../services/settings.js', () => ({ getSettings: async () => settings, updateSettings: async (p) => ({ ...settings, ...p }) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  settings = {};
  scanForcedUninstall.mockResolvedValue({
    files: { ok: true, items: [{ path: 'D:\\Keep\\a' }, { path: 'D:\\Other\\b' }] },
    registryKeys: { ok: true, items: [{ path: 'HKEY_CURRENT_USER\\Software\\Vendor' }, { path: 'HKEY_LOCAL_MACHINE\\Software\\Vendor', isUninstallEntry: true }] },
    scheduledTasks: { ok: true, items: [] }
  });
});

const scan = () => server.call('/forced-uninstall/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Vendor' })
});

describe('POST /forced-uninstall/scan', () => {
  it('passes everything through when nothing is excluded', async () => {
    const res = await scan();
    expect(res.status).toBe(200);
    expect(res.body.files.items).toHaveLength(2);
    expect(res.body.registryKeys.items).toHaveLength(2);
  });

  it('leaves out excluded folders and excluded registry keys, and counts them', async () => {
    settings = { excludeFolders: ['D:\\Keep'], excludeRegistryKeys: ['HKCU\\Software\\Vendor'] };
    const res = await scan();
    expect(res.body.files.items.map((i) => i.path)).toEqual(['D:\\Other\\b']);
    expect(res.body.files.excluded).toBe(1);
    expect(res.body.registryKeys.items.map((i) => i.path)).toEqual(['HKEY_LOCAL_MACHINE\\Software\\Vendor']);
    expect(res.body.registryKeys.excluded).toBe(1);
  });
});
