import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The conventions the smaller routes share, checked in one place.
 *
 * Three of them, and they are decisions rather than accidents:
 *
 *   400 means the caller asked for something malformed.
 *   503 means the machine cannot answer -- not a fault, not a caller
 *   mistake, and specifically not an empty success.
 *   200 with { cancelled: true } means a UAC prompt was declined. The
 *   request did what it was asked to; the user said no, and an error
 *   banner for a deliberate answer is wrong.
 *
 * Every service here either raises a consent dialog, spawns PowerShell,
 * or writes to disk, so all of them are mocked.
 */

const scanDriveViaMft = vi.fn(async () => ({ ok: true, tree: {}, stats: {}, driveLetter: 'C' }));
vi.mock('../services/mftScan.js', () => ({ scanDriveViaMft: (...a) => scanDriveViaMft(...a) }));

const getDiskHealth = vi.fn(async () => ({ drives: [] }));
const getElevatedDiskHealth = vi.fn(async () => ({ ok: true, drives: [] }));
vi.mock('../services/diskHealth.js', () => ({
  getDiskHealth: (...a) => getDiskHealth(...a),
  getElevatedDiskHealth: (...a) => getElevatedDiskHealth(...a)
}));

const scanForLeftovers = vi.fn(async () => ({ files: [], registryKeys: [] }));
vi.mock('../services/leftoverScan.js', () => ({ scanForLeftovers: (...a) => scanForLeftovers(...a) }));

const scanForcedUninstall = vi.fn(async ({ name }) => {
  if (!name) throw new Error('name is required');
  return { files: [] };
});
vi.mock('../services/forcedUninstall.js', () => ({
  scanForcedUninstall: (...a) => scanForcedUninstall(...a)
}));

const getSystemDriveSpace = vi.fn(async () => ({ freeBytes: 1, totalBytes: 2 }));
vi.mock('../services/diskSpace.js', () => ({ getSystemDriveSpace: (...a) => getSystemDriveSpace(...a) }));

const appendHistoryEntry = vi.fn(async () => {});
vi.mock('../services/uninstallHistory.js', () => ({
  getRecentHistory: async () => [],
  appendHistoryEntry: (...a) => appendHistoryEntry(...a)
}));

const getFileTypeIcons = vi.fn(async () => ({}));
vi.mock('../services/fileTypeIcons.js', () => ({ getFileTypeIcons: (...a) => getFileTypeIcons(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const post = (path, body) => server.call(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

describe('a malformed request is a 400', () => {
  it('rejects a drive letter that is not one letter', async () => {
    // This string reaches a PowerShell command line. Anything but a
    // single letter has no business getting that far.
    for (const driveLetter of ['CC', '', 'C:', 'C:\\', '1', 'C; rm', '../..', null]) {
      const res = await post('/mft-scan', { driveLetter });
      expect(res.status, JSON.stringify(driveLetter)).toBe(400);
    }
    expect(scanDriveViaMft).not.toHaveBeenCalled();
  });

  it('defaults the MFT scan to C when the body names no drive', async () => {
    const res = await post('/mft-scan', {});
    expect(res.status).toBe(200);
    expect(scanDriveViaMft).toHaveBeenCalledWith({ driveLetter: 'C', maxDepth: expect.any(Number) });
  });

  it('needs a program name to scan for leftovers', async () => {
    expect((await post('/leftovers/scan', {})).status).toBe(400);
    expect((await post('/leftovers/scan', undefined)).status).toBe(400);
    expect(scanForLeftovers).not.toHaveBeenCalled();
  });

  it('needs a program name to write a history entry', async () => {
    expect((await post('/uninstall-history', {})).status).toBe(400);
    expect(appendHistoryEntry).not.toHaveBeenCalled();
  });

  it('does not fall over on a history POST with no body at all', async () => {
    // This route is the one that destructures req.body without a `|| {}`
    // fallback, so it depends on express.json() having left an object
    // there. It does -- an empty body parses to {} -- but that is a
    // property of the middleware, not of the route, and nothing else was
    // holding it still.
    const res = await post('/uninstall-history', undefined);
    expect(res.status).toBe(400);
    expect(appendHistoryEntry).not.toHaveBeenCalled();
  });

  it("maps the forced-uninstall scan's own 'required' complaint to a 400, not a 500", async () => {
    // A missing name is the caller's mistake. Everything else the scan
    // can throw is a server fault and keeps its 500.
    expect((await post('/forced-uninstall/scan', {})).status).toBe(400);
    scanForcedUninstall.mockRejectedValueOnce(new Error('registry unreadable'));
    expect((await post('/forced-uninstall/scan', { name: 'Thing' })).status).toBe(500);
  });

  it('treats a file-icon request with no list as an empty list', async () => {
    // The Disk Map asks for icons for whatever extensions it happened to
    // see. Nothing to ask about is an ordinary answer, not an error.
    for (const extensions of [undefined, null, 'exe', 42, {}]) {
      const res = await post('/file-icons', { extensions });
      expect(res.status, JSON.stringify(extensions)).toBe(200);
      expect(getFileTypeIcons).toHaveBeenLastCalledWith([]);
    }
  });
});

describe('a machine that cannot answer is a 503', () => {
  it('says so rather than returning empty disk health', async () => {
    // Not every machine exposes SMART data. An empty drive list would
    // read as "no drives", which is never true.
    getDiskHealth.mockResolvedValueOnce(null);
    const res = await server.call('/disk-health');
    expect(res.status).toBe(503);
    expect(res.body.error).toMatch(/unavailable/);
  });

  it('says so rather than returning empty disk space', async () => {
    getSystemDriveSpace.mockResolvedValueOnce(null);
    const res = await server.call('/disk-space');
    expect(res.status).toBe(503);
  });
});

describe('a declined UAC prompt is a 200 that says so', () => {
  it('on the elevated disk-health read', async () => {
    getElevatedDiskHealth.mockResolvedValueOnce({ ok: false, cancelled: true });
    const res = await post('/disk-health/elevated', {});
    expect(res.status).toBe(200);
    expect(res.body.cancelled).toBe(true);
  });

  it('on the MFT scan', async () => {
    scanDriveViaMft.mockResolvedValueOnce({ ok: false, cancelled: true });
    const res = await post('/mft-scan', { driveLetter: 'C' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cancelled: true });
  });

  it('but a real elevation failure is still a 500', async () => {
    // The distinction the convention rests on. "You said no" and "it
    // broke" must not look the same.
    scanDriveViaMft.mockResolvedValueOnce({ ok: false, error: 'MFT read failed' });
    const res = await post('/mft-scan', { driveLetter: 'C' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('MFT read failed');
  });
});

describe('what must never be reachable by a GET', () => {
  it('the endpoints that raise a consent dialog or change the machine', async () => {
    // A GET is something a prefetch, a refresh or a link can perform on
    // its own. None of these should be.
    for (const path of ['/mft-scan', '/disk-health/elevated', '/uninstall-history/scan', '/sandbox-test']) {
      const res = await server.call(path);
      expect(res.status, path).toBe(404);
    }
    expect(scanDriveViaMft).not.toHaveBeenCalled();
    expect(getElevatedDiskHealth).not.toHaveBeenCalled();
  });
});
