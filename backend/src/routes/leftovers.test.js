import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /leftovers/scan, and the user's excluded folders.
 *
 * Settings -> Cleanup -> exclusions already kept Deep Clean and the Disk
 * Map out of chosen folders. The leftover scan ignored them, so a folder
 * the user had said never to touch could still be offered -- ticked by
 * default -- after an uninstall whose name happened to match it. Revo
 * excludes folders from its leftover scan for the same reason.
 */

const scanForLeftovers = vi.fn();
vi.mock('../services/leftoverScan.js', () => ({ scanForLeftovers: (...a) => scanForLeftovers(...a) }));

let settings = {};
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (p) => ({ ...settings, ...p })
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  settings = {};
  scanForLeftovers.mockResolvedValue({
    files: { ok: true, items: [
      { path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', sizeBytes: 10 },
      { path: 'C:\\Users\\jim\\AppData\\Roaming\\Keep\\Thing', sizeBytes: 20 },
      { path: 'D:\\Keep', sizeBytes: 30 },
      { path: 'D:\\Keeper', sizeBytes: 40 }
    ] },
    registryKeys: { ok: true, items: [{ path: 'HKCU\\Software\\Thing' }] },
    scheduledTasks: { ok: true, items: [] }
  });
});

const scan = (extra = {}) => server.call('/leftovers/scan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Thing', publisher: 'Acme', ...extra })
});

describe('POST /leftovers/scan: mode and anchors', () => {
  it('uses the mode in the request', async () => {
    await scan({ mode: 'advanced' });
    expect(scanForLeftovers).toHaveBeenCalledWith(expect.objectContaining({ mode: 'advanced' }));
  });

  it('falls back to the remembered mode, then to Moderate', async () => {
    settings = { leftoverScanMode: 'safe' };
    await scan();
    expect(scanForLeftovers).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'safe' }));
    settings = {};
    await scan();
    expect(scanForLeftovers).toHaveBeenLastCalledWith(expect.objectContaining({ mode: 'moderate' }));
  });

  it('turns an unrecognised mode into Moderate rather than passing it on', async () => {
    await scan({ mode: 'everything' });
    expect(scanForLeftovers).toHaveBeenCalledWith(expect.objectContaining({ mode: 'moderate' }));
  });

  it('hands the scanner the program\'s anchors, strings only', async () => {
    await scan({ anchors: { installLocation: 'D:\\Games\\Thing', registryKey: 'HKCU:\\Software\\Thing', evil: 'x', displayIcon: 42 } });
    expect(scanForLeftovers).toHaveBeenCalledWith(expect.objectContaining({
      anchors: { installLocation: 'D:\\Games\\Thing', registryKey: 'HKCU:\\Software\\Thing' }
    }));
  });

  it('copes with anchors that are not an object', async () => {
    for (const anchors of ['D:\\x', 5, null, ['a']]) {
      const res = await scan({ anchors });
      expect(res.status).toBe(200);
    }
  });
});

describe('POST /leftovers/scan', () => {
  it('passes every result through when nothing is excluded', async () => {
    const res = await scan();
    expect(res.body.files.items).toHaveLength(4);
  });

  it('leaves out anything at or under an excluded folder', async () => {
    settings = { excludeFolders: ['C:\\Users\\jim\\AppData\\Roaming\\Keep', 'd:/keep/'] };
    const res = await scan();
    expect(res.body.files.items.map((i) => i.path)).toEqual([
      'C:\\Users\\jim\\AppData\\Roaming\\Thing',
      // "D:\Keeper" starts with "D:\Keep" as text and is not inside it.
      'D:\\Keeper'
    ]);
  });

  it('says how many it left out, so the review can mention it', async () => {
    settings = { excludeFolders: ['D:\\Keep'] };
    const res = await scan();
    expect(res.body.files.excluded).toBe(1);
  });

  it('does not touch the registry or task results', async () => {
    settings = { excludeFolders: ['C:\\'] };
    const res = await scan();
    expect(res.body.registryKeys.items).toHaveLength(1);
  });

  it('ignores an exclusion list that is not a list', async () => {
    settings = { excludeFolders: 'D:\\Keep' };
    const res = await scan();
    expect(res.body.files.items).toHaveLength(4);
  });
});
