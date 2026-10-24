import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, utimes } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';

/** The Junk files routes against a real server, a real scratch settings file
 * and real temp files. The installed-programs list is the one thing stood in
 * for: reading it runs PowerShell, and these tests are about the routes. */

vi.mock('../services/programs.js', async (importOriginal) => ({
  ...(await importOriginal()),
  listInstalledPrograms: async () => []
}));

let server;
let dir;
const saved = {};
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'prune-junk-route-'));
  for (const key of ['UNREVO_SETTINGS_PATH', 'UNREVO_QUARANTINE_ROOT']) saved[key] = process.env[key];
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'data', 'settings.json');
  process.env.UNREVO_QUARANTINE_ROOT = join(dir, 'data', 'quarantine');
});
afterEach(async () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(dir, { recursive: true, force: true });
});

const post = (path, body) => server.call(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body)
});

function events(text) {
  return String(text).split('\n\n').filter(Boolean).map((block) => ({
    event: /^event: (.*)$/m.exec(block)?.[1],
    data: JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null')
  }));
}

const touch = async (rel, body = 'x', ageHours = 100) => {
  const full = join(dir, 'files', rel);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, body);
  const when = new Date(Date.now() - ageHours * 3600_000);
  await utimes(full, when, when);
  return full;
};

describe('the patterns', () => {
  it('start as the defaults, each saying whether its results start ticked', async () => {
    const res = await server.call('/junk-files/patterns');
    expect(res.status).toBe(200);
    expect(res.body.patterns.map((p) => p.pattern)).toContain('*.tmp');
    expect(res.body.patterns.find((p) => p.pattern === '*.tmp')).toEqual({ pattern: '*.tmp', enabled: true, preselected: true });
    expect(res.body.patterns.find((p) => p.pattern === '*.bak')).toEqual({ pattern: '*.bak', enabled: false, preselected: false });
    expect(res.body.defaults).toEqual(res.body.patterns);
  });

  it('saves a whole new list', async () => {
    const res = await post('/junk-files/patterns', { patterns: [{ pattern: '*.tmp', enabled: false }, '*.junk'] });
    expect(res.status).toBe(200);
    expect(res.body.patterns).toEqual([
      { pattern: '*.tmp', enabled: false, preselected: true },
      { pattern: '*.junk', enabled: true, preselected: false }
    ]);
    expect((await server.call('/junk-files/patterns')).body.patterns).toEqual(res.body.patterns);
  });

  it('refuses the whole list over one bad entry, naming it and why, and saves nothing', async () => {
    for (const [pattern, reason] of [['*', 'everything'], ['*.*', 'everything'], ['*.exe', 'executable'], ['*.dll', 'executable'],
      ['desktop.ini', 'desktopIni'], ['C:\\x\\*.tmp', 'separator'], ['', 'empty']]) {
      const res = await post('/junk-files/patterns', { patterns: ['*.tmp', { pattern, enabled: true }] });
      expect(res.status, pattern).toBe(400);
      expect(res.body.reason, pattern).toBe(reason);
    }
    const dup = await post('/junk-files/patterns', { patterns: ['*.tmp', '*.TMP'] });
    expect(dup.body).toMatchObject({ reason: 'duplicate', pattern: '*.TMP' });
    expect((await post('/junk-files/patterns', { patterns: 'x' })).status).toBe(400);
    expect(existsSync(process.env.UNREVO_SETTINGS_PATH)).toBe(false);
  });

  it('resets to the defaults', async () => {
    await post('/junk-files/patterns', { patterns: ['*.junk'] });
    const res = await post('/junk-files/patterns/reset');
    expect(res.status).toBe(200);
    expect(res.body.patterns).toEqual((await server.call('/junk-files/patterns')).body.defaults);
  });
});

