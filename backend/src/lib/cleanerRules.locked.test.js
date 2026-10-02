import { describe, it, expect, vi, beforeEach } from 'vitest';

/** A rule's result carries how many locked files were scheduled for deletion
 * at the next restart, so the screen can say so. The delete action is
 * mocked: what is under test is only the roll-up. */

const execute = vi.fn();
vi.mock('./cleanerActions/delete.js', async (importOriginal) => ({
  ...(await importOriginal()),
  execute: (...a) => execute(...a)
}));

const { executeRule } = await import('./cleanerRules.js');
const rule = { id: 'r', name: 'R', category: 'C', paths: ['%TEMP%\\x'] };

beforeEach(() => vi.clearAllMocks());

describe('executeRule and files scheduled for restart', () => {
  it('reports how many, and keeps them out of freed and skipped', async () => {
    execute.mockResolvedValue({ freedBytes: 5, skipped: [], scheduledForRestart: ['a', 'b'] });
    const result = await executeRule(rule, { removal: 'delete', deleteLockedOnRestart: true });
    expect(result.scheduledForRestart).toBe(2);
    expect(result.freedBytes).toBe(5);
    expect(result.skipped).toEqual([]);
  });

  it('adds nothing to the result when none were scheduled', async () => {
    execute.mockResolvedValue({ freedBytes: 5, skipped: [] });
    expect('scheduledForRestart' in (await executeRule(rule, {}))).toBe(false);
  });

  it('hands the setting to the delete action in the guards', async () => {
    execute.mockResolvedValue({ freedBytes: 0, skipped: [] });
    await executeRule(rule, { deleteLockedOnRestart: true });
    expect(execute.mock.calls[0][2].deleteLockedOnRestart).toBe(true);
  });
});
