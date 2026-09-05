import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The settings endpoint is two lines of route each way, and both of them
 * are load-bearing: everything the app treats as a safety boundary --
 * which folders are excluded, whether a restore point is made, how long
 * quarantine is kept -- is read back out of here.
 */

const stored = { createRestorePoint: true, excludeFolders: [], quarantineRetentionDays: 30 };
const updateSettings = vi.fn(async (partial) => ({ ...stored, ...partial }));
vi.mock('../services/settings.js', () => ({
  getSettings: async () => stored,
  updateSettings: (...a) => updateSettings(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const put = (body) => server.call('/settings', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

describe('/settings', () => {
  it('reads the stored settings', async () => {
    const res = await server.call('/settings');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(stored);
  });

  it('writes a partial update and answers with the merged result', async () => {
    // The client sends only what changed; the response is what the whole
    // file now says, so the UI never has to guess what a write did to the
    // keys it did not send.
    const res = await put({ createRestorePoint: false });
    expect(updateSettings).toHaveBeenCalledWith({ createRestorePoint: false });
    expect(res.body.createRestorePoint).toBe(false);
    expect(res.body.quarantineRetentionDays).toBe(30);
  });

  it('treats a body-less PUT as changing nothing', async () => {
    // Not as a write of undefined. updateSettings merges what it is
    // given, and a request with no body must not be able to blank the
    // file that holds every safety setting.
    const res = await put(undefined);
    expect(res.status).toBe(200);
    expect(updateSettings).toHaveBeenCalledWith({});
  });

  it('reports a failed write as a 500 rather than an unchanged-looking 200', async () => {
    // A settings write that silently did nothing is worse than one that
    // failed loudly: the user would go on believing an exclusion or a
    // retention window was in force.
    updateSettings.mockRejectedValueOnce(new Error('EACCES'));
    const res = await put({ excludeFolders: ['C:\\Keep'] });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('EACCES');
  });
});
