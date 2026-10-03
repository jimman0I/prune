import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';

let server;
let dir;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-auto-routes-'));
  process.env.UNREVO_SCANS_DIR = join(dir, 'scans');
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
});
afterEach(() => {
  delete process.env.UNREVO_SCANS_DIR;
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(dir, { recursive: true, force: true });
});

const archive = (size, letter = 'C') => ({ v: 1, root: { n: `${letter}:`, s: size, c: [{ n: 'Games', s: size }] }, top: [] });
const json = (method, path, body) => server.call(path, {
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});
const autoSave = (size, extra = {}) => json('POST', '/saved-scans/auto', { drive: 'C', label: 'Automatic scan of C:', source: 'fast', archive: archive(size), ...extra });

describe('/saved-scans/auto', () => {
  it('saves a scan for a drive and lists it back', async () => {
    const saved = await autoSave(100, { capacityBytes: 5000 });
    expect(saved.status).toBe(201);
    expect(saved.body.scan).toMatchObject({ auto: true, drive: 'C', capacityBytes: 5000 });
    const list = await server.call('/saved-scans/auto?drive=C');
    expect(list.status).toBe(200);
    expect(list.body.scans.map((s) => s.id)).toEqual([saved.body.scan.id]);
    expect(list.body.count).toBe(1);
    expect(list.body.bytes).toBeGreaterThan(0);
  });

  it('keeps the latest two per drive', async () => {
    const ids = [];
    for (const size of [1, 2, 3]) ids.push((await autoSave(size)).body.scan.id);
    const list = await server.call('/saved-scans/auto?drive=C');
    expect(list.body.scans.map((s) => s.id)).toEqual([ids[2], ids[1]]);
    expect((await server.call(`/saved-scans/${ids[0]}`)).status).toBe(404);
  });

  it('leaves a manual save alone', async () => {
    const manual = (await json('POST', '/saved-scans', { label: 'mine', archive: archive(9) })).body.scan.id;
    for (const size of [1, 2, 3, 4]) await autoSave(size);
    expect((await server.call(`/saved-scans/${manual}`)).status).toBe(200);
  });

  it('refuses a bad drive or an archive of another drive with a 400', async () => {
    expect((await json('POST', '/saved-scans/auto', { drive: '..', archive: archive(1) })).status).toBe(400);
    expect((await json('POST', '/saved-scans/auto', { archive: archive(1) })).status).toBe(400);
    expect((await json('POST', '/saved-scans/auto', { drive: 'D', archive: archive(1) })).status).toBe(400);
    expect((await json('POST', '/saved-scans/auto', { drive: 'C', archive: { v: 9 } })).status).toBe(400);
  });

  it('saves nothing while the setting is off, and says so', async () => {
    writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ rememberDiskMapScans: false }));
    const res = await autoSave(100);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ scan: null, skipped: 'off' });
    expect((await server.call('/saved-scans/auto')).body.scans).toEqual([]);
  });

  it('saves when the setting is on, and when the settings file has never said', async () => {
    expect((await autoSave(1)).status).toBe(201);
    writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ rememberDiskMapScans: true }));
    expect((await autoSave(2)).status).toBe(201);
  });

  it('lists every drive without a filter, and ignores a malformed filter', async () => {
    await autoSave(1);
    await json('POST', '/saved-scans/auto', { drive: 'D', archive: archive(1, 'D') });
    expect((await server.call('/saved-scans/auto')).body.count).toBe(2);
    expect((await server.call('/saved-scans/auto?drive=D')).body.count).toBe(1);
    expect((await server.call('/saved-scans/auto?drive=..%2Fx')).body.count).toBe(2);
  });

  it('deletes only the automatic scans', async () => {
    const manual = (await json('POST', '/saved-scans', { label: 'mine', archive: archive(9) })).body.scan.id;
    await autoSave(1);
    await autoSave(2);
    const res = await json('DELETE', '/saved-scans/auto');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ deleted: 2 });
    expect((await server.call('/saved-scans')).body.scans.map((s) => s.id)).toEqual([manual]);
    expect((await json('DELETE', '/saved-scans/auto')).body).toEqual({ deleted: 0 });
  });

  it('opens an automatic scan and compares two like any other saved scan', async () => {
    const a = (await autoSave(100)).body.scan.id;
    const b = (await autoSave(400)).body.scan.id;
    expect((await server.call(`/saved-scans/${b}`)).body.archive.root.s).toBe(400);
    const cmp = await server.call(`/saved-scans/compare?a=${a}&b=${b}&limit=5`);
    expect(cmp.body.delta).toBe(300);
    expect(cmp.body.grew[0]).toMatchObject({ path: 'C:\\Games', delta: 300 });
  });
});
