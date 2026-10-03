import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** The tray's "Quick Clean (Temp Files)" runs one Deep Clean rule outside any
 * window. What it deletes counts towards the lifetime total like any other
 * clean; the cleaner itself is mocked. */

const executeRule = vi.fn();
const loadCleanerRules = vi.fn(() => [{ id: 'user_temp', name: 'Temporary files' }]);
vi.mock('./cleanerRules.js', () => ({
  executeRule: (...a) => executeRule(...a),
  loadCleanerRules: (...a) => loadCleanerRules(...a)
}));

const { quickCleanTemp } = await import('./trayManager.js');
const { getStats } = await import('../services/stats.js');

let dir;
let previous;
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-tray-stats-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

describe('quickCleanTemp', () => {
  it('runs the user_temp rule and counts what it freed', async () => {
    executeRule.mockResolvedValue({ id: 'user_temp', freedBytes: 640, movedBytes: 0, skipped: [] });
    await quickCleanTemp();
    expect(executeRule).toHaveBeenCalledWith({ id: 'user_temp', name: 'Temporary files' });
    expect((await getStats()).freedBytes).toBe(640);
  });

  it('counts nothing for what it only moved', async () => {
    executeRule.mockResolvedValue({ id: 'user_temp', freedBytes: 0, movedBytes: 640, quarantineBatch: 'q', skipped: [] });
    await quickCleanTemp();
    expect((await getStats()).freedBytes).toBe(0);
  });

  it('does nothing when the rule is not there', async () => {
    loadCleanerRules.mockReturnValueOnce([]);
    await quickCleanTemp();
    expect(executeRule).not.toHaveBeenCalled();
  });
});
