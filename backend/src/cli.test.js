import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectRules } from './cli.js';

/** The Prune command line, end to end.
 *
 * Each case runs the real script with `node` against a temp folder and a
 * custom rule set (UNREVO_CLEANERS_PATH), a temp settings file and a temp
 * Quarantine -- it is never pointed at the real rules, and `clean` is only
 * ever run on files this file created a moment ago. */

const CLI = join(dirname(fileURLToPath(import.meta.url)), 'cli.js');

let root;
let work = 'C:\\fixture'; // the fixture files (set for real in beforeAll)
let settingsFile;
let cleanersFile;
let quarantineDir;

const rules = () => [
  { id: 'fx_cache', category: 'Fixture', name: 'Fixture cache', description: 'A cache.', is_safe: true, recommended: true,
    paths: [join(work, 'cache')] },
  { id: 'fx_logs', category: 'Fixture', name: 'Fixture logs', description: 'Logs.', is_safe: true, recommended: true, risky: true,
    paths: [join(work, 'logs')] },
  { id: 'fx_other', category: 'Fixture', name: 'Fixture other', description: 'Not recommended.', is_safe: true, recommended: false,
    paths: [join(work, 'other')] },
  { id: 'fx_gone', category: 'Fixture', name: 'Fixture gone', description: 'Nothing here.', recommended: true,
    paths: [join(work, 'does-not-exist')] },
  { id: 'fx_wipe', category: 'Fixture', name: 'Fixture wipe', description: 'Asks every time.', confirmEveryTime: true, recommended: false,
    actions: [{ type: 'wipe.freespace' }] },
  { id: 'fx_broken', category: 'Fixture', name: 'Fixture broken', description: 'Has no actions.', recommended: true }
];

function fill() {
  rmSync(work, { recursive: true, force: true });
  for (const [dir, files] of Object.entries({ cache: ['a.bin', 'b.bin'], logs: ['x.log'], other: ['o.dat'] })) {
    mkdirSync(join(work, dir), { recursive: true });
    for (const name of files) writeFileSync(join(work, dir, name), `${dir}/${name}`);
  }
}

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-cli-test-'));
  work = join(root, 'work');
  quarantineDir = join(root, 'quarantine');
  settingsFile = join(root, 'settings.json');
  cleanersFile = join(root, 'cleaners.json');
  writeFileSync(cleanersFile, JSON.stringify(rules()));
  // skipRecentHours 0: the fixture files are brand new, and the default
  // 24-hour guard would (rightly) hold every one of them back.
  writeFileSync(settingsFile, JSON.stringify({ skipRecentHours: 0, deepCleanRemoval: 'quarantine' }));
});
afterAll(() => { rmSync(root, { recursive: true, force: true }); });

function run(args, { stdin } = {}) {
  const result = spawnSync(process.execPath, [CLI, ...args], {
    encoding: 'utf8',
    input: stdin,
    env: {
      ...process.env,
      UNREVO_CLEANERS_PATH: cleanersFile,
      UNREVO_SETTINGS_PATH: settingsFile,
      UNREVO_QUARANTINE_ROOT: quarantineDir
    }
  });
  return { code: result.status, out: result.stdout, err: result.stderr };
}
const json = (r) => JSON.parse(r.out);
const left = (dir) => (existsSync(join(work, dir)) ? readdirSync(join(work, dir)) : []);

describe('list', () => {
  it('lists every rule, as JSON', () => {
    const r = run(['list', '--json']);
    expect(r.code).toBe(0);
    const rows = json(r).rules;
    expect(rows.map((x) => x.id)).toEqual(['fx_cache', 'fx_logs', 'fx_other', 'fx_gone', 'fx_wipe', 'fx_broken']);
    expect(rows[0]).toMatchObject({ id: 'fx_cache', name: 'Fixture cache', category: 'Fixture', recommended: true, risky: false });
    expect(rows[1].risky).toBe(true);
    expect(rows[4].confirmEveryTime).toBe(true);
  });

  it('prints a readable table without --json', () => {
    const r = run(['list']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/fx_cache/);
    expect(r.out).toMatch(/Fixture cache/);
  });
});