describe('POST /junk-files/scan', () => {
  it('is a 400 without a list of drives or folders', async () => {
    for (const body of [undefined, {}, { roots: [] }, { roots: 'C:\\' }, { roots: [3] }]) {
      const res = await post('/junk-files/scan', body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.reason).toBe('noRoots');
    }
  });

  it('is a 400 when nothing it was given can be scanned, saying why for each', async () => {
    const windows = process.env.SystemRoot || 'C:\\Windows';
    const res = await post('/junk-files/scan', { roots: [join(dir, 'nope'), 'relative', windows] });
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('noUsableRoots');
    expect(res.body.refused.map((r) => r.reason)).toEqual(['missing', 'relative', 'protected']);
  });

  it('is a 400 when every pattern is turned off', async () => {
    await post('/junk-files/patterns', { patterns: [{ pattern: '*.tmp', enabled: false }] });
    await touch('a.tmp');
    const res = await post('/junk-files/scan', { roots: [join(dir, 'files')] });
    expect(res.status).toBe(400);
    expect(res.body.reason).toBe('noPatterns');
  });

  it('streams what it finds, then a summary, and removes nothing', async () => {
    const a = await touch('a.tmp', 'aaa');
    await touch('b.old');
    await touch('new.tmp', 'x', 1);
    await touch('keep.txt');
    const res = await post('/junk-files/scan', { roots: [join(dir, 'files'), join(dir, 'missing')] });
    expect(res.status).toBe(200);
    const list = events(res.body);
    const start = list.find((e) => e.event === 'start').data;
    expect(start.roots).toEqual([join(dir, 'files')]);
    expect(start.refused).toEqual([{ path: join(dir, 'missing'), reason: 'missing' }]);
    expect(start.patterns.every((p) => p.enabled)).toBe(true);
    const files = list.filter((e) => e.event === 'files').flatMap((e) => e.data.files);
    expect(files.map((f) => f.pattern).sort()).toEqual(['*.old', '*.tmp']);
    expect(files.find((f) => f.path === a)).toMatchObject({ sizeBytes: 3, pattern: '*.tmp' });
    const done = list.find((e) => e.event === 'done').data;
    expect(done).toMatchObject({ offered: 2, truncated: null });
    expect(done.skipped.recent).toBe(1);
    expect(existsSync(a)).toBe(true);
  });
});

describe('POST /junk-files/remove', () => {
  it('removes nothing unless the request says it was confirmed', async () => {
    const a = await touch('a.tmp');
    for (const confirmed of [undefined, false, 'true', 1]) {
      const res = await post('/junk-files/remove', { paths: [a], confirmed });
      expect(res.status).toBe(400);
    }
    expect(existsSync(a)).toBe(true);
  });

  it('is a 400 for anything that is not a list of paths', async () => {
    for (const body of [undefined, {}, { paths: [] }, { paths: 'x' }, { paths: [1] }, { paths: [''] }]) {
      expect((await post('/junk-files/remove', { ...body, confirmed: true })).status, JSON.stringify(body)).toBe(400);
    }
  });

  it('moves the files that still qualify into Quarantine as one batch, and says why the rest stayed', async () => {
    const a = await touch('a.tmp', 'aaaa');
    const b = await touch('b.tmp', 'bb');
    const notJunk = await touch('keep.txt');
    const res = await post('/junk-files/remove', { paths: [a, b, notJunk], confirmed: true });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ mode: 'quarantine', movedBytes: 6, freedBytes: 0, removedCount: 2 });
    expect(res.body.results[0].quarantineBatch).toBeTruthy();
    expect(res.body.results[0].skippedCount).toBe(1);
    expect(res.body.results[0].skipped[0]).toMatchObject({ path: notJunk });
    expect(existsSync(a)).toBe(false);
    expect(existsSync(notJunk)).toBe(true);
  });

  it('takes a long list of paths in one request', async () => {
    const a = await touch('a.tmp');
    const filler = Array.from({ length: 4000 }, (_, i) => join(dir, 'files', `missing-${'x'.repeat(40)}-${i}.tmp`));
    const res = await post('/junk-files/remove', { paths: [a, ...filler], confirmed: true });
    expect(res.status).toBe(200);
    expect(res.body.removedCount).toBe(1);
    expect(res.body.results[0].skippedCount).toBe(4000);
    expect(res.body.results[0].skipped).toHaveLength(200);
    // ...but which paths stayed is said in full, so none vanish from the list.
    expect(res.body.keptPaths).toHaveLength(4000);
    expect(res.body.keptPaths).not.toContain(a);
  });
});

describe('who may call it', () => {
  it('refuses a web page', async () => {
    expect((await server.callAsWebPage('/junk-files/patterns')).status).toBe(403);
  });
});
