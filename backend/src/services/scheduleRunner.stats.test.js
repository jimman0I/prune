import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** A scheduled clean always quarantines, so it normally frees nothing; the
 * bytes it does delete (a database compacted in place) still count. */

const executeRules = vi.fn();
vi.mock('../lib/cleanerRules.js', () => ({
  scanAllRules: () => [{ category: 'Windows', items: [{ id: 'temp', recommended: true, present: true, sizeBytes: 10 }] }],
  executeRules: (...a) => executeRules(...a)
}));
const settings = {
  automation: { enabled: true, frequency: 'daily', hour: 2, minute: 0, task: 'clean', lastRunAt: null }
};
vi.mock('./settings.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSettings: async () => settings, updateSettings: async (p) => ({ ...settings, ...p }) };
});

const { checkSchedule } = await import('./scheduleRunner.js');
const { getStats } = await import('./stats.js');

let dir;
let previous;
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-sched-stats-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

describe('a scheduled clean', () => {
  it('counts what it freed, and not what it only moved', async () => {
    executeRules.mockResolvedValue({ freedBytes: 300, movedBytes: 9000, results: [] });
    await checkSchedule(new Date(2030, 0, 2, 3, 0, 0));
    expect((await getStats()).freedBytes).toBe(300);
  });
});
