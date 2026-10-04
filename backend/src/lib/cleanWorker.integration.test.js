import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCleanJob } from './cleanJobRunner.js';
import { runCleanJobInWorker } from './cleanWorkerHost.js';
import * as jobs from './cleanJobs.js';

/** Deep Clean on a REAL worker thread, against real folders, with a one-off
 * rule file standing in for cleaners.json (UNREVO_CLEANERS_PATH) so nothing
 * outside the temp folder is ever looked at. The question each test asks is
 * whether the worker gives the answer the in-thread functions give, and keeps
 * the properties the app depends on: Stop, errors, and a single writer of the
 * lifetime total. */

let root;
const saved = {};
const KEYS = [
  'UNREVO_CLEANERS_PATH', 'UNREVO_SETTINGS_PATH', 'UNREVO_QUARANTINE_ROOT', 'UNREVO_STATS_PATH', 'UNREVO_CLEAN_IN_THREAD'
];

beforeAll(() => {
  for (const key of KEYS) saved[key] = process.env[key];
});
afterAll(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-worker-'));
  process.env.UNREVO_SETTINGS_PATH = join(root, 'data', 'settings.json');
  process.env.UNREVO_QUARANTINE_ROOT = join(root, 'data', 'quarantine');
  process.env.UNREVO_STATS_PATH = join(root, 'data', 'stats.json');
  process.env.UNREVO_CLEANERS_PATH = join(root, 'rules.json');
  // These tests are about the worker: the suite-wide in-thread switch is off here.
  delete process.env.UNREVO_CLEAN_IN_THREAD;
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** `count` small files spread over a few folders, `bytes` each. */
function tree(name, count, bytes = 10) {
  const dir = join(root, name);
  const folders = 10;
  for (let d = 0; d < folders; d++) mkdirSync(join(dir, `d${d}`), { recursive: true });
  for (let i = 0; i < count; i++) writeFileSync(join(dir, `d${i % folders}`, `f${i}.tmp`), Buffer.alloc(bytes, 1));
  return dir;
}
const rule = (id, dir) => ({ id, category: 'Test', name: `Rule ${id}`, paths: [`${dir}\\*`], is_safe: true, recommended: true });
const rules = (...list) => writeFileSync(process.env.UNREVO_CLEANERS_PATH, JSON.stringify(list));
const filesLeft = (dir) => readdirSync(dir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile()).length;

describe('a scan on the worker', () => {
  it('reports the same rules, in the same order, as the in-thread scan', async () => {
    rules(rule('one', tree('one', 40, 100)), rule('two', tree('two', 7, 3)), rule('none', join(root, 'does-not-exist')));

    const inThread = [];
    const inThreadSummary = await runCleanJob({ op: 'scan', guards: {} }, { post: (m) => { if (m.type === 'rule') inThread.push(m.item); } });

    const fromWorker = [];
    const summary = await jobs.scanRules((item) => fromWorker.push(item), {});

    expect(fromWorker.map((i) => i.id)).toEqual(['one', 'two', 'none']);
    expect(fromWorker).toEqual(inThread);
    expect(summary).toEqual(inThreadSummary);
    expect(fromWorker[0]).toMatchObject({ sizeBytes: 4000, fileCount: 40, present: true });
  });

  it('gives the one-shot scan the same categories as scanAllRules', async () => {
    rules(rule('one', tree('one', 12, 5)), rule('two', tree('two', 3, 5)));
    const { scanAllRules } = await import('./cleanerRules.js');
    expect(await jobs.scanEverything({})).toEqual(scanAllRules({}));
  });

  it('applies the guards it is given', async () => {
    const dir = tree('guarded', 6, 10);
    rules(rule('guarded', dir));
    const seen = [];
    await jobs.scanRules((item) => seen.push(item), { excludeFolders: [join(dir, 'd0')] });
    // one folder of ten left out: 6 files over 10 folders puts one file in d0..d5
    expect(seen[0].fileCount).toBe(5);
  });

  it('does not pass a Set of installed program names through as nothing', async () => {
    // A rule that requires a program is gated on the names it is handed; a Set
    // has to survive the trip to the thread.
    const gated = { ...rule('gated', tree('gated', 4, 10)), requiresProgram: 'Some Game' };
    rules(gated);
    const missing = [];
    await jobs.scanRules((item) => missing.push(item), { installedProgramNames: new Set(['other']) });
    expect(missing[0]).toMatchObject({ present: false, sizeBytes: 0 });
    const there = [];
    await jobs.scanRules((item) => there.push(item), { installedProgramNames: new Set(['some game']) });
    expect(there[0]).toMatchObject({ present: true, fileCount: 4 });
  });
});

describe('a clean on the worker', () => {
  it('frees the same bytes as the in-thread clean, and reports each rule as it finishes', async () => {
    rules(
      rule('a-thread', tree('a-thread', 30, 20)), rule('a-worker', tree('a-worker', 30, 20)),
      rule('b-thread', tree('b-thread', 5, 7)), rule('b-worker', tree('b-worker', 5, 7))
    );
    const guards = { removal: 'delete' };

    const inThread = [];
    const expected = await runCleanJob({ op: 'execute', ids: ['a-thread', 'b-thread'], guards },
      { post: (m) => { if (m.type === 'rule') inThread.push(m.item); } });

    const reported = [];
    const summary = await jobs.executeRulesStreamed(['a-worker', 'b-worker'], (item) => reported.push(item), guards);

    const strip = ({ id, name, category, ...rest }) => rest;
    expect(reported.map((r) => r.id)).toEqual(['a-worker', 'b-worker']);
    expect(reported.map(strip)).toEqual(inThread.map(strip));
    expect(summary.freedBytes).toBe(expected.freedBytes);
    expect(summary.freedBytes).toBe(30 * 20 + 5 * 7);
    expect(summary.aborted).toBe(false);
    expect(summary.executed).toBe(2);
    expect(filesLeft(join(root, 'a-worker'))).toBe(0);
  });

  it('moves files into the Quarantine folder the process was told about', async () => {
    rules(rule('q', tree('q', 8, 10)));
    const summary = await jobs.executeToSummary(['q'], { removal: 'quarantine', autoQuarantine: true });
    expect(summary.movedBytes).toBe(80);
    expect(summary.freedBytes).toBe(0);
    const batches = readdirSync(process.env.UNREVO_QUARANTINE_ROOT);
    expect(batches).toHaveLength(1);
    expect(existsSync(join(process.env.UNREVO_QUARANTINE_ROOT, batches[0], 'manifest.json'))).toBe(true);
    expect(filesLeft(join(root, 'q'))).toBe(0);
  });

  it('leaves the lifetime total to the thread that started it: the worker writes no stats', async () => {
    rules(rule('s', tree('s', 8, 10)));
    await jobs.executeToSummary(['s'], { removal: 'delete' });
    expect(existsSync(process.env.UNREVO_STATS_PATH)).toBe(false);
  });

  it('runs one rule by id for the tray, and says so when there is no such rule', async () => {
    rules(rule('user_temp', tree('user_temp', 6, 10)));
    expect(await jobs.executeRuleById('user_temp', { removal: 'delete' })).toMatchObject({ id: 'user_temp', freedBytes: 60 });
    expect(await jobs.executeRuleById('not_a_rule', {})).toBeNull();
  });

  it('reports an unknown rule id the way the in-thread clean does', async () => {
    rules(rule('real', tree('real', 2, 1)));
    const items = [];
    const summary = await jobs.executeRulesStreamed(['nope', 'real'], (item) => items.push(item), { removal: 'delete' });
    expect(items[0]).toEqual({ id: 'nope', error: 'Unknown rule id "nope"' });
    expect(summary.executed).toBe(2);
  });
});

describe('errors', () => {
  it('rejects with the worker\'s message when the job cannot run', async () => {
    await expect(runCleanJobInWorker({ op: 'bogus', guards: {} })).rejects.toThrow('Unknown clean job "bogus".');
  });

  it('rejects when the rule file is not readable, instead of hanging or crashing', async () => {
    writeFileSync(process.env.UNREVO_CLEANERS_PATH, '{ not json');
    await expect(jobs.scanRules(() => {}, {})).rejects.toThrow();
  });
});

describe('Stop', () => {
  it('ends a scan promptly even in the middle of a large folder, and tells the caller it was stopped', async () => {
    rules(rule('big', tree('big', 20000, 1)));
    const controller = new AbortController();
    const started = Date.now();
    const promise = jobs.scanRules(() => {}, { signal: controller.signal });
    setTimeout(() => controller.abort(), 100);
    const summary = await promise;
    expect(summary.aborted).toBe(true);
    // The synchronous walk of 20,000 files takes seconds; Stop did not wait for it.
    expect(Date.now() - started).toBeLessThan(2500);
  }, 20000);

  it('lets the rule in flight finish and does not start the next one', async () => {
    rules(rule('first', tree('first', 8000, 1)), rule('second', tree('second', 400, 1)));
    const controller = new AbortController();
    const reported = [];
    const promise = jobs.executeRulesStreamed(['first', 'second'], (item) => reported.push(item), {
      signal: controller.signal, removal: 'delete'
    });
    setTimeout(() => controller.abort(), 100);
    const summary = await promise;

    expect(summary.aborted).toBe(true);
    expect(summary.executed).toBe(1);
    expect(reported.map((r) => r.id)).toEqual(['first']);
    // The rule that was running completed: nothing half-done...
    expect(filesLeft(join(root, 'first'))).toBe(0);
    expect(reported[0].freedBytes).toBe(8000);
    // ...and the next one never began.
    expect(filesLeft(join(root, 'second'))).toBe(400);
  }, 60000);
});
