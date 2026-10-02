import { readdir, lstat } from 'node:fs/promises';
import { join } from 'node:path';
import { runPowerShellJson } from './powershell.js';
import { psQuote } from './leftoverPattern.js';
import { measureDirectory } from './leftoverWalk.js';

/** Before/after snapshots for the install monitor.
 *
 * Hunter-style removal by diff is Revo's strongest trick: watch an install,
 * and the uninstall afterwards knows exactly what the installer put where,
 * names or no names. This module takes the two halves of that picture --
 * the system state (Add/Remove entries, startup entries, services, scheduled
 * tasks), read in one PowerShell call, and a depth-limited listing of the
 * folders an installer writes to -- and diffs them.
 *
 * Both are BOUNDED, in time and in entries, and say when a budget ran out:
 * a monitor that quietly walked a million files, or held them all in memory,
 * would be worse than none. The file listing is kept as one short string per
 * path in a Map for the "before" half only; the "after" half is compared
 * as it is walked and never stored.
 *
 * What a diff of a live machine includes is not only the installer's work --
 * a browser keeps writing its cache while the installer runs. So additions
 * are kept only where a program puts its own things (new folders and files
 * near the top of each root, not deep inside someone else's tree), folders
 * that churn by themselves are never entered, and a new folder is reported
 * once, as the folder, not as its thousand files. */

const MAX_NEW_DEPTH = 3;

/** Folders that change on their own while an installer runs, and that no
 * program's leftovers live in. Matched by exact name, below a root. */
const CHURN = new Set([
  'temp', 'tmp', 'microsoft', 'packages', 'crashdumps', 'd3dscache', 'cache', 'caches', 'code cache', 'gpucache',
  'inetcache', 'history', 'windowsapps', 'windows nt', '$recycle.bin', 'system volume information', 'installer',
  'package cache', 'logs'
]);

