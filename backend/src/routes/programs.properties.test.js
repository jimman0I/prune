import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /programs/properties: Windows' Properties sheet for Hunter's
 * executable (by path) or an installed program's main executable (by id).
 * The sheet itself is mocked -- no window opens -- while the path checks are
 * the real ones, since they are the point of the route. */

const dir = mkdtempSync(join(tmpdir(), 'prune-props-route-'));
const exe = join(dir, 'App.exe');
writeFileSync(exe, 'MZ');

const programs = [{ id: 'app', name: 'App', installLocation: dir }];
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => programs }));

const showFileProperties = vi.fn(async (path) => ({ ok: true, path }));
const mainExecutableFor = vi.fn(async () => exe);
vi.mock('../services/fileProperties.js', async (importOriginal) => ({
  ...(await importOriginal()),
  showFileProperties: (...a) => showFileProperties(...a),
  mainExecutableFor: (...a) => mainExecutableFor(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); rmSync(dir, { recursive: true, force: true }); });
beforeEach(() => { vi.clearAllMocks(); });

const post = (body) => server.call('/programs/properties', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

describe('POST /programs/properties', () => {
  it('opens the sheet for a full path to a file', async () => {
    const res = await post({ path: exe });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, path: exe });
    expect(showFileProperties).toHaveBeenCalledWith(exe);
  });

  it('refuses command text, a relative path, a folder and a missing file without opening anything', async () => {
    for (const path of [`"${exe}" & calc.exe`, 'notepad.exe', dir, join(dir, 'gone.exe'), 'C:\\Windows\\notepad.exe\r\ncalc']) {
      const res = await post({ path });
      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
    }
    expect(await post({})).toMatchObject({ status: 400 });
    expect(await post({ path: 42 })).toMatchObject({ status: 400 });
    expect(showFileProperties).not.toHaveBeenCalled();
  });

  it('finds an installed program by id and opens its main executable', async () => {
    const res = await post({ programId: 'app', path: 'C:\\ignored.exe' });
    expect(res.status).toBe(200);
    expect(mainExecutableFor).toHaveBeenCalledWith(programs[0]);
    expect(showFileProperties).toHaveBeenCalledWith(exe);
  });

  it('says so when the program is gone or has no file to show', async () => {
    expect((await post({ programId: 'nope' })).status).toBe(404);
    mainExecutableFor.mockResolvedValueOnce(null);
    const res = await post({ programId: 'app' });
    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/No program file/);
    expect(showFileProperties).not.toHaveBeenCalled();
  });

  it('passes on a sheet that would not open as a failure', async () => {
    showFileProperties.mockResolvedValueOnce({ ok: false, error: 'The Properties window did not open.' });
    const res = await post({ path: exe });
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'The Properties window did not open.' });
  });
});
