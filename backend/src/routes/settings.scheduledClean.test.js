import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** Changing the schedule updates the Task Scheduler task that follows it.
 *
 * The task is only ever kept in line here (moved, or removed when the schedule
 * stops cleaning) -- never created by a settings save -- and a settings save
 * that touches nothing about the schedule does not read Task Scheduler at all. */

const stored = { theme: 'dark', automation: { enabled: true, task: 'clean', frequency: 'daily', hour: 2, minute: 0 } };
const updateSettings = vi.fn(async (partial) => ({ ...stored, ...partial }));
const reconcile = vi.hoisted(() => vi.fn());
vi.mock('../services/settings.js', () => ({
  getSettings: async () => stored,
  updateSettings: (...a) => updateSettings(...a)
}));
vi.mock('../services/scheduledCleanTask.js', () => ({ reconcileScheduledClean: (...a) => reconcile(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); reconcile.mockResolvedValue({ action: 'none' }); });

const put = (body) => server.call('/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

describe('PUT /settings and the scheduled task', () => {
  it('keeps the task in line with the schedule that was just saved', async () => {
    const automation = { enabled: true, task: 'clean', frequency: 'weekly', weekday: 2, hour: 4, minute: 30 };
    const res = await put({ automation });
    expect(res.status).toBe(200);
    expect(reconcile).toHaveBeenCalledTimes(1);
    expect(reconcile).toHaveBeenCalledWith(automation);
  });

  it('does it after the schedule is saved, with what was saved', async () => {
    updateSettings.mockResolvedValueOnce({ automation: { enabled: false, task: 'clean' } });
    await put({ automation: { enabled: false } });
    expect(reconcile).toHaveBeenCalledWith({ enabled: false, task: 'clean' });
  });

  it('leaves Task Scheduler alone when the save has nothing to do with the schedule', async () => {
    await put({ theme: 'light' });
    await put({ minimizeToTray: true });
    expect(reconcile).not.toHaveBeenCalled();
  });

  it('a task that cannot be updated does not fail the save', async () => {
    reconcile.mockRejectedValue(new Error('Access is denied'));
    const res = await put({ automation: { enabled: false } });
    expect(res.status).toBe(200);
    expect(res.body.automation.enabled).toBe(false);
  });

  it('a failed save never touches the task', async () => {
    updateSettings.mockRejectedValueOnce(new Error('EACCES'));
    const res = await put({ automation: { enabled: false } });
    expect(res.status).toBe(500);
    expect(reconcile).not.toHaveBeenCalled();
  });
});
