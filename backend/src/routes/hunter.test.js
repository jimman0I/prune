import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const hunter = vi.hoisted(() => ({
  startHunt: vi.fn(), cancelHunt: vi.fn(), describeHunt: vi.fn((r) => r), endHuntedProcess: vi.fn()
}));
vi.mock('../services/hunter.js', () => hunter);
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => [{ id: 'p', name: 'P' }] }));
vi.mock('../services/storeApps.js', () => ({ getStoreApps: async () => [] }));
vi.mock('../services/startupItems.js', () => ({ getStartupItems: async () => [{ id: 's' }] }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); hunter.describeHunt.mockImplementation((r) => r); });

const post = (path, body) => server.call(`/hunter${path}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});

describe('/hunter', () => {
  it('answers a picked window with the program it belongs to', async () => {
    hunter.startHunt.mockResolvedValue({ status: 'picked', pid: 5, exePath: 'D:\\a.exe' });
    hunter.describeHunt.mockImplementation((r, ctx) => ({ ...r, program: ctx.programs[0], startupItems: ctx.startupItems }));
    const res = await post('/start');
    expect(res.body).toMatchObject({ status: 'picked', program: { id: 'p' }, startupItems: [{ id: 's' }] });
  });

  it('answers cancelled and timed out without reading any lists', async () => {
    hunter.startHunt.mockResolvedValue({ status: 'timeout' });
    expect((await post('/start')).body).toEqual({ status: 'timeout' });
    expect(hunter.describeHunt).not.toHaveBeenCalled();
  });

  it('is a 409 while a hunt is already running', async () => {
    hunter.startHunt.mockRejectedValue(new Error('A hunt is already running.'));
    expect((await post('/start')).status).toBe(409);
  });

  it('cancels', async () => {
    hunter.cancelHunt.mockReturnValue(true);
    expect((await post('/cancel')).body).toEqual({ cancelled: true });
  });

  it('ends a process by the pid and path it was shown with, and relays a refusal', async () => {
    hunter.endHuntedProcess.mockResolvedValueOnce({ ok: true });
    expect((await post('/end-process', { pid: 7, exePath: 'D:\\a.exe' })).status).toBe(200);
    expect(hunter.endHuntedProcess).toHaveBeenCalledWith({ pid: 7, exePath: 'D:\\a.exe' });
    hunter.endHuntedProcess.mockResolvedValueOnce({ ok: false, error: 'That is Prune itself.' });
    const refused = await post('/end-process', { pid: 1, exePath: 'x' });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/Prune/);
  });

  it('is not reachable by a GET', async () => {
    expect((await server.call('/hunter/start')).status).toBe(404);
  });
});
