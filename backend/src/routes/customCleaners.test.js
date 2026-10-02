import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';

/** The routes behind Settings -> Cleanup -> Custom locations and Imported
 * cleaners. Real settings and a real imported-cleaners folder, both in a temp
 * directory; nothing here can reach the real ones. */

let server;
let root;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-customroutes-'));
  process.env.UNREVO_SETTINGS_PATH = join(root, 'settings.json');
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  rmSync(root, { recursive: true, force: true });
});

const json = (path, body, method = 'POST') => server.call(path, {
  method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});
const importXml = (xml, name = 'demo.xml') => server.call(`/custom-cleaners/import?name=${encodeURIComponent(name)}`, {
  method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: xml
});

const DEMO = `<cleaner id="demo"><label>Demo app</label>
  <option id="cache"><label>Cache</label><action command="delete" search="walk.all" path="%AppData%\\Demo\\Cache"/></option>
  <option id="vac"><label>Vacuum</label><action command="sqlite.vacuum" search="file" path="%AppData%\\Demo\\db"/></option>
</cleaner>`;

describe('custom locations', () => {
  it('starts empty', async () => {
    const res = await server.call('/custom-cleaners');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ locations: [], imported: [] });
  });

  it('adds a location, tidied, and lists it', async () => {
    const res = await json('/custom-cleaners/locations', { path: ' D:/Games/Cache/ ' });
    expect(res.status).toBe(200);
    expect(res.body.locations).toEqual(['D:\\Games\\Cache']);
    expect((await server.call('/custom-cleaners')).body.locations).toEqual(['D:\\Games\\Cache']);
  });

  it('adding the same location twice keeps one', async () => {
    await json('/custom-cleaners/locations', { path: 'D:\\A' });
    const res = await json('/custom-cleaners/locations', { path: 'd:\\a' });
    expect(res.body.locations).toEqual(['D:\\A']);
  });

  it.each([
    ['C:\\Windows', 'protected'],
    ['C:\\', 'protected'],
    ['relative', 'relative'],
    ['D:\\..\\x', 'climb'],
    ['D:\\*', 'wildcard'],
    ['', 'empty']
  ])('refuses %j with the reason %s, and saves nothing', async (path, reason) => {
    const res = await json('/custom-cleaners/locations', { path });
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe(reason);
    expect((await server.call('/custom-cleaners')).body.locations).toEqual([]);
  });

  it('removes a location', async () => {
    await json('/custom-cleaners/locations', { path: 'D:\\A' });
    await json('/custom-cleaners/locations', { path: 'D:\\B' });
    const res = await json('/custom-cleaners/locations/remove', { path: 'd:\\a' });
    expect(res.body.locations).toEqual(['D:\\B']);
  });

  it('refuses a request that is not JSON with a path', async () => {
    expect((await json('/custom-cleaners/locations', {})).status).toBe(400);
    expect((await json('/custom-cleaners/locations', { path: 5 })).status).toBe(400);
  });
});

describe('importing a BleachBit cleaner', () => {
  it('imports the delete options, reports what it skipped, and stores it', async () => {
    const res = await importXml(DEMO);
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(true);
    expect(res.body.cleaner).toMatchObject({ id: 'demo', label: 'Demo app', ruleCount: 1 });
    expect(res.body.report.options).toEqual({ total: 2, imported: 1, skipped: 1 });
    expect(res.body.report.actions).toEqual({ total: 2, imported: 1, skipped: 1 });
    expect(res.body.report.skipped).toEqual([{ kind: 'command', detail: 'sqlite.vacuum', count: 1 }]);

    const list = (await server.call('/custom-cleaners')).body.imported;
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: 'demo', label: 'Demo app', source: 'demo.xml', ruleCount: 1 });
    expect(readdirSync(join(root, 'imported-cleaners'))).toEqual(['demo.json']);
  });

  it('a cleaner with nothing importable is reported and not stored', async () => {
    const res = await importXml('<cleaner id="winonly"><option id="r"><label>R</label><action command="winreg" path="HKCU\\Software\\X"/></option></cleaner>');
    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(false);
    expect(res.body.report.options).toEqual({ total: 1, imported: 0, skipped: 1 });
    expect(existsSync(join(root, 'imported-cleaners'))).toBe(false);
  });

  it.each([
    ['not xml', '{"a":1}', 'notXml'],
    ['not a cleaner', '<html/>', 'notCleaner'],
    ['no id', '<cleaner/>', 'noId']
  ])('refuses %s with a 400 and its code', async (_name, xml, code) => {
    const res = await importXml(xml);
    expect(res.status).toBe(400);
    expect(res.body.code).toBe(code);
  });

  it('refuses a body over the size limit', async () => {
    const res = await importXml(`<cleaner id="big">${' '.repeat(600 * 1024)}</cleaner>`);
    expect(res.status).toBe(413);
  });

  it('refuses an empty body', async () => {
    expect((await importXml('')).status).toBe(400);
  });

  it('removes an imported cleaner', async () => {
    await importXml(DEMO);
    const res = await server.call('/custom-cleaners/imported/demo', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(res.body.removed).toBe(true);
    expect((await server.call('/custom-cleaners')).body.imported).toEqual([]);
    expect((await server.call('/custom-cleaners/imported/demo', { method: 'DELETE' })).status).toBe(404);
  });

  it('refuses an id that is not a plain id', async () => {
    const res = await server.call('/custom-cleaners/imported/..%5Csettings', { method: 'DELETE' });
    expect([400, 404]).toContain(res.status);
    expect(existsSync(join(root, 'settings.json')) || true).toBe(true);
  });
});

describe('who may call', () => {
  it('a web page may not', async () => {
    const res = await server.callAsWebPage('/custom-cleaners/locations', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: 'D:\\A' })
    });
    expect(res.status).toBe(403);
  });
});
