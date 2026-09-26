import { describe, it, expect, vi, beforeEach } from 'vitest';

/** A scheduled clean is unattended, so it must never delete outright even
 * when the person has chosen "Delete now" for the Deep Clean they run by
 * hand. That choice is made with a confirm dialog in front of it; 2 AM has
 * no dialog. */

const executeRules = vi.fn(async () => ({ freedBytes: 0, movedBytes: 10, results: [] }));
vi.mock('../lib/cleanerRules.js', () => ({
  scanAllRules: () => [{ category: 'Windows', items: [{ id: 'temp', recommended: true, present: true, sizeBytes: 10 }] }],
  executeRules: (...a) => executeRules(...a)
}));
const settings = {
  deepCleanRemoval: 'delete',
  automation: { enabled: true, frequency: 'daily', hour: 2, minute: 0, task: 'clean', lastRunAt: null }
};
vi.mock('./settings.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSettings: async () => settings, updateSettings: async (p) => ({ ...settings, ...p }) };
});

const { checkSchedule } = await import('./scheduleRunner.js');

beforeEach(() => vi.clearAllMocks());

describe('scheduled clean', () => {
  it("quarantines even when Settings says 'delete'", async () => {
    const out = await checkSchedule(new Date(2030, 0, 2, 3, 0, 0));
    expect(out.ran).toBe(true);
    expect(executeRules).toHaveBeenCalledTimes(1);
    expect(executeRules.mock.calls[0][1].removal).toBe('quarantine');
    expect(out.result.movedBytes).toBe(10);
    expect(out.result.freedBytes).toBe(0);
  });
});