describe('preview', () => {
  beforeAll(fill);

  it('measures the selected rules and touches nothing', () => {
    const r = run(['preview', '--rules', 'fx_cache,fx_other', '--json']);
    expect(r.code).toBe(0);
    const out = json(r);
    expect(out.rules.map((x) => x.id)).toEqual(['fx_cache', 'fx_other']);
    expect(out.rules[0]).toMatchObject({ id: 'fx_cache', fileCount: 2, present: true });
    expect(out.rules[0].sizeBytes).toBe('cache/a.bin'.length + 'cache/b.bin'.length);
    expect(out.totalBytes).toBe(out.rules[0].sizeBytes + out.rules[1].sizeBytes);
    expect(left('cache')).toHaveLength(2);
  });

  it('with no selection measures every rule that can be measured', () => {
    const r = run(['preview', '--json']);
    expect(r.code).toBe(1); // fx_broken cannot be measured: said, and the exit code reflects it
    const out = json(r);
    expect(out.rules.find((x) => x.id === 'fx_cache').fileCount).toBe(2);
    expect(out.rules.find((x) => x.id === 'fx_broken').error).toMatch(/fx_broken/);
  });

  it('--preset recommended picks the recommended, non-risky rules and leaves the risky one out', () => {
    const out = json(run(['preview', '--preset', 'recommended', '--json']));
    const ids = out.rules.map((x) => x.id);
    expect(ids).toContain('fx_cache');
    expect(ids).not.toContain('fx_logs');
    expect(ids).not.toContain('fx_other');
    expect(ids).not.toContain('fx_wipe');
  });

  it('--except removes rules from the selection', () => {
    const out = json(run(['preview', '--rules', 'fx_cache,fx_other', '--except', 'fx_other', '--json']));
    expect(out.rules.map((x) => x.id)).toEqual(['fx_cache']);
  });

  it('honours the exclusions in settings', () => {
    const excluded = join(root, 'settings-excl.json');
    writeFileSync(excluded, JSON.stringify({ skipRecentHours: 0, excludeFolders: [join(work, 'cache')] }));
    const r = spawnSync(process.execPath, [CLI, 'preview', '--rules', 'fx_cache', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, UNREVO_CLEANERS_PATH: cleanersFile, UNREVO_SETTINGS_PATH: excluded, UNREVO_QUARANTINE_ROOT: quarantineDir }
    });
    const rule = JSON.parse(r.stdout).rules[0];
    expect(rule.fileCount).toBe(0);
    expect(rule.heldCount).toBe(2);
  });
});

