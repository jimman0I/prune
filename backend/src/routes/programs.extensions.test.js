import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const getBrowserExtensions = vi.fn();
vi.mock('../services/browserExtensions.js', () => ({ getBrowserExtensions: (...a) => getBrowserExtensions(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  getBrowserExtensions.mockResolvedValue([
    { id: 'extension:chrome:Default:' + 'a'.repeat(32), name: 'Thing', browser: 'Chrome', profile: 'Default', extensionId: 'a'.repeat(32) },
    { id: 'extension:firefox:x.default:addon@example.org', name: 'Other', browser: 'Firefox', profile: 'x.default', extensionId: 'addon@example.org' },
    { id: 'extension:chrome:Default:' + 'b'.repeat(31), name: 'Broken', browser: 'Chrome', profile: 'Default', extensionId: 'b'.repeat(31) }
  ]);
});

const pageAddress = (body) => server.call('/programs/extensions/page-address', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

describe('POST /programs/extensions/page-address', () => {
  it('returns the address of the extension found by its row id, using what the profiles say, and launches nothing', async () => {
    const res = await pageAddress({ id: 'extension:chrome:Default:' + 'a'.repeat(32), browser: 'Evil', extensionId: 'b'.repeat(32), args: ['--x'] });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, browser: 'Chrome', address: `chrome://extensions/?id=${'a'.repeat(32)}` });
  });

  it('gives about:addons for a Firefox add-on', async () => {
    const res = await pageAddress({ id: 'extension:firefox:x.default:addon@example.org' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, browser: 'Firefox', address: 'about:addons' });
  });

  it('needs an id, and is a 404 for an extension that is gone', async () => {
    expect((await pageAddress({})).status).toBe(400);
    expect((await pageAddress({ id: 'extension:nope' })).status).toBe(404);
  });

  it('is a 409 with the reason when the stored id is not a valid extension id', async () => {
    const res = await pageAddress({ id: 'extension:chrome:Default:' + 'b'.repeat(31) });
    expect(res.status).toBe(409);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/extension id/);
  });

  it('no longer has the old launching route', async () => {
    const old =await server.call('/programs/extensions/manage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'extension:chrome:Default:' + 'a'.repeat(32) })
    });
    expect(old.status).toBe(404);
  });
});
