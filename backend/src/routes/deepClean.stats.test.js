import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';
import { getStats } from '../services/stats.js';

/** What Deep Clean adds to the lifetime "freed" total: bytes DELETED, from
 * each of the three ways a clean can run, and never bytes that were only moved.
 * The cleaner itself is mocked -- these tests are about what the routes record
 * from what it reports. */

const executeRules = vi.fn();
const executeRulesProgressively = vi.fn();
vi.mock('../lib/cleanerRules.js', () => ({
  executeRules: (...a) => executeRules(...a),
  executeRulesProgressively: (...a) => executeRulesProgressively(...a),
  scanAllRules: () => [],
  loadCleanerRules: () => [],
  scanRulesProgressively: async () => ({}),
  rulePathsExist: () => false
}));
vi.mock('../services/settings.js', () => ({
  getSettings: async () => ({}),
  cleanGuardsFrom: () => ({}),
  updateSettings: async (p) => p
}));
const executeRulesElevated = vi.fn();
vi.mock('../services/elevatedClean.js', () => ({ executeRulesElevated: (...a) => executeRulesElevated(...a) }));
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => [] }));

let server;
let dir;
let previous;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  dir = mkdtempSync(join(tmpdir(), 'prune-dc-stats-'));
  previous = process.env.UNREVO_STATS_PATH;
  process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
});
afterEach(() => {
  if (previous === undefined) delete process.env.UNREVO_STATS_PATH; else process.env.UNREVO_STATS_PATH = previous;
  rmSync(dir, { recursive: true, force: true });
});

const post = (path, body) => server.call(path, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
});

describe('GET /deep-clean/execute/stream', () => {
  it('counts what each rule deleted', async () => {
    executeRulesProgressively.mockImplementation(async (ids, emit) => {
      emit({ id: 'a', freedBytes: 1000, movedBytes: 0 });
      emit({ id: 'b', freedBytes: 500, movedBytes: 0 });
      return { aborted: false, freedBytes: 1500, movedBytes: 0 };
    });
    await server.call('/deep-clean/execute/stream?ids=a,b');
    expect((await getStats()).freedBytes).toBe(1500);
  });

  it('counts nothing for what was only moved to Quarantine or the Recycle Bin', async () => {
    executeRulesProgressively.mockImplementation(async (ids, emit) => {
      emit({ id: 'a', freedBytes: 0, movedBytes: 9000, quarantineBatch: 'q1' });
      return { aborted: false, freedBytes: 0, movedBytes: 9000 };
    });
    await server.call('/deep-clean/execute/stream?ids=a');
    expect((await getStats()).freedBytes).toBe(0);
  });

  it('still counts the rules that finished when a later one fails', async () => {
    executeRulesProgressively.mockImplementation(async (ids, emit) => {
      emit({ id: 'a', freedBytes: 700, movedBytes: 0 });
      throw new Error('disk vanished');
    });
    await server.call('/deep-clean/execute/stream?ids=a,b');
    expect((await getStats()).freedBytes).toBe(700);
  });

  it('ignores a rule that reported an error and no bytes', async () => {
    executeRulesProgressively.mockImplementation(async (ids, emit) => {
      emit({ id: 'a', error: 'Unknown rule id "a"' });
      return { aborted: false, freedBytes: 0, movedBytes: 0 };
    });
    await server.call('/deep-clean/execute/stream?ids=a');
    expect((await getStats()).freedBytes).toBe(0);
  });

  it('adds to the total across cleans', async () => {
    executeRulesProgressively.mockImplementation(async (ids, emit) => {
      emit({ id: 'a', freedBytes: 100, movedBytes: 0 });
      return { aborted: false, freedBytes: 100, movedBytes: 0 };
    });
    await server.call('/deep-clean/execute/stream?ids=a');
    await server.call('/deep-clean/execute/stream?ids=a');
    expect((await getStats()).freedBytes).toBe(200);
  });
});

describe('POST /deep-clean/execute', () => {
  it('counts the freed bytes of the summary, not the moved ones', async () => {
    executeRules.mockResolvedValue({ freedBytes: 400, movedBytes: 5000, results: [] });
    await post('/deep-clean/execute', { ruleIds: ['a'] });
    expect((await getStats()).freedBytes).toBe(400);
  });

  it('counts nothing when the clean fails outright', async () => {
    executeRules.mockRejectedValue(new Error('boom'));
    const res = await post('/deep-clean/execute', { ruleIds: ['a'] });
    expect(res.status).toBe(500);
    expect((await getStats()).freedBytes).toBe(0);
  });
});

describe('POST /deep-clean/execute-elevated', () => {
  it('counts what the elevated clean freed', async () => {
    executeRulesElevated.mockResolvedValue({ ok: true, data: { freedBytes: 250, movedBytes: 0, results: [] } });
    await post('/deep-clean/execute-elevated', { ruleIds: ['a'] });
    expect((await getStats()).freedBytes).toBe(250);
  });

  it('counts nothing when the prompt was declined', async () => {
    executeRulesElevated.mockResolvedValue({ ok: false, cancelled: true });
    await post('/deep-clean/execute-elevated', { ruleIds: ['a'] });
    expect((await getStats()).freedBytes).toBe(0);
  });
});
