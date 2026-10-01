import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const runElevatedNodeJsonMock = vi.fn();
vi.mock('../lib/elevated.js', () => ({
  runElevatedNodeJson: (...args) => runElevatedNodeJsonMock(...args)
}));

let executeRulesElevated;
beforeEach(async () => {
  runElevatedNodeJsonMock.mockReset();
  ({ executeRulesElevated } = await import('./elevatedClean.js'));
});

describe('executeRulesElevated', () => {
  // The service deletes its temp workDir (guards.json included) in a
  // `finally` right after the elevated call returns -- correct in
  // production, where that call only resolves once the real elevated
  // process has already read the file, but it means a test can only ever
  // see the file's content from INSIDE the mock, before the outer await
  // resolves and the cleanup runs.
  it('passes a comma-joined rule id list and a path to a real guards file', async () => {
    let seenRuleIdsCsv, seenGuards;
    runElevatedNodeJsonMock.mockImplementation((workerPath, [ruleIdsCsv, guardsPath]) => {
      seenRuleIdsCsv = ruleIdsCsv;
      seenGuards = JSON.parse(readFileSync(guardsPath, 'utf8'));
      return Promise.resolve({ ok: true, data: { freedBytes: 0, movedBytes: 0, results: [] } });
    });
    await executeRulesElevated(['windows_prefetch', 'defender_logs'], { removal: 'quarantine' });

    expect(runElevatedNodeJsonMock.mock.calls[0][0]).toMatch(/elevatedCleanWorker\.js$/);
    expect(seenRuleIdsCsv).toBe('windows_prefetch,defender_logs');
    expect(seenGuards).toEqual({ removal: 'quarantine' });
  });

  it('writes exactly the guards object it was handed -- the same one the unelevated route builds from settings', async () => {
    let seenGuards;
    runElevatedNodeJsonMock.mockImplementation((workerPath, [, guardsPath]) => {
      seenGuards = JSON.parse(readFileSync(guardsPath, 'utf8'));
      return Promise.resolve({ ok: true, data: { freedBytes: 0, movedBytes: 0, results: [] } });
    });
    const guards = { removal: 'delete', autoQuarantine: false, skipRecentHours: 48 };
    await executeRulesElevated(['windows_prefetch'], guards);

    expect(seenGuards).toEqual(guards);
  });

  it('returns the elevated result straight through on success', async () => {
    const data = { freedBytes: 1024, movedBytes: 0, results: [{ id: 'windows_prefetch', freedBytes: 1024 }] };
    runElevatedNodeJsonMock.mockResolvedValue({ ok: true, data });
    expect(await executeRulesElevated(['windows_prefetch'], {})).toEqual({ ok: true, data });
  });

  // A declined UAC prompt is a normal answer, not a failure -- the same
  // discriminated-result contract every elevated.js caller uses.
  it('passes a declined UAC prompt straight through as cancelled', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, cancelled: true });
    expect(await executeRulesElevated(['windows_prefetch'], {})).toEqual({ ok: false, cancelled: true });
  });

  it('passes a real failure through as an error', async () => {
    runElevatedNodeJsonMock.mockResolvedValue({ ok: false, error: 'Elevated helper crashed' });
    expect(await executeRulesElevated(['windows_prefetch'], {})).toEqual({ ok: false, error: 'Elevated helper crashed' });
  });

  it('rejects with no elevation attempt at all when ruleIds is empty', async () => {
    const result = await executeRulesElevated([], {});
    expect(result.ok).toBe(false);
    expect(runElevatedNodeJsonMock).not.toHaveBeenCalled();
  });
});
