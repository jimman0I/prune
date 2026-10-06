import { parseArgs } from 'node:util';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { packagedDefaults } from './lib/cliPaths.js';

/** The Prune command line: list, preview, clean, programs.
 *
 *   prune-cli programs [--match "Microso*"] [--install-location]
 *                      [--uninstall-command] [--store-apps] [--json]
 *   prune-cli list    [--json]
 *   prune-cli preview [--rules a,b | --preset recommended] [--except x,y] [--json]
 *   prune-cli clean   (--rules a,b | --preset recommended) [--except x,y]
 *                     [--delete-now | --quarantine] [--json] [--report]
 *
 * A Node script, not part of the Electron window: a GUI-subsystem exe cannot
 * print to a console, so the installer ships `prune-cli.cmd` beside Prune.exe,
 * which runs this file with ELECTRON_RUN_AS_NODE=1 -- the way VS Code's
 * `code` command works. It imports the same rule engine, settings and guards
 * the app does, so a headless clean is the same clean: it honours the
 * exclusions, the recent-files guard, protected paths, Quarantine and the
 * Delete-now setting.
 *
 * What it will NOT do, on purpose: guess. `clean` with no selection is an
 * error rather than "everything"; a rule that is asked about each time in the
 * app (the free-space wipe) cannot be run headless; the `recommended` preset
 * leaves out rules that lose data (history, cookies, ...), which run only
 * when named with --rules. Nothing here prompts, because nothing here can.
 *
 * Exit codes: 0 success, 1 a rule failed (or was unreadable), 2 bad usage.
 * Set through process.exitCode, never process.exit(): exiting while I/O is
 * still settling can crash on Windows. */

const USAGE = `Usage: prune-cli <command> [options]

Commands
  list                 List the Deep Clean rules.
  preview              Measure rules without changing anything.
  clean                Clean rules (moves files to Quarantine, or deletes).
  programs             List installed programs (what Revo's RevoCmd does).
  help                 Show this text.

Selecting rules
  --rules a,b          Exactly these rule ids.
  --preset recommended The rules the app ticks by default. Skips rules that
                       lose data (history, cookies, ...): name those with --rules.
  --except x,y         Leave these out of the selection.
  (preview and list default to every rule; clean requires a selection.)

Options
  --delete-now         Delete outright for this run, overriding the setting.
  --quarantine         Move to Quarantine for this run, overriding the setting.
                       With neither, the Deep Clean setting decides.
  --json               Machine-readable output.
  --report             clean only: leave a short report (time, rules, moved and
                       freed bytes, errors) beside the settings file, for Prune
                       to read. What the scheduled clean uses.
  --settings <file>    Use this settings file.
  --quarantine-dir <d> Use this Quarantine folder.
  --cleaners <file>    Use this rule file instead of the built-in rules.

Listing programs
  --match <pattern>    Only programs whose whole name matches: * is any run of
                       characters, ? is one. Case is ignored.
                       Example: prune-cli programs --match "Microso*"
  --install-location   Include each program's install folder.
  --uninstall-command  Include each program's uninstall command.
  --store-apps         Include Microsoft Store apps.

Exit codes: 0 ok, 1 a rule failed, 2 bad usage.`;

class UsageError extends Error {}

const csv = (value) => (value ? String(value).split(',').map((s) => s.trim()).filter(Boolean) : []);

/** Which rules a command acts on. Pure, so it is tested without a process.
 *
 * Returns { selected, unknown, badPreset }. `rules` (named) keeps the order
 * given; the preset keeps the file's order; both together are their union.
 * Nothing asked for selects everything -- the caller decides whether that
 * is acceptable (it is for list/preview, not for clean). */
export function selectRules(all, { rules: named = [], preset = null, except = [] } = {}) {
  const byId = new Map(all.map((r) => [r.id, r]));
  const unknown = [];
  let selected;

  if (preset && preset !== 'recommended') return { selected: [], unknown, badPreset: preset };

  if (named.length === 0 && !preset) {
    selected = [...all];
  } else {
    selected = [];
    const seen = new Set();
    const add = (rule) => { if (!seen.has(rule.id)) { seen.add(rule.id); selected.push(rule); } };
    if (preset === 'recommended') {
      for (const rule of all) {
        if (rule.recommended && !rule.risky && !rule.confirmEveryTime) add(rule);
      }
    }
    for (const id of named) {
      if (byId.has(id)) add(byId.get(id)); else unknown.push(id);
    }
  }

  const drop = new Set();
  for (const id of except) {
    if (byId.has(id)) drop.add(id); else unknown.push(id);
  }
  return { selected: selected.filter((r) => !drop.has(r.id)), unknown, badPreset: null };
}

