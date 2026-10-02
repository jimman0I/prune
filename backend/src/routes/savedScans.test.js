import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';

let server;
let dir;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-saved-routes-'));
  process.env.UNREVO_SCANS_DIR = join(dir, 'scans');
});
afterEach(() => {
  delete process.env.UNREVO_SCANS_DIR;
  rmSync(dir, { recursive: true, force: true });
});

const archive = (size) => ({ v: 1, root: { n: 'C:', s: size, c: [{ n: 'Games', s: size }] }, top: [] });
const json = (method, path, body) => server.call(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

describe('/saved-scans', () => {
  it('saves, lists, opens and deletes a scan', async () => {
    const saved = await json('POST', '/saved-scans', { label: 'Before', source: 'fast', archive: archive(100) });
    expect(saved.status).toBe(201);
    const id = saved.body.scan.id;

    expect((await server.call('/saved-scans')).body.scans.map((s) => s.id)).toEqual([id]);

    const opened = await server.call(`/saved-scans/${id}`);
    expect(opened.status).toBe(200);
    expect(opened.body.archive.root.s).toBe(100);
    expect(opened.body.scan.label).toBe('Before');

    expect((await json('DELETE', `/saved-scans/${id}`)).body).toEqual({ deleted: true });
    expect((await server.call('/saved-scans')).body.scans).toEqual([]);
  });

  it('refuses a save whose archive is not valid', async () => {
    const res = await json('POST', '/saved-scans', { label: 'x', archive: { v: 9 } });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/saved-scan file/);
  });

  it('accepts a body far larger than the default JSON limit', async () => {
    const big = { v: 1, root: { n: 'C:', s: 1, c: Array.from({ length: 40000 }, (_, i) => ({ n: `folder-number-${i}`, s: 1, f: 3, d: 0 })) }, top: [] };
    expect(JSON.stringify(big).length).toBeGreaterThan(1_000_000);
    const res = await json('POST', '/saved-scans', { label: 'big', archive: big });
    expect(res.status).toBe(201);
  });

  it('answers 404 for a scan that is not there and 404 for an id of the wrong shape', async () => {
    expect((await server.call('/saved-scans/abcdef123456')).status).toBe(404);
    expect((await server.call('/saved-scans/..%2F..%2Fsettings')).status).toBe(404);
    expect((await json('DELETE', '/saved-scans/abcdef123456')).status).toBe(404);
  });

  it('compares two saved scans', async () => {
    const a = (await json('POST', '/saved-scans', { label: 'old', archive: archive(100) })).body.scan.id;
    await new Promise((r) => setTimeout(r, 5));
    const b = (await json('POST', '/saved-scans', { label: 'new', archive: archive(400) })).body.scan.id;
    const res = await server.call(`/saved-scans/compare?a=${b}&b=${a}`);
    expect(res.status).toBe(200);
    expect(res.body.delta).toBe(300);
    expect(res.body.older.label).toBe('old');
    expect(res.body.grew[0].path).toBe('C:\\Games');
  });

  it('refuses to compare without two valid ids, or with a missing scan', async () => {
    expect((await server.call('/saved-scans/compare?a=abcdef123456')).status).toBe(400);
    expect((await server.call('/saved-scans/compare?a=../x&b=abcdef123456')).status).toBe(400);
    expect((await server.call('/saved-scans/compare?a=abcdef123456&b=abcdef654321')).status).toBe(404);
  });
});
