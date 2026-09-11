import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /quarantine/remove with a destination.
 *
 * The destination comes from the request -- from the dialog the user just
 * read -- and never from settings. The dialog reads the setting and says
 * where the files will go; the request carries what it said. So what
 * happens is what was shown, and a leftover can only be deleted
 * permanently by a request that says "permanent" out loud. A missing one
 * means Quarantine, which is what every client sent before this existed.
 */

const removeLeftovers = vi.fn(async ({ destination }) => ({ destination, files: [], totalSizeBytes: 0 }));
vi.mock('../services/leftoverRemoval.js', () => ({
  removeLeftovers: (...a) => removeLeftovers(...a),
  DESTINATIONS: ['quarantine', 'recycle', 'permanent']
}));

vi.mock('../services/restorePoint.js', () => ({ tryCreateRestorePoint: async () => ({ created: true }) }));

let settings = {};
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (partial) => ({ ...settings, ...partial })
}));

vi.mock('../services/quarantineLimits.js', () => ({
  enforceQuarantineLimits: async () => ({ ok: true, purged: [], failed: [], errors: [], stillOverCap: false })
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); settings = { createRestorePoint: true }; });

const remove = (body) => server.call('/quarantine/remove', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ programName: 'Thing', files: ['C:\\x'], registryKeys: [], ...body })
});

describe('POST /quarantine/remove destination', () => {
  it('goes to Quarantine when the request names no destination', async () => {
    const res = await remove({});
    expect(res.status).toBe(200);
    expect(removeLeftovers).toHaveBeenCalledWith({
      programName: 'Thing', files: ['C:\\x'], registryKeys: [], destination: 'quarantine'
    });
  });

  it.each(['quarantine', 'recycle', 'permanent'])('passes %s through', async (destination) => {
    const res = await remove({ destination });
    expect(res.status).toBe(200);
    expect(removeLeftovers.mock.calls[0][0].destination).toBe(destination);
    expect(res.body.destination).toBe(destination);
  });

  it('refuses a destination it does not know, and removes nothing', async () => {
    for (const destination of ['shred', 'PERMANENT', 1, null]) {
      const res = await remove({ destination });
      expect(res.status).toBe(400);
    }
    expect(removeLeftovers).not.toHaveBeenCalled();
  });

  it('never takes the destination from settings', async () => {
    // Settings say permanent; the request said nothing. Quarantine.
    settings = { createRestorePoint: true, leftoverDestination: 'permanent' };
    await remove({});
    expect(removeLeftovers.mock.calls[0][0].destination).toBe('quarantine');
  });

  it('still makes the restore point first, whatever the destination', async () => {
    const res = await remove({ destination: 'permanent' });
    expect(res.body.restorePoint).toEqual({ created: true });
  });
});
