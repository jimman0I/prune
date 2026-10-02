import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const monitor = vi.hoisted(() => ({
  start: vi.fn(), status: vi.fn(() => ({ state: 'idle' })), finish: vi.fn(), cancel: vi.fn()
}));
vi.mock('../services/installMonitor.js', () => ({ installMonitor: monitor }));
const listTraces = vi.fn();
const deleteTrace = vi.fn();
vi.mock('../services/installTraces.js', () => ({
  listTraces: (...a) => listTraces(...a), deleteTrace: (...a) => deleteTrace(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); monitor.status.mockReturnValue({ state: 'idle' }); });

const post = (path, body) => server.call(`/install-monitor${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});

describe('/install-monitor', () => {
  it('starts a monitored install from the path in the body', async () => {
    monitor.start.mockResolvedValue();
    monitor.status.mockReturnValue({ state: 'installing' });
    const res = await post('/start', { installerPath: 'C:\\dl\\setup.exe', somethingElse: 'ignored' });
    expect(res.status).toBe(200);
    expect(monitor.start).toHaveBeenCalledWith({ installerPath: 'C:\\dl\\setup.exe' });
    expect(res.body.state).toBe('installing');
  });

  it('is a 400 for a path that is not an installer and a 409 while one is running', async () => {
    monitor.start.mockRejectedValueOnce(new Error('Only .exe and .msi installers can be monitored.'));
    expect((await post('/start', { installerPath: 'x' })).status).toBe(400);
    monitor.start.mockRejectedValueOnce(new Error('A monitored install is already in progress.'));
    expect((await post('/start', { installerPath: 'x' })).status).toBe(409);
    monitor.start.mockRejectedValueOnce(new Error('The "before" snapshot failed: boom'));
    expect((await post('/start', { installerPath: 'x' })).status).toBe(500);
  });

  it('reports where the monitor is', async () => {
    monitor.status.mockReturnValue({ state: 'exited', installerPath: 'C:\\a.exe' });
    expect((await server.call('/install-monitor/session')).body).toEqual({ state: 'exited', installerPath: 'C:\\a.exe' });
  });

  it('answers "Done installing" at once and lets the comparison carry on', async () => {
    monitor.status.mockReturnValue({ state: 'analyzing' });
    const res = await post('/session/finish');
    expect(monitor.finish).toHaveBeenCalledTimes(1);
    expect(res.body.state).toBe('analyzing');
  });

  it('cancels', async () => {
    await post('/session/cancel');
    expect(monitor.cancel).toHaveBeenCalledTimes(1);
  });

  it('lists traces and deletes one by id', async () => {
    listTraces.mockResolvedValue([{ id: 'a'.repeat(16), programName: 'Acme' }]);
    expect((await server.call('/install-monitor/traces')).body).toEqual({ traces: [{ id: 'a'.repeat(16), programName: 'Acme' }] });

    deleteTrace.mockResolvedValue(true);
    const res = await server.call(`/install-monitor/traces/${'a'.repeat(16)}`, { method: 'DELETE' });
    expect(res.body).toEqual({ ok: true });
    expect(deleteTrace).toHaveBeenCalledWith('a'.repeat(16));

    deleteTrace.mockResolvedValue(false);
    expect((await server.call('/install-monitor/traces/nope', { method: 'DELETE' })).status).toBe(404);
  });

  it('does not start from a GET', async () => {
    expect((await server.call('/install-monitor/start')).status).toBe(404);
    expect(monitor.start).not.toHaveBeenCalled();
  });
});