export function monitorFileRoots(env = process.env) {
  const roots = [];
  const add = (base, parts = [], depth = 4, shortcuts = false) => {
    if (typeof base === 'string' && base) roots.push({ path: parts.length ? join(base, ...parts) : base, depth, shortcuts });
  };
  add(env.ProgramFiles);
  add(env['ProgramFiles(x86)']);
  add(env.ProgramData);
  add(env.LOCALAPPDATA);
  add(env.APPDATA);
  add(env.APPDATA, ['Microsoft', 'Windows', 'Start Menu'], 4, true);
  add(env.ProgramData, ['Microsoft', 'Windows', 'Start Menu'], 4, true);
  const seen = new Set();
  return roots.filter((root) => {
    const key = root.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One walk over the roots, yielding what is there. Breadth-first per root,
 * never entering a link or a churning folder. A directory the consumer marks
 * `skipChildren` (a new folder, reported whole) is not entered either. */
async function* walk(roots, { maxEntries, budgetMs, now, state }) {
  const started = now();
  for (const root of roots) {
    let level = [{ path: root.path, depth: 0 }];
    while (level.length > 0) {
      const next = [];
      for (const { path, depth } of level) {
        if (state.visited >= maxEntries || now() - started > budgetMs) { state.truncated = true; return; }
        let entries;
        try { entries = await readdir(path, { withFileTypes: true }); } catch { continue; }

        const stats = await Promise.all(entries.map(async (entry) => {
          if (entry.isSymbolicLink()) return null;
          const isDirectory = entry.isDirectory();
          if (!isDirectory && !entry.isFile()) return null;
          if (isDirectory && CHURN.has(entry.name.toLowerCase())) return null;
          const full = join(path, entry.name);
          let info = null;
          if (!isDirectory) { try { info = await lstat(full); } catch { return null; } }
          return { path: full, isDirectory, depth: depth + 1, sizeBytes: info?.size ?? 0, mtimeMs: info?.mtimeMs ?? 0, root };
        }));

        for (const item of stats) {
          if (!item) continue;
          state.visited += 1;
          const skipChildren = yield item;
          if (item.isDirectory && !skipChildren && item.depth < root.depth) next.push({ path: item.path, depth: item.depth });
        }
      }
      level = next;
    }
  }
}

const signature = (item) => (item.isDirectory ? 'd' : `${item.sizeBytes}|${Math.round(item.mtimeMs)}`);

/** The "before" listing: path (lower-cased) -> a short signature. */
export async function captureFiles({ roots = monitorFileRoots(), maxEntries = 400000, budgetMs = 90000, now = Date.now } = {}) {
  const map = new Map();
  const state = { visited: 0, truncated: false };
  const iterator = walk(roots, { maxEntries, budgetMs, now, state });
  for (let step = await iterator.next(); !step.done; step = await iterator.next(false)) {
    map.set(step.value.path.toLowerCase(), signature(step.value));
  }
  return { map, truncated: state.truncated, visited: state.visited };
}

/** Compares the machine now with a "before" listing. Additions are the
 * top-most new folders and the new files near the top of each root; changed
 * files are only counted. */
export async function diffFiles(before, {
  roots = monitorFileRoots(), maxEntries = 400000, budgetMs = 90000, maxAdded = 5000, now = Date.now
} = {}) {
  const added = [];
  let modified = 0;
  let addedTruncated = false;
  const state = { visited: 0, truncated: false };
  const iterator = walk(roots, { maxEntries, budgetMs, now, state });

  let step = await iterator.next();
  while (!step.done) {
    const item = step.value;
    const known = before.map.get(item.path.toLowerCase());
    let skipChildren = false;
    if (known === undefined) {
      skipChildren = item.isDirectory; // reported whole, below
      if (item.depth <= MAX_NEW_DEPTH) {
        if (added.length >= maxAdded) addedTruncated = true;
        else added.push({ path: item.path, isDirectory: item.isDirectory, sizeBytes: item.isDirectory ? null : item.sizeBytes });
      }
    } else if (!item.isDirectory && known !== signature(item)) {
      modified += 1;
    }
    step = await iterator.next(skipChildren);
  }

  for (const entry of added) {
    if (entry.isDirectory) entry.sizeBytes = await measureDirectory(entry.path);
  }
  return { added, modified, addedTruncated, truncated: state.truncated || before.truncated === true, visited: state.visited };
}

/* ------------------------------------------------------------ system state */

/** Add/Remove entries, startup values, services and scheduled tasks, as one
 * JSON object. The Uninstall and Run roots are the same ones the leftover
 * scan reads. */
export function buildSystemScript() {
  const uninstallRoots = [
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
    'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
  ];
  const runRoots = [
    'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
    'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce',
    'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
  ];
  const list = (paths) => `@(${paths.map((p) => `'${psQuote(p)}'`).join(',')})`;
  return `
$ErrorActionPreference = 'SilentlyContinue'
$uninstall = New-Object System.Collections.ArrayList
foreach ($root in ${list(uninstallRoots)}) {
  foreach ($key in (Get-ChildItem -Path $root)) {
    $name = [string]$key.GetValue('DisplayName')
    if (-not $name) { continue }
    [void]$uninstall.Add([pscustomobject]@{
      key = $key.Name; psKey = ($root + '\\' + $key.PSChildName); name = $name; publisher = [string]$key.GetValue('Publisher')
      version = [string]$key.GetValue('DisplayVersion'); installLocation = [string]$key.GetValue('InstallLocation')
      uninstallString = [string]$key.GetValue('UninstallString'); estimatedSize = $key.GetValue('EstimatedSize')
      systemComponent = ($key.GetValue('SystemComponent') -eq 1)
    })
  }
}
$run = New-Object System.Collections.ArrayList
foreach ($root in ${list(runRoots)}) {
  $key = Get-Item -Path $root
  if ($key) {
    foreach ($valueName in $key.GetValueNames()) {
      [void]$run.Add([pscustomobject]@{ key = $key.Name; valueName = $valueName; data = [string]$key.GetValue($valueName) })
    }
  }
}
$services = @(Get-CimInstance -ClassName Win32_Service | ForEach-Object { [pscustomobject]@{ name = $_.Name; pathName = $_.PathName } })
$tasks = @(Get-ScheduledTask | ForEach-Object { [pscustomobject]@{ name = $_.TaskName; path = $_.TaskPath } })
[pscustomobject]@{ uninstall = @($uninstall); run = @($run); services = $services; tasks = $tasks } | ConvertTo-Json -Compress -Depth 4
`;
}

const asArray = (value) => (Array.isArray(value) ? value : value ? [value] : []);

export async function captureSystemState({ runPs = (script) => runPowerShellJson(script, { timeoutMs: 120000, retries: 0 }) } = {}) {
  const raw = (await runPs(buildSystemScript())) || {};
  return {
    uninstall: asArray(raw.uninstall), run: asArray(raw.run), services: asArray(raw.services), tasks: asArray(raw.tasks)
  };
}

const lower = (text) => String(text ?? '').toLowerCase();

/** What is in `after` and not in `before`. A startup value whose command
 * changed counts as new: the installer rewrote it. */
export function diffState(before, after) {
  const known = (list, id) => new Set(asArray(list).map(id));
  const uninstallKnown = known(before.uninstall, (u) => lower(u.key));
  const runKnown = known(before.run, (r) => `${lower(r.key)}|${lower(r.valueName)}|${lower(r.data)}`);
  const serviceKnown = known(before.services, (s) => lower(s.name));
  const taskKnown = known(before.tasks, (t) => `${lower(t.path)}${lower(t.name)}`);
  return {
    uninstall: asArray(after.uninstall).filter((u) => !uninstallKnown.has(lower(u.key))),
    run: asArray(after.run).filter((r) => !runKnown.has(`${lower(r.key)}|${lower(r.valueName)}|${lower(r.data)}`)),
    services: asArray(after.services).filter((s) => !serviceKnown.has(lower(s.name))),
    tasks: asArray(after.tasks).filter((t) => !taskKnown.has(`${lower(t.path)}${lower(t.name)}`))
  };
}

/** Which new Add/Remove entry is the program the person installed.
 *
 * An installer sometimes adds several (a redistributable alongside the
 * program). The one whose name resembles the installer's file name wins;
 * failing that, the biggest. System components are not candidates. The
 * others are returned so the trace can say what else appeared. Null when
 * the installer added no entry at all -- a portable program. */
export function chooseProgram(newEntries, installerPath) {
  const candidates = asArray(newEntries).filter((entry) => entry && typeof entry.name === 'string' && entry.name.trim() && !entry.systemComponent);
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return { program: candidates[0], others: [] };

  const fileName = lower(String(installerPath).split(/[\\/]/).pop().replace(/\.(exe|msi)$/i, '')).replace(/[^a-z0-9]/g, '');
  const squash = (text) => lower(text).replace(/[^a-z0-9]/g, '');
  const resembles = (entry) => {
    const name = squash(entry.name);
    return name.length >= 4 && fileName.length >= 4 && (fileName.includes(name) || name.includes(fileName.slice(0, Math.min(fileName.length, 6))));
  };
  const byName = candidates.filter(resembles);
  const pool = byName.length > 0 ? byName : candidates;
  const program = [...pool].sort((a, b) => (Number(b.estimatedSize) || 0) - (Number(a.estimatedSize) || 0))[0];
  return { program, others: candidates.filter((entry) => entry !== program) };
}
