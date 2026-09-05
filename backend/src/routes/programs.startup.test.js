import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The one endpoint on the programs router that writes to the registry.
 *
 * Everything else there is a read. This one changes what the machine
 * launches at sign-in and, for a machine-wide entry, raises a UAC prompt
 * -- so what it accepts, and what it refuses to take from the client, is
 * the part worth pinning.
 */

const entries = [
  { id: 'hkcu-run-Discord', scope: 'user', kind: 'Run', name: 'Discord', enabled: true },
  { id: 'hklm-run-RtkAudUService', scope: 'machine', kind: 'Run', name: 'RtkAudUService', enabled: false }
];
const getStartupEntries = vi.fn(async () => entries);
vi.mock('../services/startupItems.js', () => ({
  getStartupEntries: (...a) => getStartupEntries(...a),
  getStartupItems: async () => entries
}));

const setStartupEnabled = vi.fn(async () => ({ ok: true }));
vi.mock('../services/startupToggle.js', () => ({
  setStartupEnabled: (...a) => setStartupEnabled(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const toggle = (body) => server.call('/programs/startup/toggle', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

describe('POST /programs/startup/toggle', () => {
  it('needs an id and a real boolean', async () => {
    // `enabled` is not coerced. A missing field arriving as undefined and
    // being read as false would silently disable an entry the user was
    // trying to enable.
    for (const body of [
      undefined,
      {},
      { id: 'hkcu-run-Discord' },
      { id: '', enabled: true },
      { id: 'hkcu-run-Discord', enabled: 'true' },
      { id: 'hkcu-run-Discord', enabled: 1 },
      { id: 42, enabled: true }
    ]) {
      const res = await toggle(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.ok).toBe(false);
    }
    expect(setStartupEnabled).not.toHaveBeenCalled();
  });

  it('is a 404, not a 500, for an entry that is no longer there', async () => {
    // The list on screen is a snapshot. An entry genuinely can be gone by
    // the time it is clicked, and that is not a fault.
    const res = await toggle({ id: 'hkcu-run-SomethingUninstalled', enabled: false });
    expect(res.status).toBe(404);
    expect(setStartupEnabled).not.toHaveBeenCalled();
  });

  it('toggles the entry it looked up, never one the client described', async () => {
    // The security property of this route. The body carries an id and
    // nothing else; the hive, key path and value name all come from a
    // fresh read of the real startup locations. A client that could send
    // its own registry target could write anywhere, elevated.
    const res = await toggle({
      id: 'hklm-run-RtkAudUService',
      enabled: true,
      scope: 'machine',
      keyPath: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      valueName: 'anything the client likes'
    });
    expect(res.status).toBe(200);
    expect(getStartupEntries).toHaveBeenCalled();
    expect(setStartupEnabled).toHaveBeenCalledWith(entries[1], true);
    // Specifically: the object handed on is the looked-up entry, with
    // none of the extra fields the request tried to add.
    const [passed] = setStartupEnabled.mock.calls[0];
    expect(passed.keyPath).toBeUndefined();
    expect(passed.valueName).toBeUndefined();
  });

  it('passes a declined UAC prompt back as a 200 that says so', async () => {
    // The convention /disk-health/elevated already uses. The request did
    // what it was asked to; the user said no. A 500 would show an error
    // banner for a decision the user made on purpose.
    setStartupEnabled.mockResolvedValueOnce({ ok: false, cancelled: true });
    const res = await toggle({ id: 'hklm-run-RtkAudUService', enabled: true });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, cancelled: true });
  });

  it('reports a real failure as a 500', async () => {
    setStartupEnabled.mockRejectedValueOnce(new Error('registry write failed'));
    const res = await toggle({ id: 'hkcu-run-Discord', enabled: false });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'registry write failed' });
  });

  it('is not reachable by a GET', async () => {
    // It changes the machine and can raise a UAC prompt. Neither belongs
    // behind something a refresh or a prefetch can repeat.
    const res = await server.call('/programs/startup/toggle');
    expect(res.status).toBe(404);
    expect(setStartupEnabled).not.toHaveBeenCalled();
  });
});