describe('clean', () => {
  beforeAll(fill);

  it('refuses to guess: no selection is a usage error, and nothing is touched', () => {
    fill();
    const r = run(['clean', '--json']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/--rules|--preset/);
    expect(left('cache')).toHaveLength(2);
  });

  it('refuses an unknown rule id before doing anything', () => {
    fill();
    const r = run(['clean', '--rules', 'fx_cache,nope']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/nope/);
    expect(left('cache')).toHaveLength(2);
  });

  it('refuses a rule that has to be confirmed in the app each time', () => {
    fill();
    const r = run(['clean', '--rules', 'fx_wipe']);
    expect(r.code).toBe(2);
    expect(r.err).toMatch(/fx_wipe/);
  });

  it('moves files to Quarantine by default (the setting), not deleting them', () => {
    fill();
    const r = run(['clean', '--rules', 'fx_cache', '--json']);
    expect(r.code).toBe(0);
    const out = json(r);
    expect(out.mode).toBe('quarantine');
    expect(out.movedBytes).toBeGreaterThan(0);
    expect(out.freedBytes).toBe(0);
    expect(left('cache')).toEqual([]);
    expect(existsSync(quarantineDir)).toBe(true);
    expect(readdirSync(quarantineDir).length).toBeGreaterThan(0);
  });

  it('--delete-now deletes outright, overriding the setting for this run', () => {
    fill();
    const before = existsSync(quarantineDir) ? readdirSync(quarantineDir).length : 0;
    const r = run(['clean', '--rules', 'fx_other', '--delete-now', '--json']);
    expect(r.code).toBe(0);
    const out = json(r);
    expect(out.mode).toBe('delete');
    expect(out.freedBytes).toBe('other/o.dat'.length);
    expect(left('other')).toEqual([]);
    expect(existsSync(quarantineDir) ? readdirSync(quarantineDir).length : 0).toBe(before);
  });

  it('honours deepCleanRemoval: delete from settings without a flag', () => {
    fill();
    const deleting = join(root, 'settings-delete.json');
    writeFileSync(deleting, JSON.stringify({ skipRecentHours: 0, deepCleanRemoval: 'delete' }));
    const r = spawnSync(process.execPath, [CLI, 'clean', '--rules', 'fx_other', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, UNREVO_CLEANERS_PATH: cleanersFile, UNREVO_SETTINGS_PATH: deleting, UNREVO_QUARANTINE_ROOT: quarantineDir }
    });
    expect(JSON.parse(r.stdout).mode).toBe('delete');
    expect(left('other')).toEqual([]);
  });

  it('--preset recommended cleans the recommended rules and never the risky or unrecommended ones', () => {
    fill();
    const r = run(['clean', '--preset', 'recommended', '--json']);
    expect(r.code).toBe(0);
    expect(left('cache')).toEqual([]);
    expect(left('logs')).toEqual(['x.log']); // risky: only when named
    expect(left('other')).toEqual(['o.dat']); // not recommended
  });

  it('a risky rule runs when it is named explicitly', () => {
    fill();
    expect(run(['clean', '--rules', 'fx_logs', '--json']).code).toBe(0);
    expect(left('logs')).toEqual([]);
  });

  it('the exclusions in settings hold files back from a clean', () => {
    fill();
    const excluded = join(root, 'settings-excl2.json');
    writeFileSync(excluded, JSON.stringify({ skipRecentHours: 0, deepCleanRemoval: 'delete', excludeFolders: [join(work, 'cache')] }));
    const r = spawnSync(process.execPath, [CLI, 'clean', '--rules', 'fx_cache', '--delete-now', '--json'], {
      encoding: 'utf8',
      env: { ...process.env, UNREVO_CLEANERS_PATH: cleanersFile, UNREVO_SETTINGS_PATH: excluded, UNREVO_QUARANTINE_ROOT: quarantineDir }
    });
    expect(r.status).toBe(0);
    expect(left('cache')).toHaveLength(2);
    expect(JSON.parse(r.stdout).rules[0].skippedCount).toBe(2);
  });

  it('exits non-zero when a rule fails', () => {
    fill();
    const r = run(['clean', '--rules', 'fx_cache,fx_broken', '--json']);
    expect(r.code).toBe(1);
    const out = json(r);
    expect(out.rules.find((x) => x.id === 'fx_broken').error).toBeTruthy();
    expect(left('cache')).toEqual([]); // the good rule still ran
  });

  it('prints a human summary without --json', () => {
    fill();
    const r = run(['clean', '--rules', 'fx_other', '--delete-now']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/Fixture other/);
    expect(r.out).toMatch(/Freed/);
  });
});

