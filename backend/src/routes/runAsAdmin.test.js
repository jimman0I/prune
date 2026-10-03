import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const service = vi.hoisted(() => ({ getRunAsAdminStatus: vi.fn(), setRunAsAdmin: vi.fn() }));
// The real module's other exports stay: the start-with-windows service, which the
// app also mounts, builds on its registry helpers.
vi.mock('../services/runAsAdmin.js', async (importOriginal) => ({ ...(await importOriginal()), ...service }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const put = (body) => server.call('/settings/run-as-admin', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});

const state = (over = {}) => ({ supported: true, enabled: false, elevatedNow: false, startsWithWindows: false, ...over });

describe('GET /settings/run-as-admin', () => {
  it('answers the flag as Windows has it, and whether Prune is elevated now', async () => {
    service.getRunAsAdminStatus.mockResolvedValue(state({ enabled: true, elevatedNow: true }));
    const res = await server.call('/settings/run-as-admin');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(state({ enabled: true, elevatedNow: true }));
  });

  it('answers an unsupported build as such, with the flag off', async () => {
    service.getRunAsAdminStatus.mockResolvedValue(state({ supported: false }));
    expect((await server.call('/settings/run-as-admin')).body).toMatchObject({ supported: false, enabled: false });
  });

  it('is a 500 with the reason when the registry cannot be read', async () => {
    service.getRunAsAdminStatus.mockRejectedValue(new Error('reg.exe timed out'));
    const res = await server.call('/settings/run-as-admin');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/timed out/);
  });
});

describe('PUT /settings/run-as-admin', () => {
  it('turns it on and answers the new state', async () => {
    service.setRunAsAdmin.mockResolvedValue(state({ enabled: true }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(200);
    expect(service.setRunAsAdmin).toHaveBeenCalledWith(true);
    expect(res.body.enabled).toBe(true);
  });

  it('turns it off', async () => {
    service.setRunAsAdmin.mockResolvedValue(state({ enabled: false }));
    await put({ enabled: false });
    expect(service.setRunAsAdmin).toHaveBeenCalledWith(false);
  });

  it('accepts only a real boolean, and never reaches the registry otherwise', async () => {
    for (const body of [undefined, {}, { enabled: 'true' }, { enabled: 1 }, { enabled: null }, [], { Enabled: true }]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toMatch(/true or false/);
    }
    expect(service.setRunAsAdmin).not.toHaveBeenCalled();
  });

  it('takes no path or flag from the request: only the boolean is passed on', async () => {
    service.setRunAsAdmin.mockResolvedValue(state());
    await put({ enabled: true, path: 'C:\\Windows\\notepad.exe', flags: '~ RUNASADMIN', exe: 'x' });
    expect(service.setRunAsAdmin).toHaveBeenCalledTimes(1);
    expect(service.setRunAsAdmin.mock.calls[0]).toEqual([true]);
  });

  it('is a 409 that says why where it is unsupported (a development build)', async () => {
    service.setRunAsAdmin.mockRejectedValue(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ unsupported: true });
    expect(res.body.error).toMatch(/installed Prune app/);
  });

  it('is a 500 with Windows\' reason when the write is refused', async () => {
    service.setRunAsAdmin.mockRejectedValue(new Error('ERROR: Access is denied.'));
    const res = await put({ enabled: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Access is denied/);
  });
});

describe('the ordinary settings routes are untouched', () => {
  it('has no other verb on the new path', async () => {
    const res = await server.call('/settings/run-as-admin', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });
});
