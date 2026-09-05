import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The scheduling endpoints.
 *
 * checkSchedule is mocked because the real one can run a Deep Clean. The
 * separation between reading the schedule and acting on it is the whole
 * point of these two routes, and it is exactly the kind of thing a
 * refactor collapses by accident.
 */

const scheduleStatus = vi.fn(async () => ({
  enabled: true, nextRun: '2026-09-07T02:00:00.000Z', missed: 2
}));
const checkSchedule = vi.fn(async () => ({ ran: false, reason: 'not due' }));
vi.mock('../services/scheduleRunner.js', () => ({
  scheduleStatus: (...a) => scheduleStatus(...a),
  checkSchedule: (...a) => checkSchedule(...a),
  startScheduler: () => {}
}));

const readResources = vi.fn(() => ({ cpuPercent: 12, memoryPercent: 40, diskBytesPerSec: 0 }));
vi.mock('../services/resourceMonitor.js', () => ({ readResources: (...a) => readResources(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

describe('GET /automation', () => {
  it('reads the schedule without acting on it', async () => {
    // The Dashboard badge and the Settings section both poll this. If it
    // could run a clean, opening a screen would clean the machine.
    const res = await server.call('/automation');
    expect(res.status).toBe(200);
    expect(checkSchedule).not.toHaveBeenCalled();
  });

  it('reports the missed count, which is the point of the badge', async () => {
    // A desktop asleep at 2 AM did not fail its schedule -- it was not
    // there for it. Saying so is the difference between the feature
    // looking broken and the machine having been off.
    const res = await server.call('/automation');
    expect(res.body.missed).toBe(2);
    expect(res.body.nextRun).toBe('2026-09-07T02:00:00.000Z');
  });
});

describe('POST /automation/check', () => {
  it('catches up on a due run', async () => {
    const res = await server.call('/automation/check', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(checkSchedule).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual({ ran: false, reason: 'not due' });
  });

  it('is not reachable by a GET', async () => {
    // GET /automation is the status read. If /check answered a GET too,
    // a prefetch or a retry could start a clean.
    const res = await server.call('/automation/check');
    expect(res.status).toBe(404);
    expect(checkSchedule).not.toHaveBeenCalled();
  });

  it('reports a failed run as a 500 rather than a quiet success', async () => {
    checkSchedule.mockRejectedValueOnce(new Error('clean failed'));
    const res = await server.call('/automation/check', { method: 'POST' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('clean failed');
  });
});

describe('GET /resources', () => {
  it('answers a reading without doing any work of its own', async () => {
    // Three numbers copied out of a counter that is already running.
    // Making the widget's poll expensive would make the widget the thing
    // consuming the resources it reports.
    const res = await server.call('/resources');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ cpuPercent: 12, memoryPercent: 40, diskBytesPerSec: 0 });
  });

  it('reports a broken counter as a 500 rather than zeroes', async () => {
    // Zeroes would draw a flat graph, which is a claim about the machine
    // rather than an admission that nothing was measured.
    readResources.mockImplementationOnce(() => { throw new Error('counter gone'); });
    const res = await server.call('/resources');
    expect(res.status).toBe(500);
  });
});
