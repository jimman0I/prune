import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const task = vi.hoisted(() => ({
  getScheduledCleanStatus: vi.fn(),
  enableScheduledClean: vi.fn(),
  disableScheduledClean: vi.fn(),
  scheduleOf: vi.fn()
}));
const report = vi.hoisted(() => ({ ingestReport: vi.fn(), latestRun: vi.fn() }));
const settings = vi.hoisted(() => ({ getSettings: vi.fn() }));
const stats = vi.hoisted(() => ({ recordFreed: vi.fn() }));
vi.mock('../services/scheduledCleanTask.js', () => task);
vi.mock('../services/scheduledCleanReport.js', () => report);
vi.mock('../services/settings.js', () => settings);
vi.mock('../services/stats.js', () => stats);

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });

const AUTOMATION = { enabled: true, task: 'clean', frequency: 'daily', hour: 2, minute: 0, weekday: 0 };
const SCHEDULE = { frequency: 'daily', hour: 2, minute: 0, weekday: null };
const RUN = { id: 5000, at: 5000, startedAt: 4000, mode: 'quarantine', ok: true, rulesRun: 3, rulesCleaned: 2, rulesFailed: 0, freedBytes: 0, movedBytes: 900, skippedCount: 1, errors: [] };
const state = (over = {}) => ({ supported: true, reason: null, exists: false, inSync: null, nextRun: null, lastRun: null, lastTaskResult: null, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  settings.getSettings.mockResolvedValue({ automation: AUTOMATION });
  task.scheduleOf.mockImplementation((a) => (a?.enabled && a?.task === 'clean' ? SCHEDULE : null));
  task.getScheduledCleanStatus.mockResolvedValue(state());
  report.ingestReport.mockResolvedValue({ countedBytes: 0, runs: 0 });
  report.latestRun.mockResolvedValue(null);
});

const put = (body) => server.call('/scheduled-clean', {
  method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});

describe('GET /scheduled-clean', () => {
  it('answers the real task state for the schedule in Settings, and the last unattended run', async () => {
    task.getScheduledCleanStatus.mockResolvedValue(state({ exists: true, inSync: true, nextRun: 1790000000000 }));
    report.latestRun.mockResolvedValue(RUN);
    const res = await server.call('/scheduled-clean');
    expect(res.status).toBe(200);
    expect(task.getScheduledCleanStatus).toHaveBeenCalledWith(SCHEDULE);
    expect(res.body).toMatchObject({ supported: true, exists: true, inSync: true, nextRun: 1790000000000, canEnable: true });
    expect(res.body.lastClean).toEqual({ at: 5000, ok: true, mode: 'quarantine', movedBytes: 900, freedBytes: 0, rulesCleaned: 2, rulesFailed: 0 });
  });

  it('adds what unattended runs freed to the lifetime total before answering', async () => {
    await server.call('/scheduled-clean');
    expect(report.ingestReport).toHaveBeenCalledWith({ recordFreed: stats.recordFreed });
  });

  it('says it cannot be enabled while the schedule is not a cleaning one', async () => {
    settings.getSettings.mockResolvedValue({ automation: { ...AUTOMATION, task: 'scan' } });
    const res = await server.call('/scheduled-clean');
    expect(task.getScheduledCleanStatus).toHaveBeenCalledWith(null);
    expect(res.body.canEnable).toBe(false);
  });

  it('answers an unsupported build as such', async () => {
    task.getScheduledCleanStatus.mockResolvedValue(state({ supported: false, reason: 'unpackaged' }));
    const res = await server.call('/scheduled-clean');
    expect(res.body).toMatchObject({ supported: false, reason: 'unpackaged', exists: false, canEnable: false });
  });

  it('is a 500 with the reason when Task Scheduler cannot be read', async () => {
    task.getScheduledCleanStatus.mockRejectedValue(new Error('powershell timed out'));
    const res = await server.call('/scheduled-clean');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/timed out/);
  });
});

describe('GET /scheduled-clean/last', () => {
  it('answers just the last run, without touching Task Scheduler', async () => {
    report.latestRun.mockResolvedValue(RUN);
    const res = await server.call('/scheduled-clean/last');
    expect(res.status).toBe(200);
    expect(res.body.lastClean).toMatchObject({ at: 5000, movedBytes: 900 });
    expect(task.getScheduledCleanStatus).not.toHaveBeenCalled();
    expect(report.ingestReport).toHaveBeenCalled();
  });

  it('answers null when nothing has run', async () => {
    const res = await server.call('/scheduled-clean/last');
    expect(res.body).toEqual({ lastClean: null });
  });
});

describe('PUT /scheduled-clean', () => {
  it('creates the task for the schedule in Settings and answers its state', async () => {
    task.enableScheduledClean.mockResolvedValue(state({ exists: true, inSync: true }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(200);
    expect(task.enableScheduledClean).toHaveBeenCalledWith(SCHEDULE);
    expect(res.body).toMatchObject({ exists: true, inSync: true });
  });

  it('removes it', async () => {
    task.disableScheduledClean.mockResolvedValue(state());
    const res = await put({ enabled: false });
    expect(res.status).toBe(200);
    expect(task.disableScheduledClean).toHaveBeenCalled();
    expect(task.enableScheduledClean).not.toHaveBeenCalled();
  });

  it('accepts only a real boolean, and never reaches Task Scheduler otherwise', async () => {
    for (const body of [undefined, {}, { enabled: 'true' }, { enabled: 1 }, { enabled: null }, [], { Enabled: true }]) {
      const res = await put(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error).toMatch(/true or false/);
    }
    expect(task.enableScheduledClean).not.toHaveBeenCalled();
    expect(task.disableScheduledClean).not.toHaveBeenCalled();
  });

  it('takes the schedule from Settings, never from the request', async () => {
    task.enableScheduledClean.mockResolvedValue(state());
    await put({ enabled: true, schedule: { frequency: 'daily', hour: 3 }, command: 'calc.exe', path: 'C:\\x', arguments: '--delete-now' });
    expect(task.enableScheduledClean).toHaveBeenCalledTimes(1);
    expect(task.enableScheduledClean.mock.calls[0]).toEqual([SCHEDULE]);
  });

  it('is a 409 that says why when the schedule is not a cleaning one, and creates nothing', async () => {
    settings.getSettings.mockResolvedValue({ automation: { ...AUTOMATION, enabled: false } });
    const res = await put({ enabled: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ needsSchedule: true });
    expect(task.enableScheduledClean).not.toHaveBeenCalled();
  });

  it('is a 409 in a build that cannot do it (a development build)', async () => {
    task.enableScheduledClean.mockRejectedValue(Object.assign(new Error('This can only be set from the installed Prune app.'), { unsupported: true, reason: 'unpackaged' }));
    const res = await put({ enabled: true });
    expect(res.status).toBe(409);
    expect(res.body).toMatchObject({ unsupported: true, reason: 'unpackaged' });
  });

  it('is a 500 with Windows\' reason when the task cannot be written', async () => {
    task.enableScheduledClean.mockRejectedValue(new Error('ERROR: Access is denied.'));
    const res = await put({ enabled: true });
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/Access is denied/);
  });

  it('has no other verb', async () => {
    expect((await server.call('/scheduled-clean', { method: 'DELETE' })).status).toBe(404);
    expect((await server.call('/scheduled-clean', { method: 'POST' })).status).toBe(404);
  });
});
