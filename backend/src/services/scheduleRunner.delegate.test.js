import { describe, it, expect, vi, beforeEach } from 'vitest';

/** Never two schedulers.
 *
 * When the "Also run when Prune is closed" task exists, Windows owns a cleaning
 * schedule: the in-app scheduler stands down for it (no scan, no clean, nothing
 * recorded as having run), and the Dashboard and Settings measure "missed" from
 * the task's own report instead of the in-app record. A schedule that only
 * measures is never handed to the task. */

const executeRules = vi.fn();
const scanAllRules = vi.fn(() => [{ category: 'Windows', items: [{ id: 'temp', recommended: true, present: true, sizeBytes: 10 }] }]);
vi.mock('../lib/cleanerRules.js', () => ({
  scanAllRules: (...a) => scanAllRules(...a),
  executeRules: (...a) => executeRules(...a)
}));
const delegates = vi.fn();
vi.mock('./scheduledCleanTask.js', () => ({ scheduledCleanDelegates: (...a) => delegates(...a) }));
const latestRun = vi.fn();
vi.mock('./scheduledCleanReport.js', () => ({ latestRun: (...a) => latestRun(...a) }));
vi.mock('./stats.js', () => ({ recordFreed: vi.fn(async () => ({})) }));

let settings;
const updateSettings = vi.fn(async (p) => { settings = { ...settings, ...p }; return settings; });
vi.mock('./settings.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSettings: async () => settings, updateSettings: (...a) => updateSettings(...a) };
});

const { checkSchedule, scheduleStatus } = await import('./scheduleRunner.js');

// 2030-01-02 03:00, a schedule for 02:00 daily: the 02:00 window is due.
const NOW = new Date(2030, 0, 2, 3, 0, 0);
const automation = (over = {}) => ({ enabled: true, frequency: 'daily', hour: 2, minute: 0, task: 'clean', lastRunAt: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  settings = { automation: automation() };
  delegates.mockResolvedValue(false);
  latestRun.mockResolvedValue(null);
});

describe('checkSchedule with the task in place', () => {
  it('stands down: nothing scanned, nothing cleaned, nothing recorded', async () => {
    delegates.mockResolvedValue(true);
    const result = await checkSchedule(NOW);
    expect(result).toMatchObject({ ran: false, deferred: 'scheduled task' });
    expect(scanAllRules).not.toHaveBeenCalled();
    expect(executeRules).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('runs as it always did when there is no task', async () => {
    executeRules.mockResolvedValue({ freedBytes: 0, movedBytes: 5, results: [] });
    const result = await checkSchedule(NOW);
    expect(result.ran).toBe(true);
    expect(executeRules).toHaveBeenCalledTimes(1);
    expect(settings.automation.lastRunAt).toBe(NOW.getTime());
  });

  it('only asks about the task when a run is actually due', async () => {
    await checkSchedule(new Date(2030, 0, 2, 1, 0, 0));
    expect(delegates).not.toHaveBeenCalled();
  });

  it('a measure-only schedule is not the task\'s: it keeps running in the app', async () => {
    settings = { automation: automation({ task: 'scan' }) };
    delegates.mockResolvedValue(true);
    const result = await checkSchedule(NOW);
    expect(result.ran).toBe(true);
    expect(delegates).not.toHaveBeenCalled();
  });

  it('a task that cannot be read does not stop the in-app schedule', async () => {
    delegates.mockRejectedValue(new Error('no powershell'));
    executeRules.mockResolvedValue({ freedBytes: 0, movedBytes: 0, results: [] });
    expect((await checkSchedule(NOW)).ran).toBe(true);
  });
});

describe('scheduleStatus with the task in place', () => {
  it('is not due, whatever the in-app record says, and says the task has it', async () => {
    delegates.mockResolvedValue(true);
    const status = await scheduleStatus(NOW);
    expect(status).toMatchObject({ due: false, delegatedToTask: true });
  });

  it('counts missed runs from the task\'s own last run', async () => {
    delegates.mockResolvedValue(true);
    // Last ran three days ago at 02:00: the windows since are missed.
    latestRun.mockResolvedValue({ at: new Date(2029, 11, 30, 2, 0, 5).getTime() });
    const status = await scheduleStatus(NOW);
    expect(status.missed).toBe(2);
    expect(status.lastRunAt).toBe(new Date(2029, 11, 30, 2, 0, 5).getTime());
  });

  it('has nothing missed when the task ran in the latest window', async () => {
    delegates.mockResolvedValue(true);
    latestRun.mockResolvedValue({ at: new Date(2030, 0, 2, 2, 0, 20).getTime() });
    expect((await scheduleStatus(NOW)).missed).toBe(0);
  });

  it('is the in-app picture, unchanged, without a task', async () => {
    const status = await scheduleStatus(NOW);
    expect(status).toMatchObject({ due: true, delegatedToTask: false });
    expect(latestRun).not.toHaveBeenCalled();
  });

  it('does not ask about the task when the schedule is off or only measures', async () => {
    settings = { automation: automation({ enabled: false }) };
    expect((await scheduleStatus(NOW)).delegatedToTask).toBe(false);
    settings = { automation: automation({ task: 'scan' }) };
    expect((await scheduleStatus(NOW)).delegatedToTask).toBe(false);
    expect(delegates).not.toHaveBeenCalled();
  });
});
