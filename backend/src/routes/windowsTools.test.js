import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** /windows-tools: the list, and starting one by id. The launch itself is
 * mocked -- nothing opens -- while the id check is the real one, since it is
 * the point of the route. */

const launchWindowsTool = vi.fn(async () => ({ ok: true }));
const listWindowsTools = vi.fn(async () => [{ id: 'services', group: 'manage', elevated: false, kind: 'window' }]);
vi.mock('../services/windowsTools.js', async (importOriginal) => ({
  ...(await importOriginal()),
  launchWindowsTool: (...a) => launchWindowsTool(...a),
  listWindowsTools: (...a) => listWindowsTools(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const launch = (body) => server.call('/windows-tools/launch', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

describe('GET /windows-tools', () => {
  it('answers the tools on this PC', async () => {
    const res = await server.call('/windows-tools');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ tools: [{ id: 'services', group: 'manage', elevated: false, kind: 'window' }] });
  });
});

describe('POST /windows-tools/launch', () => {
  it('starts a tool named by its id', async () => {
    const res = await launch({ id: 'services' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(launchWindowsTool).toHaveBeenCalledWith('services');
  });

  it('is a 400 for anything that is not an id in the list, and starts nothing', async () => {
    for (const body of [{ id: 'regedit' }, { id: 'C:\\Windows\\System32\\cmd.exe' }, { id: ['services'] }, { id: 7 }, {}, { file: 'services.msc' }, { id: '__proto__' }]) {
      const res = await launch(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body).toEqual({ ok: false, error: 'Unknown tool.' });
    }
    expect(launchWindowsTool).not.toHaveBeenCalled();
  });

  it('reads nothing but the id: extra fields cannot add arguments', async () => {
    await launch({ id: 'sfc', args: '/c del C:\\', file: 'evil.exe' });
    expect(launchWindowsTool).toHaveBeenCalledWith('sfc');
  });

  it('is a 404 for a listed tool this PC does not have', async () => {
    launchWindowsTool.mockResolvedValueOnce({ ok: false, missing: true, error: 'That tool is not on this PC.' });
    const res = await launch({ id: 'groupPolicy' });
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ ok: false, error: 'That tool is not on this PC.' });
  });

  it('answers a declined UAC dialog as an ordinary outcome, and a failure as a 500 with its reason', async () => {
    launchWindowsTool.mockResolvedValueOnce({ ok: false, cancelled: true });
    expect(await launch({ id: 'dism' })).toMatchObject({ status: 200, body: { ok: false, cancelled: true } });
    launchWindowsTool.mockResolvedValueOnce({ ok: false, error: 'It broke.' });
    expect(await launch({ id: 'dism' })).toMatchObject({ status: 500, body: { ok: false, error: 'It broke.' } });
  });
});
