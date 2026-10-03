import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';
import { recordFreed } from '../services/stats.js';

let server;
let dir;
let previous;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-stats-route-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

describe('GET /stats', () => {
  it('is zero and undated before anything was freed', async () => {
    const res = await server.call('/stats');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ freedBytes: 0, since: null });
  });

  it('reports the running total and when it began', async () => {
    await recordFreed(2048, 1_700_000_000_000);
    const res = await server.call('/stats');
    expect(res.body).toEqual({ freedBytes: 2048, since: 1_700_000_000_000 });
  });

  it('cannot be raised by a request: there is no write route', async () => {
    const res = await server.call('/stats', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ freedBytes: 999 })
    });
    expect(res.status).toBe(404);
    expect((await server.call('/stats')).body.freedBytes).toBe(0);
  });

  it('refuses a web page, like every other route', async () => {
    const res = await server.callAsWebPage('/stats');
    expect(res.status).toBe(403);
  });
});
