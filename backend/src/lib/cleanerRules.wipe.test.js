import { describe, it, expect, vi, beforeEach } from 'vitest';

/** The free-space wipe rule, wired into the cleaner.
 *
 * The wipe module is mocked: the real one fills a drive with zeros. What is
 * under test here is only how the rule is described, measured and
 * dispatched -- wipeFreeSpace.test.js covers the wipe itself on a tiny
 * pretend drive. */

const execute = vi.fn(async (action, name, guards) => {
  guards.onProgress?.({ wipe: true, bytesWritten: 5, totalBytes: 10, elapsedMs: 1 });
  return { freedBytes: 0, skipped: [], wiped: { bytesWritten: 10, totalBytes: 10, elapsedMs: 2, aborted: false, reason: null } };
});
vi.mock('./cleanerActions/wipeFreeSpace.js', () => ({
  execute: (...a) => execute(...a),
  scan: () => ({ present: true }),
  FILLER_PREFIX: 'prune-wipe-'
}));

const { loadCleanerRules, scanRule, rulePathsExist, executeRule, executeRulesProgressively } = await import('./cleanerRules.js');
const rule = loadCleanerRules().find((r) => r.id === 'system_empty_space');

beforeEach(() => vi.clearAllMocks());

describe('the Free disk space rule', () => {
  it("sits in Windows, named as BleachBit's system.empty_space", () => {
    expect(rule.category).toBe('Windows');
    expect(rule.name).toBe('Free disk space');
  });

  it('is never recommended and never safe to tick in bulk', () => {
    expect(rule.recommended).toBe(false);
    expect(rule.is_safe).toBe(false);
    // Asked about every time, however often it was agreed to before.
    expect(rule.confirmEveryTime).toBe(true);
  });

  it('says what it does: zeros, recoverability, duration, SSD, frees nothing', () => {
    const text = rule.description;
    expect(text).toMatch(/overwrites the free space/i);
    expect(text).toMatch(/zeros/i);
    expect(text).toMatch(/recovered/i);
    expect(text).toMatch(/hours/i);
    expect(text).toMatch(/frees no space/i);
    expect(text).toMatch(/SSD/);
    expect(text).toMatch(/wear/i);
  });

  it('measures as nothing to measure, not as zero', () => {
    const scanned = scanRule(rule);
    expect(scanned.sizeBytes).toBeNull();
    expect(scanned.present).toBe(true);
  });

  it('stays in the list before a scan', () => {
    expect(rulePathsExist(rule)).toBe(true);
  });

  it('runs the wipe, reports freed as 0, and carries the wipe result', async () => {
    const result = await executeRule(rule, { removal: 'delete' });
    expect(execute).toHaveBeenCalledTimes(1);
    expect(result.freedBytes).toBe(0);
    expect(result.movedBytes).toBe(0);
    expect(result.wiped.bytesWritten).toBe(10);
  });

  it('is the same whichever removal mode is set -- it never touches user files', async () => {
    await executeRule(rule, { removal: 'quarantine' });
    await executeRule(rule, { removal: 'delete' });
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it('streams its progress tagged with the rule id, and passes Stop through', async () => {
    const progress = [];
    const controller = new AbortController();
    await executeRulesProgressively(['system_empty_space'], () => {}, { signal: controller.signal, onProgress: (p) => progress.push(p) });
    expect(progress).toEqual([{ id: 'system_empty_space', wipe: true, bytesWritten: 5, totalBytes: 10, elapsedMs: 1 }]);
    expect(execute.mock.calls[0][2].signal).toBe(controller.signal);
  });

  it('is skipped entirely when Stop was pressed before it started', async () => {
    const controller = new AbortController();
    controller.abort();
    const summary = await executeRulesProgressively(['system_empty_space'], () => {}, { signal: controller.signal });
    expect(summary.aborted).toBe(true);
    expect(execute).not.toHaveBeenCalled();
  });
});
