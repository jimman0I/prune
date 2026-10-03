import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  MAX_RUNS, reportPath, countedPath, buildRun, appendRun, readRuns, latestRun, ingestReport
} from './scheduledCleanReport.js';

/** The note a clean run from Task Scheduler leaves for the app.
 *
 * The run is a separate process (prune-cli.cmd, started by Windows while Prune
 * is closed), so it can only leave a file. The app reads it later and adds the
 * space that is really back to the lifetime total. Held still here: the file
 * lives beside settings.json, a run is described by what it did, several runs
 * pile up when the app stays closed, and each run is counted ONCE -- the CLI
 * never writes the counter, the app never rewrites the report, and a marker
 * only the app writes says how far it has counted. */

let dir;
let saved;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-report-'));
  saved = { ...process.env };
  process.env.UNREVO_SETTINGS_PATH = join(dir, 'settings.json');
  delete process.env.UNREVO_REPORT_PATH;
});
afterEach(() => {
  process.env = saved;
  rmSync(dir, { recursive: true, force: true });
});

const rows = (...over) => over.map((o, i) => ({ id: `r${i}`, name: `Rule ${i}`, freedBytes: 0, movedBytes: 0, skippedCount: 0, ...o }));

describe('where the files live', () => {
  it('the report and the counter sit in the same folder as settings.json', () => {
    expect(reportPath()).toBe(join(dir, 'scheduled-clean-report.json'));
    expect(countedPath()).toBe(join(dir, 'scheduled-clean-counted.json'));
  });

  it('can be pointed elsewhere for a test', () => {
    process.env.UNREVO_REPORT_PATH = join(dir, 'x', 'r.json');
    expect(reportPath()).toBe(join(dir, 'x', 'r.json'));
    expect(countedPath()).toBe(join(dir, 'x', 'scheduled-clean-counted.json'));
  });
});

describe('buildRun', () => {
  it('describes a run by what it did: time, rules, moved and freed bytes, errors', () => {
    const run = buildRun({
      startedAt: 1000, finishedAt: 5000, mode: 'quarantine',
      rows: rows({ movedBytes: 300, skippedCount: 2 }, { freedBytes: 50 }, {}, { error: 'EBUSY: locked' })
    });
    expect(run).toMatchObject({
      id: 5000, at: 5000, startedAt: 1000, mode: 'quarantine', ok: false,
      rulesRun: 4, rulesCleaned: 2, rulesFailed: 1, movedBytes: 300, freedBytes: 50, skippedCount: 2
    });
    expect(run.errors).toEqual([{ id: 'r3', error: 'EBUSY: locked' }]);
  });

  it('is ok when no rule failed, even if nothing was there to clean', () => {
    const run = buildRun({ startedAt: 1, finishedAt: 2, mode: 'quarantine', rows: rows({}, {}) });
    expect(run).toMatchObject({ ok: true, rulesRun: 2, rulesCleaned: 0, freedBytes: 0, movedBytes: 0, errors: [] });
  });

  it('keeps the error list short and each message bounded', () => {
    const many = rows(...Array.from({ length: 40 }, () => ({ error: 'x'.repeat(1000) })));
    const run = buildRun({ startedAt: 1, finishedAt: 2, mode: 'delete', rows: many });
    expect(run.rulesFailed).toBe(40);
    expect(run.errors).toHaveLength(10);
    expect(run.errors[0].error.length).toBeLessThanOrEqual(300);
  });

  it('only ever says quarantine or delete for the mode', () => {
    expect(buildRun({ startedAt: 1, finishedAt: 2, mode: 'weird', rows: [] }).mode).toBe('quarantine');
    expect(buildRun({ startedAt: 1, finishedAt: 2, mode: 'delete', rows: [] }).mode).toBe('delete');
  });
});