describe('clean --report (what Task Scheduler runs while Prune is closed)', () => {
  const reportFile = () => join(root, 'scheduled-clean-report.json');
  const readReport = () => JSON.parse(readFileSync(reportFile(), 'utf8'));
  beforeEach(() => { rmSync(reportFile(), { force: true }); });

  it('leaves a report beside settings.json: when, mode, rules and bytes', () => {
    fill();
    const before = Date.now();
    const r = run(['clean', '--preset', 'recommended', '--report']);
    expect(r.code).toBe(0);
    const report = readReport();
    expect(report.version).toBe(1);
    expect(report.runs).toHaveLength(1);
    const entry = report.runs[0];
    expect(entry).toMatchObject({ mode: 'quarantine', ok: true, rulesFailed: 0, freedBytes: 0 });
    expect(entry.movedBytes).toBe('cache/a.bin'.length + 'cache/b.bin'.length);
    expect(entry.rulesCleaned).toBe(1);
    expect(entry.at).toBeGreaterThanOrEqual(before);
    expect(entry.startedAt).toBeLessThanOrEqual(entry.at);
    expect(left('cache')).toEqual([]);
    expect(left('logs')).toEqual(['x.log']); // the preset still skips what loses data
  });

  it('writes nothing without the flag', () => {
    fill();
    run(['clean', '--rules', 'fx_cache']);
    expect(existsSync(reportFile())).toBe(false);
  });

  it('records bytes really freed when the setting is Delete now', () => {
    fill();
    run(['clean', '--rules', 'fx_other', '--delete-now', '--report']);
    expect(readReport().runs[0]).toMatchObject({ mode: 'delete', freedBytes: 'other/o.dat'.length, movedBytes: 0 });
  });

  it('keeps earlier runs and adds the new one', () => {
    fill();
    run(['clean', '--rules', 'fx_cache', '--report']);
    fill();
    run(['clean', '--rules', 'fx_cache', '--report']);
    expect(readReport().runs).toHaveLength(2);
  });

  it('a failing rule is in the report, and the exit code still says so', () => {
    fill();
    const r = run(['clean', '--rules', 'fx_cache,fx_broken', '--report']);
    expect(r.code).toBe(1);
    const entry = readReport().runs[0];
    expect(entry.ok).toBe(false);
    expect(entry.rulesFailed).toBe(1);
    expect(entry.errors[0].id).toBe('fx_broken');
  });

  it('honours the settings file\'s guards: held-back files are skipped, not cleaned', () => {
    fill();
    const excluded = join(root, 'settings-report-excl.json');
    writeFileSync(excluded, JSON.stringify({ skipRecentHours: 0, excludeFolders: [join(work, 'cache')] }));
    const r = spawnSync(process.execPath, [CLI, 'clean', '--preset', 'recommended', '--report'], {
      encoding: 'utf8',
      env: { ...process.env, UNREVO_CLEANERS_PATH: cleanersFile, UNREVO_SETTINGS_PATH: excluded, UNREVO_QUARANTINE_ROOT: quarantineDir }
    });
    expect(r.status).toBe(0);
    expect(left('cache')).toHaveLength(2);
    // The report lands beside THAT settings file.
    const report = JSON.parse(readFileSync(join(root, 'scheduled-clean-report.json'), 'utf8'));
    expect(report.runs.at(-1).movedBytes).toBe(0);
    rmSync(join(root, 'scheduled-clean-report.json'), { force: true });
  });

  it('is for clean only: preview and list refuse it', () => {
    expect(run(['preview', '--report']).code).toBe(2);
    expect(run(['list', '--report']).code).toBe(2);
    expect(existsSync(reportFile())).toBe(false);
  });

  it('a usage error before any cleaning leaves no report', () => {
    fill();
    expect(run(['clean', '--rules', 'nope', '--report']).code).toBe(2);
    expect(existsSync(reportFile())).toBe(false);
  });
});

