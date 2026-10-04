import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { get } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';
import { getStats } from '../services/stats.js';

/** The streaming Deep Clean endpoints with the cleaner running where it runs in
 * the app: on a worker thread. Same events, same shapes, same totals as before
 * (the frontend is unchanged), and the lifetime total still gets written by this
 * thread. Only the program list is stood in for -- it asks PowerShell. */

vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => [{ name: 'Some Game' }] }));

let server;
let root;
const saved = {};
const KEYS = ['UNREVO_CLEANERS_PATH', 'UNREVO_SETTINGS_PATH', 'UNREVO_QUARANTINE_ROOT', 'UNREVO_STATS_PATH', 'UNREVO_CLEAN_IN_THREAD'];

beforeAll(async () => {
  for (const key of KEYS) saved[key] = process.env[key];
  server = await startTestServer();
});
afterAll(async () => {
  await server.close();
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-dc-worker-'));
  process.env.UNREVO_SETTINGS_PATH = join(root, 'data', 'settings.json');
  process.env.UNREVO_QUARANTINE_ROOT = join(root, 'data', 'quarantine');
  process.env.UNREVO_STATS_PATH = join(root, 'data', 'stats.json');
  process.env.UNREVO_CLEANERS_PATH = join(root, 'rules.json');
  delete process.env.UNREVO_CLEAN_IN_THREAD;
  settings({});
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

function tree(name, count, bytes) {
  // The rules below match `<dir>\*`, i.e. the folders directly inside it.
  const dir = join(root, name);
  const folders = 5;
  for (let d = 0; d < folders; d++) mkdirSync(join(dir, `d${d}`), { recursive: true });
  for (let i = 0; i < count; i++) writeFileSync(join(dir, `d${i % folders}`, `f${i}.tmp`), Buffer.alloc(bytes, 1));
  return dir;
}
/** The settings the route reads. Files made a moment ago would otherwise be
 * skipped by the default "ignore the last 24 hours" guard. */
function settings(extra) {
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(process.env.UNREVO_SETTINGS_PATH, JSON.stringify({ skipRecentHours: 0, ...extra }));
}
const rule = (id, dir) => ({ id, category: 'Test', name: `Rule ${id}`, paths: [`${dir}\\*`], is_safe: true, recommended: true });
const rules = (...list) => writeFileSync(process.env.UNREVO_CLEANERS_PATH, JSON.stringify(list));

/** A GET on its own connection. fetch() reuses pooled sockets, and the one
 * left by an earlier stream in this file can be reset under it; a request whose
 * latency is the thing being measured should not depend on that. */
function getOnOwnConnection(path) {
  return new Promise((resolve, reject) => {
    get(server.base + path, { agent: false }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: text }));
    }).on('error', reject);
  });
}

/** The events of a text/event-stream body, as [name, data] pairs. */
function events(text) {
  return text.split('\n\n').filter(Boolean).map((block) => {
    const name = /^event: (.*)$/m.exec(block)?.[1];
    const data = JSON.parse(/^data: (.*)$/m.exec(block)?.[1] ?? 'null');
    return [name, data];
  });
}

describe('GET /deep-clean/scan/stream on the worker', () => {
  it('streams start, a rule event per rule with its real size, then done', async () => {
    rules(rule('a', tree('a', 10, 100)), rule('b', tree('b', 3, 5)));
    const res = await server.call('/deep-clean/scan/stream');
    const seen = events(res.body);

    expect(seen.map(([name]) => name)).toEqual(['start', 'rule', 'rule', 'done']);
    expect(seen[0][1]).toEqual({ total: 2 });
    expect(seen[1][1]).toMatchObject({ id: 'a', name: 'Rule a', category: 'Test', sizeBytes: 1000, fileCount: 10, present: true });
    expect(seen[2][1]).toMatchObject({ id: 'b', sizeBytes: 15, fileCount: 3 });
    expect(seen[3][1]).toEqual({ aborted: false, total: 2, scanned: 2 });
  });

  it('gates a rule on the installed programs the route found', async () => {
    rules({ ...rule('g', tree('g', 4, 10)), requiresProgram: 'Some Game' }, { ...rule('h', tree('h', 4, 10)), requiresProgram: 'Other Game' });
    const seen = events((await server.call('/deep-clean/scan/stream')).body).filter(([name]) => name === 'rule');
    expect(seen[0][1]).toMatchObject({ id: 'g', present: true, fileCount: 4 });
    expect(seen[1][1]).toMatchObject({ id: 'h', present: false, sizeBytes: 0 });
  });

  it('streams an error event when the cleaner fails', async () => {
    writeFileSync(process.env.UNREVO_CLEANERS_PATH, '{ broken');
    const res = await server.call('/deep-clean/scan/stream');
    const names = events(res.body).map(([name]) => name);
    expect(names).toContain('error');
    expect(names).not.toContain('done');
  });
});

