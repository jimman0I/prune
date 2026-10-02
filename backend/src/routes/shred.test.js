import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';

/** The Shred tool's routes, against a real server and real temp files.
 * The settings are mocked so the user's exclusions can be injected; no real
 * settings file is read or written. */

let settings = {};
vi.mock('../services/settings.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSettings: async () => settings };
});

let server;
let dir;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(async () => { settings = {}; dir = await mkdtemp(join(tmpdir(), 'prune-shred-route-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

const post = (path, body) => server.call(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

/** The 'event: x / data: {...}' blocks of a text/event-stream body. */
function events(text) {
  return String(text).split('\n\n').filter(Boolean).map((block) => {
    const event = /^event: (.*)$/m.exec(block)?.[1];
    const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null');
    return { event, data };
  });
}

describe('POST /shred/preview', () => {
  it('counts what would be destroyed and touches nothing', async () => {
    await writeFile(join(dir, 'a.txt'), 'aaaa');
    const res = await post('/shred/preview', { paths: [join(dir, 'a.txt')] });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ files: 1, bytes: 4, refused: [], truncated: false });
    expect(existsSync(join(dir, 'a.txt'))).toBe(true);
  });

  it('is a 400 for input that is not a list of paths', async () => {
    for (const body of [undefined, {}, { paths: 'x' }, { paths: [] }, { paths: [1] }]) {
      expect((await post('/shred/preview', body)).status, JSON.stringify(body)).toBe(400);
    }
  });
});

describe('POST /shred', () => {
  it('will not shred anything unless the request says it was confirmed', async () => {
    await writeFile(join(dir, 'a.txt'), 'aaaa');
    for (const confirmed of [undefined, false, 'true', 1]) {
      const res = await post('/shred', { paths: [join(dir, 'a.txt')], passes: 1, confirmed });
      expect(res.status).toBe(400);
    }
    expect(existsSync(join(dir, 'a.txt'))).toBe(true);
  });

  it('shreds the files and streams a result', async () => {
    await mkdir(join(dir, 'tree'));
    await writeFile(join(dir, 'tree', 'a.txt'), 'aaaa');
    await writeFile(join(dir, 'b.txt'), 'bb');

    const res = await post('/shred', { paths: [join(dir, 'tree'), join(dir, 'b.txt')], passes: 3, confirmed: true });

    expect(res.status).toBe(200);
    const done = events(res.body).find((e) => e.event === 'done');
    expect(done.data).toMatchObject({ shreddedFiles: 2, bytes: 6, aborted: false });
    expect(done.data.failed).toEqual([]);
    expect(existsSync(join(dir, 'tree'))).toBe(false);
    expect(existsSync(join(dir, 'b.txt'))).toBe(false);
  });

  it("will not shred a path inside the user's excluded folders", async () => {
    settings = { excludeFolders: [join(dir, 'keep')] };
    await mkdir(join(dir, 'keep'));
    await writeFile(join(dir, 'keep', 'important.txt'), 'x');

    const res = await post('/shred', { paths: [join(dir, 'keep', 'important.txt')], passes: 1, confirmed: true });

    const done = events(res.body).find((e) => e.event === 'done');
    expect(done.data.shreddedFiles).toBe(0);
    expect(done.data.held).toHaveLength(1);
    expect(existsSync(join(dir, 'keep', 'important.txt'))).toBe(true);
  });

  it('will not shred Windows or a whole drive', async () => {
    const windows = process.env.SystemRoot || 'C:\\Windows';
    const res = await post('/shred', { paths: [windows, 'C:\\'], passes: 1, confirmed: true });
    const done = events(res.body).find((e) => e.event === 'done');
    expect(done.data.shreddedFiles).toBe(0);
    expect(done.data.held).toHaveLength(2);
    expect(existsSync(windows)).toBe(true);
  });

  it('treats any passes value other than 3 as 1', async () => {
    await writeFile(join(dir, 'a.txt'), 'aaaa');
    const res = await post('/shred', { paths: [join(dir, 'a.txt')], passes: 99, confirmed: true });
    expect(events(res.body).find((e) => e.event === 'done').data.passes).toBe(1);
  });

  it('is not reachable by a GET', async () => {
    expect((await server.call('/shred')).status).toBe(404);
  });

  it('is refused for a request from a web page', async () => {
    await writeFile(join(dir, 'a.txt'), 'aaaa');
    const res = await server.callAsWebPage('/shred', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paths: [join(dir, 'a.txt')], passes: 1, confirmed: true })
    });
    expect(res.status).toBe(403);
    expect(existsSync(join(dir, 'a.txt'))).toBe(true);
  });
});
