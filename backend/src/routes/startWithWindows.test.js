import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const service = vi.hoisted(() => ({ getStartWithWindows: vi.fn(), setStartWithWindows: vi.fn() }));
vi.mock('../services/startWithWindows.js', () => service);

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const put = (body) => server.call('/settings/start-with-windows', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});
const state = (over = {}) => ({ supported: true, enabled: false, minimized: false, stale: false, foreign: false, disabledByWindows: false, runAsAdmin: false, ...over });

describe('GET /settings/start-with-windows', () => {
  it('answers the Run entry as Windows has it, and the admin conflict', async () => {
    service.getStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: true, runAsAdmin: true }));
    const res = await server.call('/settings/start-with-windows');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(state({ enabled: true, minimized: true, runAsAdmin: true }));
  });

  it('is a 500 with the reason when the registry cannot be read', async () => {
    service.getStartWithWindows.mockRejectedValue(new Error('reg.exe timed out'));
    const res = await server.call('/settings/start-with-windows');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/timed out/);
  });
});

describe('PUT /settings/start-with-windows', () => {
  it('turns it on, minimised, and answers the new state', async () => {
    service.setStartWithWindows.mockResolvedValue(state({ enabled: true, minimized: true }));
    const res = await put({ enabled: true, minimized: true });
    expect(res.status).toBe(200);
    expect(service.setStartWithWindows).toHaveBeenCalledWith({ enabled: true, minimized: true });
    expect(res.body.enabled).toBe(true);
  });

  it('passes only enabled when minimized is not sent', async () => {
    service.setStartWithWindows.mockResolvedValue(state());
    await put({ enabled: false });
    expect(service.setStartWithWindows).toHaveBeenCalledWith({ enabled: false });
  });

  it('accepts only real booleans, and never reaches the registry otherwise', async () => {
    for (const body of [undefined, {}, { enabled: 'true' }, { enabled: 1 }, { enabled: null }, [], { Enabled: true }]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toMatch(/true or false/);
    }
    for (const minimized of ['yes', 1, null, {}]) {
      const res = await put({ enabled: true, minimized });
      expect(res.status, String(minimized)).toBe(400);
    }
    expect(service.setStartWithWindows).not.toHaveBeenCalled();
  });

  it('takes no path or argument from the request: only the two booleans are passed on', async () => {
    service.setStartWithWindows.mockResolvedValue(state());
    await put({ enabled: true, minimized: false, path: 'C:\\Windows\\notepad.exe', args: '--evil', exe: 'x', name: 'Other' });
    expect(service.setStartWithWindows.mock.calls[0]).toEqual([{ enabled: true, minimized: false }]);
  });

  it('is a 409 that says why where it is unsupported (a development build)', async () => {
    service.setStartWithWindows.mockRejectedValue(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ unsupported: true });
  });

  it('is a 500 with Windows\' reason when the write is refused', async () => {
    service.setStartWithWindows.mockRejectedValue(new Error('ERROR: Access is denied.'));
    const res = await put({ enabled: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Access is denied/);
  });

  it('has no other verb', async () => {
    expect((await server.call('/settings/start-with-windows', { method: 'DELETE' })).status).toBe(404);
  });
});