describe('while a large folder is scanned', () => {
  it('keeps answering other requests promptly (the scan is not on this thread)', async () => {
    rules(rule('big', tree('big', 20000, 1)));
    const scan = getOnOwnConnection('/deep-clean/scan/stream');   // not awaited: it is the load
    await new Promise((resolve) => setTimeout(resolve, 400)); // the worker is up and walking by now

    const started = Date.now();
    const health = await getOnOwnConnection('/health');
    const took = Date.now() - started;
    expect(health.status).toBe(200);
    // In this thread the same walk holds the event loop for seconds.
    expect(took).toBeLessThan(500);

    const seen = events((await scan).body);
    expect(seen.at(-1)[0]).toBe('done');
  }, 30000);
});

describe('GET /deep-clean/execute/stream on the worker', () => {
  it('cleans, streams a rule event per rule, and adds exactly what was deleted to the lifetime total', async () => {
    // A delete-now setting is what makes the bytes "freed".
    settings({ deepCleanRemoval: 'delete' });
    rules(rule('a', tree('a', 10, 100)), rule('b', tree('b', 3, 5)));

    const res = await server.call('/deep-clean/execute/stream?ids=a,b');
    const seen = events(res.body);

    expect(seen.map(([name]) => name)).toEqual(['start', 'rule', 'rule', 'done']);
    expect(seen[1][1]).toMatchObject({ id: 'a', name: 'Rule a', freedBytes: 1000, movedBytes: 0 });
    expect(seen[2][1]).toMatchObject({ id: 'b', freedBytes: 15 });
    expect(seen[3][1]).toMatchObject({ aborted: false, total: 2, executed: 2, freedBytes: 1015 });
    expect(readdirSync(join(root, 'a'), { recursive: true, withFileTypes: true }).filter((e) => e.isFile())).toEqual([]);
    // Written once, by this thread, after the stream.
    expect((await getStats()).freedBytes).toBe(1015);
  });

  it('counts nothing for what only went to Quarantine', async () => {
    rules(rule('a', tree('a', 4, 10)));
    const res = await server.call('/deep-clean/execute/stream?ids=a');
    const seen = events(res.body);
    expect(seen[1][1]).toMatchObject({ id: 'a', freedBytes: 0, movedBytes: 40 });
    expect((await getStats()).freedBytes).toBe(0);
  });
});

describe('the one-shot endpoints on the worker', () => {
  it('GET /deep-clean/scan answers with the categories', async () => {
    rules(rule('a', tree('a', 4, 10)));
    const res = await server.call('/deep-clean/scan');
    expect(res.status).toBe(200);
    expect(res.body.categories).toHaveLength(1);
    expect(res.body.categories[0].items[0]).toMatchObject({ id: 'a', sizeBytes: 40 });
  });

  it('POST /deep-clean/execute answers with the summary and counts the freed bytes', async () => {
    settings({ deepCleanRemoval: 'delete' });
    rules(rule('a', tree('a', 4, 10)));
    const res = await server.call('/deep-clean/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruleIds: ['a'] })
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ freedBytes: 40, movedBytes: 0 });
    expect((await getStats()).freedBytes).toBe(40);
  });

  it('POST /deep-clean/execute is a 500 with the reason when the cleaner fails', async () => {
    writeFileSync(process.env.UNREVO_CLEANERS_PATH, '{ broken');
    const res = await server.call('/deep-clean/execute', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ruleIds: ['a'] })
    });
    expect(res.status).toBe(500);
    expect(res.body.error).toBeTruthy();
  });
});