describe('programs (what Revo\'s RevoCmd lists)', () => {
  // The real installed-programs read, on whatever machine runs the tests: the
  // assertions are about the shape and the wildcard rule, never about which
  // programs happen to be here. 7-Zip, say, may not be.
  let all;
  beforeAll(() => {
    const r = run(['programs', '--json']);
    expect(r.code).toBe(0);
    all = json(r).programs;
  }, 60000);

  it('lists the installed programs, each with a name and a source', () => {
    expect(all.length).toBeGreaterThan(0);
    for (const row of all) {
      expect(typeof row.name).toBe('string');
      expect(row.source).toBe('registry');
      expect(row).not.toHaveProperty('installLocation');
      expect(row).not.toHaveProperty('uninstallCommand');
    }
  });

  it('is sorted by name', () => {
    const names = all.map((p) => p.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    expect(names).toEqual(sorted);
  });

  it('--match takes the whole name with * and ?, and ignores case', () => {
    const first = all[0].name;
    const exact = json(run(['programs', '--match', first.toUpperCase(), '--json'])).programs;
    expect(exact.length).toBeGreaterThan(0);
    expect(exact.every((p) => p.name.toLowerCase() === first.toLowerCase())).toBe(true);

    const prefix = first.slice(0, 3);
    const starred = json(run(['programs', '--match', `${prefix}*`, '--json'])).programs;
    expect(starred.length).toBeGreaterThan(0);
    expect(starred.every((p) => p.name.toLowerCase().startsWith(prefix.toLowerCase()))).toBe(true);

    // a part of a name with no wildcard is not a match (--match= keeps a leading dash from reading as a flag)
    const part = first.slice(1, 4);
    expect(json(run(['programs', `--match=${part}`, '--json'])).programs.every(
      (p) => p.name.toLowerCase() === part.toLowerCase()
    )).toBe(true);
  });

  it('--install-location and --uninstall-command add their fields', () => {
    const rows = json(run(['programs', '--install-location', '--uninstall-command', '--json'])).programs;
    // not compared with `all`: other test files add and remove fake Uninstall entries while this runs
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row).toHaveProperty('installLocation');
      expect(row).toHaveProperty('uninstallCommand');
    }
  });

  it('a pattern that matches nothing is an empty list and success, not an error', () => {
    const r = run(['programs', '--match', 'zzz-no-such-program-*', '--json']);
    expect(r.code).toBe(0);
    expect(json(r).programs).toEqual([]);
  });

  it('prints a readable list without --json', () => {
    const r = run(['programs', '--match', 'zzz-no-such-program-*']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/0 programs\./);
  });

  it('--store-apps adds the Store apps, marked as such', () => {
    // The Store query is a PowerShell call that can time out while the whole
    // suite saturates the machine; the command then says so and exits 1 rather
    // than returning a shorter list. Retry that, and only that.
    let r;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      r = run(['programs', '--store-apps', '--json']);
      if (r.code === 0) break;
      expect(r.err).toMatch(/Could not read the installed programs/);
    }
    expect(r.code).toBe(0);
    const rows = json(r).programs;
    const registry = rows.filter((p) => p.source === 'registry');
    expect(registry.length).toBeGreaterThan(0);
    // everything that is not a registry program is a Store app, and nothing is lost
    expect(rows.every((p) => p.source === 'registry' || p.source === 'store')).toBe(true);
    expect(rows.length).toBeGreaterThanOrEqual(registry.length);
  }, 120000);

  it('the program flags are refused on the other commands', () => {
    for (const flag of [['--match', 'x'], ['--install-location'], ['--uninstall-command'], ['--store-apps']]) {
      const r = run(['list', ...flag]);
      expect(r.code).toBe(2);
      expect(r.err).toMatch(/only for programs/);
    }
  });
});

describe('usage', () => {
  it('no command prints help and is a usage error', () => {
    const r = run([]);
    expect(r.code).toBe(2);
    expect(r.err + r.out).toMatch(/Usage/);
  });

  it('help prints the usage and succeeds', () => {
    const r = run(['help']);
    expect(r.code).toBe(0);
    expect(r.out).toMatch(/prune-cli/);
    expect(r.out).toMatch(/--delete-now/);
  });

  it('an unknown command or flag is a usage error', () => {
    expect(run(['frobnicate']).code).toBe(2);
    expect(run(['list', '--bogus']).code).toBe(2);
  });

  it('--delete-now and --quarantine together are refused', () => {
    expect(run(['clean', '--rules', 'fx_cache', '--delete-now', '--quarantine']).code).toBe(2);
  });
});

describe('selectRules', () => {
  const all = rules();
  const ids = (list) => list.map((r) => r.id);

  it('takes named rules in the order given, and refuses unknown ones', () => {
    expect(ids(selectRules(all, { rules: ['fx_other', 'fx_cache'] }).selected)).toEqual(['fx_other', 'fx_cache']);
    expect(selectRules(all, { rules: ['nope'] }).unknown).toEqual(['nope']);
  });

  it('the recommended preset leaves out risky, unrecommended and confirm-every-time rules', () => {
    expect(ids(selectRules(all, { preset: 'recommended' }).selected)).toEqual(['fx_cache', 'fx_gone', 'fx_broken']);
  });

  it('rejects a preset it does not know', () => {
    expect(selectRules(all, { preset: 'everything' }).badPreset).toBe('everything');
  });

  it('--except applies last and names unknown ids too', () => {
    const r = selectRules(all, { preset: 'recommended', except: ['fx_gone', 'zzz'] });
    expect(ids(r.selected)).toEqual(['fx_cache', 'fx_broken']);
    expect(r.unknown).toEqual(['zzz']);
  });

  it('with nothing asked for, selects everything', () => {
    expect(selectRules(all, {}).selected).toHaveLength(all.length);
  });
});
