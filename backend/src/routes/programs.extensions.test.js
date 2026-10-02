import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const getBrowserExtensions = vi.fn();
const manageExtension = vi.fn();
vi.mock('../services/browserExtensions.js', () => ({ getBrowserExtensions: (...a) => getBrowserExtensions(...a) }));
vi.mock('../services/browserLauncher.js', () => ({ manageExtension: (...a) => manageExtension(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  getBrowserExtensions.mockResolvedValue([
    { id: 'extension:chrome:Default:' + 'a'.repeat(32), name: 'Thing', browser: 'Chrome', profile: 'Default', extensionId: 'a'.repeat(32) }
  ]);
  manageExtension.mockResolvedValue({ ok: true, browser: 'Chrome' });
});

const manage = (body) => server.call('/programs/extensions/manage', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

describe('POST /programs/extensions/manage', () => {
  it('opens the browser on the extension found by its row id, using what the profiles say', async () => {
    const res = await manage({ id: 'extension:chrome:Default:' + 'a'.repeat(32), browser: 'Evil', extensionId: 'b'.repeat(32), args: ['--x'] });
    expect(res.status).toBe(200);
    expect(manageExtension).toHaveBeenCalledWith({ browser: 'Chrome', extensionId: 'a'.repeat(32), profile: 'Default' });
  });

  it('needs an id, and is a 404 for an extension that is gone', async () => {
    expect((await manage({})).status).toBe(400);
    expect((await manage({ id: 'extension:nope' })).status).toBe(404);
    expect(manageExtension).not.toHaveBeenCalled();
  });

  it('relays a browser that could not be opened as a 409 with the reason', async () => {
    manageExtension.mockResolvedValue({ ok: false, error: 'Prune could not find Chrome on this PC.' });
    const res = await manage({ id: 'extension:chrome:Default:' + 'a'.repeat(32) });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/Chrome/);
  });
});
