import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** GET /api/low-disk: the share comes from Settings, never from the request. */

let settings = {};
vi.mock('../services/settings.js', async (importOriginal) => ({
  ...(await importOriginal()),
  getSettings: async () => settings
}));
const findLowDrives = vi.fn();
vi.mock('../services/lowDisk.js', async (importOriginal) => ({
  ...(await importOriginal()),
  findLowDrives: (...a) => findLowDrives(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  settings = { lowDiskWarning: 10 };
  findLowDrives.mockResolvedValue([{ drive: 'C:', label: '', freeBytes: 1, totalBytes: 100, percentFree: 1 }]);
});

describe('GET /low-disk', () => {
  it('reports the low drives for the share in Settings', async () => {
    const res = await server.call('/low-disk');
    expect(res.status).toBe(200);
    expect(res.body.percent).toBe(10);
    expect(res.body.drives).toHaveLength(1);
    expect(findLowDrives).toHaveBeenCalledWith({ percent: 10 });
  });

  it('uses the share chosen in Settings', async () => {
    settings = { lowDiskWarning: 15 };
    await server.call('/low-disk');
    expect(findLowDrives).toHaveBeenCalledWith({ percent: 15 });
  });

  it('ignores a share named in the request', async () => {
    await server.call('/low-disk?percent=50');
    expect(findLowDrives).toHaveBeenCalledWith({ percent: 10 });
  });

  it('answers Off with no drives', async () => {
    settings = { lowDiskWarning: 0 };
    findLowDrives.mockImplementation(async ({ percent }) => (percent ? [{}] : []));
    const res = await server.call('/low-disk');
    expect(res.body).toEqual({ percent: 0, drives: [] });
  });

  it('reads a missing or odd setting as the default, not as Off', async () => {
    settings = {};
    expect((await server.call('/low-disk')).body.percent).toBe(10);
    settings = { lowDiskWarning: 'x' };
    expect((await server.call('/low-disk')).body.percent).toBe(10);
  });

  it('refuses a web page', async () => {
    expect((await server.callAsWebPage('/low-disk')).status).toBe(403);
  });

  it('reports a failure as an error, not as a clear disk', async () => {
    findLowDrives.mockRejectedValue(new Error('boom'));
    expect((await server.call('/low-disk')).status).toBe(500);
  });
});
