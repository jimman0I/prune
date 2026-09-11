import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The uninstall history, and the setting that stops it being kept --
 * Revo's "Disable Uninstall History". Off means nothing is written: the
 * point of the setting is that there is no record, not a hidden one. */

const appendHistoryEntry = vi.fn(async () => {});
vi.mock('../services/uninstallHistory.js', () => ({
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  getRecentHistory: async () => []
}));

let settings = {};
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (p) => ({ ...settings, ...p })
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); settings = {}; });

const record = () => server.call('/uninstall-history', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ programName: 'Thing', publisher: 'Acme', sizeBytes: 5 })
});

describe('POST /uninstall-history', () => {
  it('records a removal by default', async () => {
    const res = await record();
    expect(res.status).toBe(200);
    expect(appendHistoryEntry).toHaveBeenCalledWith({ programName: 'Thing', publisher: 'Acme', sizeBytes: 5 });
  });

  it('writes nothing when the history is turned off, and says it skipped', async () => {
    settings = { keepUninstallHistory: false };
    const res = await record();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, skipped: true });
    expect(appendHistoryEntry).not.toHaveBeenCalled();
  });

  it('keeps recording for any value but an explicit false', async () => {
    // A settings file from before this existed has no such key; the
    // history it has always kept carries on.
    for (const value of [undefined, true, 'false', 0, null]) {
      settings = { keepUninstallHistory: value };
      await record();
    }
    expect(appendHistoryEntry).toHaveBeenCalledTimes(5);
  });
});
