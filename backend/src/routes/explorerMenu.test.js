import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const service = vi.hoisted(() => ({ getExplorerMenu: vi.fn(), setExplorerMenu: vi.fn() }));
vi.mock('../services/explorerMenu.js', () => service);

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const put = (body) => server.call('/settings/explorer-menu', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});
const captions = { shred: 'Shred with Prune', find: 'Find in Prune (uninstall)' };
const state = (over = {}) => ({ supported: true, enabled: false, incomplete: false, stale: false, foreign: false, captions, ...over });

describe('GET /settings/explorer-menu', () => {
  it('answers the verbs as the registry has them, with the captions in use', async () => {
    service.getExplorerMenu.mockResolvedValue(state({ enabled: true, incomplete: true }));
    const res = await server.call('/settings/explorer-menu');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(state({ enabled: true, incomplete: true }));
  });

  it('is a 500 with the reason when the registry cannot be read', async () => {
    service.getExplorerMenu.mockRejectedValue(new Error('reg.exe timed out'));
    const res = await server.call('/settings/explorer-menu');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/timed out/);
  });
});

describe('PUT /settings/explorer-menu', () => {
  it('turns it on and answers the new state', async () => {
    service.setExplorerMenu.mockResolvedValue(state({ enabled: true }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(200);
    expect(service.setExplorerMenu).toHaveBeenCalledWith({ enabled: true });
    expect(res.body.enabled).toBe(true);
  });

  it('turns it off', async () => {
    service.setExplorerMenu.mockResolvedValue(state());
    await put({ enabled: false });
    expect(service.setExplorerMenu).toHaveBeenCalledWith({ enabled: false });
  });

  it('accepts only a real boolean, and never reaches the registry otherwise', async () => {
    for (const body of [undefined, {}, { enabled: 'true' }, { enabled: 1 }, { enabled: null }, [], { Enabled: true }]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toMatch(/true or false/);
    }
    expect(service.setExplorerMenu).not.toHaveBeenCalled();
  });

  it('takes no path, caption, key or command from the request: only the one boolean is passed on', async () => {
    service.setExplorerMenu.mockResolvedValue(state());
    await put({ enabled: true, path: 'C:\\Windows\\notepad.exe', command: 'calc.exe', caption: 'Evil', key: 'HKLM\\x', args: '--evil' });
    expect(service.setExplorerMenu.mock.calls[0]).toEqual([{ enabled: true }]);
  });

  it('is a 409 that says why where it is unsupported (a development build)', async () => {
    service.setExplorerMenu.mockRejectedValue(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true, reason: 'notPackaged' }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ unsupported: true });
  });

  it('is a 500 with Windows\' reason when the write is refused', async () => {
    service.setExplorerMenu.mockRejectedValue(new Error('ERROR: Access is denied.'));
    const res = await put({ enabled: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Access is denied/);
  });

  it('has no other verb', async () => {
    expect((await server.call('/settings/explorer-menu', { method: 'DELETE' })).status).toBe(404);
  });
});