describe('appendRun / readRuns', () => {
  const run = (id, freed = 0) => buildRun({ startedAt: id - 1, finishedAt: id, mode: 'delete', rows: rows({ freedBytes: freed }) });

  it('writes the first report, creating the folder', async () => {
    process.env.UNREVO_REPORT_PATH = join(dir, 'nested', 'r.json');
    await appendRun(run(10, 5));
    expect((await readRuns()).map((r) => r.id)).toEqual([10]);
  });

  it('adds to what is there, oldest first, so runs made while the app was closed are all kept', async () => {
    await appendRun(run(10, 1));
    await appendRun(run(20, 2));
    await appendRun(run(30, 3));
    expect((await readRuns()).map((r) => r.freedBytes)).toEqual([1, 2, 3]);
    expect((await latestRun()).id).toBe(30);
  });

  it('keeps the most recent runs only', async () => {
    for (let i = 1; i <= MAX_RUNS + 5; i += 1) await appendRun(run(i));
    const runs = await readRuns();
    expect(runs).toHaveLength(MAX_RUNS);
    expect(runs[0].id).toBe(6);
    expect(runs.at(-1).id).toBe(MAX_RUNS + 5);
  });

  it('is written whole: no temp file is left behind', async () => {
    await appendRun(run(10));
    expect(readdirSync(dir).filter((f) => f.includes('.tmp'))).toEqual([]);
    expect(JSON.parse(readFileSync(reportPath(), 'utf8')).version).toBe(1);
  });

  it('reads a missing, damaged or foreign file as no runs, and a new run replaces it', async () => {
    expect(await readRuns()).toEqual([]);
    expect(await latestRun()).toBeNull();
    writeFileSync(reportPath(), '{not json');
    expect(await readRuns()).toEqual([]);
    writeFileSync(reportPath(), JSON.stringify({ runs: 'nope' }));
    expect(await readRuns()).toEqual([]);
    await appendRun(run(10, 7));
    expect((await readRuns())).toHaveLength(1);
  });

  it('drops entries that are not runs instead of trusting them', async () => {
    writeFileSync(reportPath(), JSON.stringify({ version: 1, runs: [null, 7, { id: 'x' }, { id: 5, at: 5, freedBytes: -3, movedBytes: 'many', mode: 'rm -rf' }] }));
    const runs = await readRuns();
    expect(runs).toHaveLength(1);
    expect(runs[0]).toMatchObject({ id: 5, freedBytes: 0, movedBytes: 0, mode: 'quarantine' });
  });
});

describe('ingestReport: the lifetime total, once per run', () => {
  const run = (id, freed, moved = 0) => buildRun({ startedAt: id - 1, finishedAt: id, mode: 'delete', rows: rows({ freedBytes: freed, movedBytes: moved }) });

  it('adds the freed bytes of every run not counted yet, never the moved ones', async () => {
    await appendRun(run(10, 100, 5000));
    await appendRun(run(20, 40));
    const recordFreed = vi.fn(async () => ({}));
    const result = await ingestReport({ recordFreed });
    expect(recordFreed).toHaveBeenCalledTimes(1);
    expect(recordFreed).toHaveBeenCalledWith(140);
    expect(result).toEqual({ countedBytes: 140, runs: 2 });
  });

  it('counts nothing a second time', async () => {
    await appendRun(run(10, 100));
    const recordFreed = vi.fn(async () => ({}));
    await ingestReport({ recordFreed });
    const again = await ingestReport({ recordFreed });
    expect(recordFreed).toHaveBeenCalledTimes(1);
    expect(again).toEqual({ countedBytes: 0, runs: 0 });
  });

  it('counts only the runs that came after the last one counted', async () => {
    await appendRun(run(10, 100));
    const recordFreed = vi.fn(async () => ({}));
    await ingestReport({ recordFreed });
    await appendRun(run(20, 7));
    await ingestReport({ recordFreed });
    expect(recordFreed.mock.calls.map((c) => c[0])).toEqual([100, 7]);
  });

  it('two checks at once still count a run once', async () => {
    await appendRun(run(10, 100));
    const recordFreed = vi.fn(async () => ({}));
    await Promise.all([ingestReport({ recordFreed }), ingestReport({ recordFreed }), ingestReport({ recordFreed })]);
    expect(recordFreed).toHaveBeenCalledTimes(1);
  });

  it('does nothing, and does not fail, when there is no report', async () => {
    const recordFreed = vi.fn();
    expect(await ingestReport({ recordFreed })).toEqual({ countedBytes: 0, runs: 0 });
    expect(recordFreed).not.toHaveBeenCalled();
    expect(existsSync(countedPath())).toBe(false);
  });

  it('marks the run counted but records nothing for a run that only moved files to Quarantine', async () => {
    await appendRun(run(10, 0, 9999));
    const recordFreed = vi.fn(async () => ({}));
    const result = await ingestReport({ recordFreed });
    expect(recordFreed).not.toHaveBeenCalled();
    expect(result).toEqual({ countedBytes: 0, runs: 1 });
    expect(JSON.parse(readFileSync(countedPath(), 'utf8')).through).toBe(10);
  });

  it('never rewrites the report: that file belongs to the command line', async () => {
    await appendRun(run(10, 100));
    const before = readFileSync(reportPath(), 'utf8');
    await ingestReport({ recordFreed: vi.fn(async () => ({})) });
    expect(readFileSync(reportPath(), 'utf8')).toBe(before);
  });

  it('really adds to the stats file through the stats module', async () => {
    process.env.UNREVO_STATS_PATH = join(dir, 'stats.json');
    const stats = await import('./stats.js');
    await appendRun(run(10, 2048));
    await ingestReport({ recordFreed: stats.recordFreed });
    await ingestReport({ recordFreed: stats.recordFreed });
    expect((await stats.getStats()).freedBytes).toBe(2048);
  });
});
