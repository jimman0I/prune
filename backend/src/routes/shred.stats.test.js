import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';
import { getStats } from '../services/stats.js';

/** Shredded files are gone for good, so what Shred destroyed counts -- including
 * a shred that was stopped partway, for the files it had finished. */

const shredRequested = vi.fn();
vi.mock('../services/shredTool.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, shredRequested: (...a) => shredRequested(...a) };
});
vi.mock('../services/settings.js', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, getSettings: async () => ({}) };
});

let server;
let dir;
let previous;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-shred-stats-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

const shred = (body) => server.call('/shred', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

describe('POST /shred', () => {
  it('counts the bytes it destroyed', async () => {
    shredRequested.mockResolvedValue({ shreddedFiles: 2, bytes: 4096, failed: [], held: [], aborted: false });
    await shred({ paths: ['C:\\x\\a', 'C:\\x\\b'], confirmed: true });
    expect((await getStats()).freedBytes).toBe(4096);
  });

  it('counts what a stopped shred had finished', async () => {
    shredRequested.mockResolvedValue({ shreddedFiles: 1, bytes: 1000, failed: [], held: [], aborted: true });
    await shred({ paths: ['C:\\x\\a'], confirmed: true });
    expect((await getStats()).freedBytes).toBe(1000);
  });

  it('counts nothing when it was not confirmed', async () => {
    await shred({ paths: ['C:\\x\\a'] });
    expect(shredRequested).not.toHaveBeenCalled();
    expect((await getStats()).freedBytes).toBe(0);
  });

  it('counts nothing when it fails outright', async () => {
    shredRequested.mockRejectedValue(new Error('nope'));
    await shred({ paths: ['C:\\x\\a'], confirmed: true });
    expect((await getStats()).freedBytes).toBe(0);
  });
});
