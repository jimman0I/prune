import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const hunter = vi.hoisted(() => ({
  huntAtPoint: vi.fn(), describeHunt: vi.fn((r) => r), endHuntedProcess: vi.fn(),
  validatePoint: (p) => (p && Number.isInteger(p.x) && Number.isInteger(p.y) && Math.abs(p.x) <= 100000 && Math.abs(p.y) <= 100000 ? { x: p.x, y: p.y } : null)
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

describe('/hunter/at-point', () => {
  it('answers a picked window with the program it belongs to', async () => {
    hunter.huntAtPoint.mockResolvedValue({ status: 'picked', pid: 5, exePath: 'D:\\a.exe' });
    hunter.describeHunt.mockImplementation((r, ctx) => ({ ...r, program: ctx.programs[0], startupItems: ctx.startupItems }));
    const res = await post('/at-point', { x: 640, y: -20 });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'picked', program: { id: 'p' }, startupItems: [{ id: 's' }] });
    expect(hunter.huntAtPoint).toHaveBeenCalledWith({ x: 640, y: -20 });
  });

  it('answers nothing-there and unreadable without reading any lists', async () => {
    hunter.huntAtPoint.mockResolvedValue({ status: 'nothing' });
    expect((await post('/at-point', { x: 1, y: 1 })).body).toEqual({ status: 'nothing' });
    hunter.huntAtPoint.mockResolvedValue({ status: 'unreadable', pid: 9, name: null });
    expect((await post('/at-point', { x: 1, y: 1 })).body).toEqual({ status: 'unreadable', pid: 9, name: null });
    expect(hunter.describeHunt).not.toHaveBeenCalled();
  });

  it('refuses a point that is missing, not whole, or out of range, and looks nothing up', async () => {
    for (const body of [undefined, {}, { x: 1 }, { x: '5', y: 5 }, { x: 1.5, y: 2 }, { x: 1e9, y: 0 }, { x: null, y: null }, [1, 2]]) {
      const res = await post('/at-point', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toMatch(/whole/i);
    }
    expect(hunter.huntAtPoint).not.toHaveBeenCalled();
  });

  it('only passes x and y on, whatever else the body carries', async () => {
    hunter.huntAtPoint.mockResolvedValue({ status: 'nothing' });
    await post('/at-point', { x: 3, y: 4, script: 'calc', exe: 'x' });
    expect(hunter.huntAtPoint).toHaveBeenCalledWith({ x: 3, y: 4 });
  });

  it('is a 500 with the reason when the lookup throws', async () => {
    hunter.huntAtPoint.mockRejectedValue(new Error('boom'));
    const res = await post('/at-point', { x: 1, y: 1 });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('boom');
  });

  it('is not reachable by a GET', async () => {
    expect((await server.call('/hunter/at-point')).status).toBe(404);
  });
});

describe('the old polling hunt is gone', () => {
  it('has no /start or /cancel', async () => {
    expect((await post('/start')).status).toBe(404);
    expect((await post('/cancel')).status).toBe(404);
  });
});

describe('/hunter/end-process', () => {
  it('ends a process by the pid and path it was shown with, and relays a refusal', async () => {
    hunter.endHuntedProcess.mockResolvedValueOnce({ ok: true });
    expect((await post('/end-process', { pid: 7, exePath: 'D:\\a.exe' })).status).toBe(200);
    expect(hunter.endHuntedProcess).toHaveBeenCalledWith({ pid: 7, exePath: 'D:\\a.exe' });
    hunter.endHuntedProcess.mockResolvedValueOnce({ ok: false, error: 'That is Prune itself.' });
    const refused = await post('/end-process', { pid: 1, exePath: 'x' });
    expect(refused.status).toBe(409);
    expect(refused.body.error).toMatch(/Prune/);
  });
});
