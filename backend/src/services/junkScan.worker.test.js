import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, utimesSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanJunk, removeJunk } from '../lib/cleanJobs.js';
import { scanJunkFiles } from './junkScan.js';
import { defaultJunkPatterns } from '../lib/junkPatterns.js';

/** The Junk files scan on a REAL worker thread (the suite otherwise runs jobs
 * in-thread, see vitest.config.js), against real folders: same answer as the
 * in-thread scan, results relayed as they are found, a Stop that ends the
 * walk at once, and a removal that really moves files. */

let root;
const saved = {};
const KEYS = ['UNREVO_SETTINGS_PATH', 'UNREVO_QUARANTINE_ROOT', 'UNREVO_CLEAN_IN_THREAD'];

beforeAll(() => { for (const key of KEYS) saved[key] = process.env[key]; });
afterAll(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
  }
});
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-junk-worker-'));
  process.env.UNREVO_SETTINGS_PATH = join(root, 'data', 'settings.json');
  process.env.UNREVO_QUARANTINE_ROOT = join(root, 'data', 'quarantine');
  delete process.env.UNREVO_CLEAN_IN_THREAD;
});
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const OLD = new Date(Date.now() - 100 * 3600_000);
function tree(name, count) {
  const dir = join(root, name);
  for (let d = 0; d < 10; d++) mkdirSync(join(dir, `d${d}`), { recursive: true });
  for (let i = 0; i < count; i++) {
    const file = join(dir, `d${i % 10}`, i % 2 ? `f${i}.tmp` : `f${i}.txt`);
    writeFileSync(file, 'x');
    utimesSync(file, OLD, OLD);
  }
  return dir;
}
const job = (roots) => ({ roots, patterns: defaultJunkPatterns(), guards: { skipRecentHours: 24 }, footprints: [] });

describe('the Junk files scan on the worker', () => {
  it('finds exactly what the in-thread scan finds, relayed in batches', async () => {
    const dir = tree('t', 600);
    const inThread = [];
    const expected = await scanJunkFiles({ ...job([dir]), onFiles: (b) => inThread.push(...b) });

    const fromWorker = [];
    let batches = 0;
    const summary = await scanJunk(job([dir]), { onFiles: (b) => { batches += 1; fromWorker.push(...b); } });

    const paths = (list) => list.map((f) => f.path).sort();
    expect(paths(fromWorker)).toEqual(paths(inThread));
    expect(fromWorker).toHaveLength(300);
    expect(batches).toBeGreaterThan(1);
    expect(summary).toEqual(expected);
  });

  it('ends the walk promptly on Stop and says it was stopped', async () => {
    const dir = tree('big', 30000);
    const controller = new AbortController();
    const started = Date.now();
    const promise = scanJunk(job([dir]), { signal: controller.signal });
    setTimeout(() => controller.abort(), 50);
    const summary = await promise;
    expect(summary).toEqual({ aborted: true });
    expect(Date.now() - started).toBeLessThan(2500);
  }, 60000);

  it('removes the ticked files on the worker, into the Quarantine folder it was told about', async () => {
    const dir = tree('r', 20);
    const found = [];
    await scanJunk(job([dir]), { onFiles: (b) => found.push(...b) });
    const result = await removeJunk({ ...job([dir]), paths: found.map((f) => f.path), guards: { skipRecentHours: 24, removal: 'quarantine' } });
    expect(result.removedCount).toBe(10);
    expect(result.movedBytes).toBe(10);
    expect(found.every((f) => !existsSync(f.path))).toBe(true);
    expect(readdirSync(process.env.UNREVO_QUARANTINE_ROOT)).toHaveLength(1);
  });
});
