import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const finder = vi.hoisted(() => ({ findProgramForFile: vi.fn() }));
vi.mock('../services/programFinder.js', () => finder);
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => [{ id: 'p', name: 'P' }] }));
vi.mock('../services/storeApps.js', () => ({ getStoreApps: async () => [{ id: 's', name: 'S', source: 'store' }] }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const post = (body) => server.call('/find-program', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});

describe('POST /find-program', () => {
  it('answers what the finder found, and hands it the installed lists to match against', async () => {
    finder.findProgramForFile.mockImplementation(async (path, { loadContext }) => ({ status: 'matched', path, context: await loadContext() }));
    const res = await post({ path: 'C:\\Program Files\\Acme\\acme.exe' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('matched');
    expect(res.body.context.programs).toEqual([{ id: 'p', name: 'P' }]);
    expect(res.body.context.storeApps).toEqual([{ id: 's', name: 'S', source: 'store' }]);
    expect(finder.findProgramForFile.mock.calls[0][0]).toBe('C:\\Program Files\\Acme\\acme.exe');
  });

  it('passes on only the path, whatever else the request holds', async () => {
    finder.findProgramForFile.mockResolvedValue({ status: 'unmatched' });
    await post({ path: 'C:\\a.exe', exePath: 'C:\\evil.exe', program: { id: 'x' }, command: 'calc' });
    expect(finder.findProgramForFile.mock.calls[0][0]).toBe('C:\\a.exe');
    expect(Object.keys(finder.findProgramForFile.mock.calls[0][1]).sort()).toEqual(['loadContext']);
  });

  it('is a 400 for a path the finder refuses, with its reason', async () => {
    finder.findProgramForFile.mockRejectedValue(Object.assign(new Error('Only a program (.exe) or a shortcut (.lnk) can be looked up.'), { invalid: true }));
    const res = await post({ path: 'C:\\a.txt' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/\.exe/);
  });

  it('is a 400 without calling the finder when there is no string path', async () => {
    for (const body of [undefined, {}, { path: 5 }, { path: null }, { path: ['C:\\a.exe'] }]) {
      expect((await post(body)).status, JSON.stringify(body)).toBe(400);
    }
    expect(finder.findProgramForFile).not.toHaveBeenCalled();
  });

  it('is a 500 when something else goes wrong', async () => {
    finder.findProgramForFile.mockRejectedValue(new Error('disk on fire'));
    const res = await post({ path: 'C:\\a.exe' });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/disk on fire/);
  });

  it('has no other verb', async () => {
    expect((await server.call('/find-program')).status).toBe(404);
  });
});