const bytes = (n) => {
  if (n === null || n === undefined) return '-';
  if (n === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(sizes.length - 1, Math.floor(Math.log(n) / Math.log(1024)));
  return `${parseFloat((n / 1024 ** i).toFixed(1))} ${sizes[i]}`;
};

/** `prune-cli programs`: the installed programs, as RevoCmd lists them.
 *
 * Reads the same registry list the Applications screen does (and, with
 * --store-apps, the Store packages), so the two never disagree about what is
 * installed. Nothing here changes anything. A failed read is exit code 1 with
 * the reason, never an empty list that looks like "nothing is installed". */
async function runPrograms(values, out, err) {
  const { listInstalledPrograms } = await import('./services/programs.js');
  const { matchPrograms, describeProgram } = await import('./lib/programFilter.js');

  let programs;
  try {
    programs = await listInstalledPrograms();
    if (values['store-apps']) {
      const { getStoreApps } = await import('./services/storeApps.js');
      programs = [...programs, ...(await getStoreApps())];
    }
  } catch (e) {
    err(`Could not read the installed programs: ${e.message}\n`);
    return 1;
  }

  const rows = matchPrograms(programs, values.match)
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
    .map((program) => describeProgram(program, {
      installLocation: values['install-location'], uninstallCommand: values['uninstall-command']
    }));

  if (values.json) {
    out(`${JSON.stringify({ programs: rows }, null, 2)}\n`);
    return 0;
  }
  const lines = rows.map((row) => {
    const head = `${row.name}${row.version ? `  ${row.version}` : ''}${row.publisher ? `  (${row.publisher})` : ''}`;
    const extra = [];
    if ('installLocation' in row) extra.push(`    Install location: ${row.installLocation ?? '-'}`);
    if ('uninstallCommand' in row) extra.push(`    Uninstall command: ${row.uninstallCommand ?? '-'}`);
    return [head, ...extra].join('\n');
  });
  out(`${lines.join('\n')}${lines.length ? '\n' : ''}${rows.length} program${rows.length === 1 ? '' : 's'}.\n`);
  return 0;
}

/** Runs the CLI. `io.out` / `io.err` receive text; returns the exit code. */
export async function runCli(argv, io = {}) {
  const out = io.out ?? ((s) => process.stdout.write(s));
  const err = io.err ?? ((s) => process.stderr.write(s));

  let values;
  let positionals;
  try {
    ({ values, positionals } = parseArgs({
      args: argv,
      allowPositionals: true,
      strict: true,
      options: {
        rules: { type: 'string' },
        preset: { type: 'string' },
        except: { type: 'string' },
        json: { type: 'boolean', default: false },
        'delete-now': { type: 'boolean', default: false },
        quarantine: { type: 'boolean', default: false },
        report: { type: 'boolean', default: false },
        settings: { type: 'string' },
        'quarantine-dir': { type: 'string' },
        cleaners: { type: 'string' },
        match: { type: 'string' },
        'install-location': { type: 'boolean', default: false },
        'uninstall-command': { type: 'boolean', default: false },
        'store-apps': { type: 'boolean', default: false },
        help: { type: 'boolean', default: false }
      }
    }));
  } catch (e) {
    err(`${e.message}\n\n${USAGE}\n`);
    return 2;
  }

  const command = positionals[0];
  if (values.help || command === 'help') { out(`${USAGE}\n`); return 0; }
  if (!command) { err(`${USAGE}\n`); return 2; }
  if (!['list', 'preview', 'clean', 'programs'].includes(command) || positionals.length > 1) {
    err(`Unknown command "${positionals.join(' ')}".\n\n${USAGE}\n`);
    return 2;
  }
  if (values['delete-now'] && values.quarantine) {
    err('--delete-now and --quarantine cannot be used together.\n');
    return 2;
  }

  if (values.report && command !== 'clean') {
    err('--report is only for clean.\n');
    return 2;
  }

  if (command === 'programs') return runPrograms(values, out, err);
  const programFlags = ['match', 'install-location', 'uninstall-command', 'store-apps'].filter((flag) => values[flag]);
  if (programFlags.length > 0) {
    err(`--${programFlags[0]} is only for programs.\n`);
    return 2;
  }

  // Paths for the engine, read at call time by the modules below -- so they
  // are set before those modules are imported.
  if (values.settings) process.env.UNREVO_SETTINGS_PATH = values.settings;
  if (values['quarantine-dir']) process.env.UNREVO_QUARANTINE_ROOT = values['quarantine-dir'];
  if (values.cleaners) process.env.UNREVO_CLEANERS_PATH = values.cleaners;
  // An installed copy that was told nothing uses the app's own data folder,
  // not %LOCALAPPDATA%\Prune: otherwise a clean started by Windows would run
  // with default guards and ignore the person's exclusions.
  const installed = packagedDefaults({ cliPath: fileURLToPath(import.meta.url) });
  if (installed) {
    if (!process.env.UNREVO_SETTINGS_PATH) process.env.UNREVO_SETTINGS_PATH = installed.settings;
    if (!process.env.UNREVO_QUARANTINE_ROOT) process.env.UNREVO_QUARANTINE_ROOT = installed.quarantine;
    if (!process.env.UNREVO_SQLITE3_PATH) process.env.UNREVO_SQLITE3_PATH = installed.sqlite;
  }

  const { loadCleanerRules, scanRuleAsync, executeRule, rulePathsExist } = await import('./lib/cleanerRules.js');
  const { getSettings, cleanGuardsFrom } = await import('./services/settings.js');

  const emit = (data, human) => out(values.json ? `${JSON.stringify(data, null, 2)}\n` : human());
  const fail = (message, code) => {
    if (values.json) err(`${JSON.stringify({ error: message })}\n`); else err(`${message}\n`);
    return code;
  };

  let allRules;
  try {
    allRules = loadCleanerRules();
  } catch (e) {
    return fail(`Could not read the cleaner rules: ${e.message}`, 1);
  }

  const { selected, unknown, badPreset } = selectRules(allRules, {
    rules: csv(values.rules), preset: values.preset ?? null, except: csv(values.except)
  });
  if (badPreset) return fail(`Unknown preset "${badPreset}". The only preset is "recommended".`, 2);
  if (unknown.length > 0) return fail(`Unknown rule id${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}. Run "prune-cli list" to see them.`, 2);

  if (command === 'list') {
    const rows = allRules.map((r) => ({
      id: r.id, name: r.name, category: r.category, description: r.description ?? '',
      recommended: r.recommended === true, risky: r.risky === true, confirmEveryTime: r.confirmEveryTime === true
    }));
    emit({ rules: rows }, () => {
      const width = Math.max(...rows.map((r) => r.id.length), 4);
      return `${rows.map((r) => `${r.id.padEnd(width)}  ${r.category} / ${r.name}${r.recommended ? '  [recommended]' : ''}${r.risky ? '  [loses data]' : ''}${r.confirmEveryTime ? '  [app only]' : ''}`).join('\n')}\n`;
    });
    return 0;
  }

  if (command === 'clean') {
    if (csv(values.rules).length === 0 && !values.preset) {
      return fail('clean needs a selection: --rules a,b or --preset recommended.', 2);
    }
    const appOnly = selected.filter((r) => r.confirmEveryTime);
    if (appOnly.length > 0) {
      return fail(`${appOnly.map((r) => r.id).join(', ')} ${appOnly.length > 1 ? 'are' : 'is'} asked about in the app each time and cannot be run from the command line.`, 2);
    }
  }

  const settings = await getSettings();
  const guards = cleanGuardsFrom(settings);
  if (command === 'clean') {
    if (values['delete-now']) guards.removal = 'delete';
    else if (values.quarantine) guards.removal = 'quarantine';
  }
  if (selected.some((r) => r.requiresProgram)) {
    const { listInstalledPrograms } = await import('./services/programs.js');
    try {
      guards.installedProgramNames = new Set((await listInstalledPrograms()).map((p) => p.name.toLowerCase()));
    } catch { guards.installedProgramNames = new Set(); }
  }

  // The preset is "what the app would tick": rules for software that is not
  // here are left out rather than run for nothing.
  let targets = selected;
  if (values.preset) targets = selected.filter((r) => { try { return rulePathsExist(r, guards); } catch { return false; } });

  if (command === 'preview') {
    const rows = [];
    let failed = false;
    for (const rule of targets) {
      try {
        const r = await scanRuleAsync(rule, guards);
        rows.push({
          id: rule.id, name: rule.name, sizeBytes: r.sizeBytes, fileCount: r.fileCount, heldCount: r.heldCount ?? 0,
          present: r.present, accessible: r.accessible, ...(r.incomplete ? { incomplete: r.incomplete } : {})
        });
      } catch (e) {
        failed = true;
        rows.push({ id: rule.id, name: rule.name, error: e.message });
      }
    }
    const totalBytes = rows.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
    emit({ rules: rows, totalBytes }, () => {
      const lines = rows.map((r) => (r.error
        ? `${r.id}: ERROR ${r.error}`
        : `${r.id}  ${r.name}  ${r.present === false ? 'not installed' : r.accessible === false ? 'needs administrator' : bytes(r.sizeBytes)}${r.fileCount ? `  (${r.fileCount} files)` : ''}${r.heldCount ? `  ${r.heldCount} held back` : ''}`));
      return `${lines.join('\n')}\nTotal: ${bytes(totalBytes)}\n`;
    });
    return failed ? 1 : 0;
  }

  // clean
  const startedAt = Date.now();
  const rows = [];
  let failed = false;
  let freedBytes = 0;
  let movedBytes = 0;
  for (const rule of targets) {
    try {
      const r = await executeRule(rule, guards);
      freedBytes += r.freedBytes || 0;
      movedBytes += r.movedBytes || 0;
      if (r.error) failed = true;
      rows.push({
        id: rule.id, name: rule.name, freedBytes: r.freedBytes || 0, movedBytes: r.movedBytes || 0,
        skippedCount: r.skipped?.length || 0, ...(r.scheduledForRestart ? { scheduledForRestart: r.scheduledForRestart } : {}),
        ...(r.error ? { error: r.error } : {})
      });
    } catch (e) {
      failed = true;
      rows.push({ id: rule.id, name: rule.name, freedBytes: 0, movedBytes: 0, skippedCount: 0, error: e.message });
    }
  }
  if (values.report) {
    // For the app to read later. A report that cannot be written is said, but
    // does not turn a clean that worked into a failure.
    try {
      const { buildRun, appendRun } = await import('./services/scheduledCleanReport.js');
      await appendRun(buildRun({ startedAt, finishedAt: Date.now(), mode: guards.removal, rows }));
    } catch (e) {
      err(`Could not write the report: ${e.message}\n`);
    }
  }
  emit({ mode: guards.removal, freedBytes, movedBytes, rules: rows }, () => {
    const lines = rows.map((r) => (r.error
      ? `${r.id}: ERROR ${r.error}`
      : `${r.name}: ${r.freedBytes ? `freed ${bytes(r.freedBytes)}` : r.movedBytes ? `moved ${bytes(r.movedBytes)}` : 'nothing to do'}${r.skippedCount ? `, ${r.skippedCount} skipped` : ''}${r.scheduledForRestart ? `, ${r.scheduledForRestart} scheduled for restart` : ''}`));
    return `${lines.join('\n')}\nFreed ${bytes(freedBytes)}${movedBytes ? `, moved ${bytes(movedBytes)} (Quarantine or the Recycle Bin: the space is back once that is emptied)` : ''}.\n`;
  });
  return failed ? 1 : 0;
}

// Run when invoked as a script (node cli.js, or Prune.exe with
// ELECTRON_RUN_AS_NODE=1), not when imported by the tests.
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  runCli(process.argv.slice(2)).then((code) => { process.exitCode = code; }, (e) => {
    process.stderr.write(`${e?.stack || e}\n`);
    process.exitCode = 1;
  });
}
