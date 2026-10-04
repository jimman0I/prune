import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// index.js starts a server when imported, so it cannot be loaded here. What
// matters about its start-up is what it does NOT do at the moment the server
// is listening, and that is a property of the source: the first seconds belong
// to the window loading (see lib/startupTasks.js).
const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'index.js'), 'utf8');
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

describe('backend start-up', () => {
  it.each([
    'getProgramIcons', 'getProgramVersions', 'getProgramInstallDates', 'getStoreApps', 'getPackageIcons'
  ])('does not warm %s (it is computed when the window first asks)', (name) => {
    expect(code).not.toContain(name);
  });

  it('still starts the program size lookup the first screen needs', () => {
    expect(code).toContain('getProgramSizes()');
  });

  it('does not call any housekeeping task at module level', () => {
    for (const call of [
      'ingestReport(', 'reconcileScheduledClean(', 'repairStartWithWindows(', 'repairExplorerMenu(',
      'cleanupAllWipeLeftovers(', 'enforceQuarantineLimits(', 'checkSchedule('
    ]) {
      // Each may appear only inside a deferred function body (indented), never as
      // a bare statement at the start of a line.
      expect(code, call).not.toMatch(new RegExp(`^${call.replace('(', '\\(')}`, 'm'));
    }
  });

  it('hands the housekeeping to the delayed scheduler when the server is listening', () => {
    expect(code).toMatch(/server\.listen\([^]*scheduleHousekeeping\(housekeeping/);
  });
});
