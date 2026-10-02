import { runPowerShellJson } from './powershell.js';
import { scanRegistryLeftovers, scanRegistryAnchor, canonicalKeyPath } from './registryLeftovers.js';
import { buildSearchPattern, psQuote } from './leftoverPattern.js';
import { normalizeScanMode, advancedFileRoots } from './leftoverModes.js';
import { anchorDirectories } from './leftoverAnchors.js';
import { walkForLeftovers, measureDirectory } from './leftoverWalk.js';
import { productTokens, buildTokenPattern, buildMatchers, classifyLabel } from './leftoverMatch.js';
import { permanentDeletionRefusal } from './leftoverRemoval.js';
import { osComponentRefusal, buildFootprints, otherPrograms, footprintRefusal } from './leftoverProtection.js';

/** Each entry is a PowerShell expression, and every one is DOUBLE-QUOTED
 * so a path containing spaces stays a single array element.
 *
 * Real bug, found dogfooding (2026-09-02): the Start Menu root used to be
 * interpolated bare, and "Start Menu" has a space in it, so the generated
 * array literal was a PowerShell syntax error -- "Unexpected token
 * '\Microsoft\Windows\Start'". That took down the ENTIRE file scan, which
 * scanForLeftovers catches and reports as { ok: false }, rendered by the
 * UI as "Couldn't check files & folders." Every uninstall since this
 * feature was written found registry keys and scheduled tasks and never
 * once found a file. The whole test suite for this module mocks
 * runPowerShellJson, so the broken script was never executed by a test --
 * see leftoverScan.roots.test.js, which runs it for real.
 *
 * `%LOCALAPPDATA%\Programs` is new alongside it: that's where Electron and
 * Squirrel installers put things (VS Code, Discord, Slack, and the
 * TriClaude entry that prompted this), and since the scan looks exactly
 * one level down, an app living there was invisible even to a working
 * scan. */
const SEARCH_ROOTS = [
  '"$env:ProgramFiles"',
  '"${env:ProgramFiles(x86)}"',
  '"$env:APPDATA"',
  '"$env:LOCALAPPDATA"',
  '"$env:LOCALAPPDATA\\Programs"',
  '"$env:ProgramData"',
  '"$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"'
];

/** The `@(...)` array literal the scan scripts interpolate. Exported so a
 * test can hand it to real PowerShell and prove it parses -- the mistake
 * above was invisible to every mocked test in this module. */
export function buildRootsExpression() {
  return `@(${SEARCH_ROOTS.join(',')})`;
}

const EMPTY = () => ({ ok: true, items: [] });
const FAILED = () => ({ ok: false, items: [] });

function leafOf(path) {
  return String(path).replace(/[\\/]+$/, '').split(/[\\/]/).pop();
}

function isUnder(path, dirs) {
  const lower = String(path).toLowerCase().replace(/[\\/]+$/, '');
  return dirs.some((dir) => {
    const root = dir.toLowerCase().replace(/[\\/]+$/, '');
    return lower === root || lower.startsWith(`${root}\\`);
  });
}

/** Leftover scan, at the depth the person chose (see leftoverModes.js):
 * files and folders, the registry keys and values that belong to the
 * program (registryLeftovers.js, which is a search of its own), scheduled
 * tasks, and -- Advanced only -- services. NOT a full before/after system
 * snapshot; that is what the install monitor is for. Each check runs
 * independently so one failing (e.g. a locked directory) doesn't take the
 * others down.
 *
 * `anchors` is what the program itself said about where it lives
 * (leftoverAnchors.js). Safe reports only those; the other two add them to
 * what the name search finds, and everything found is tiered: **certain**
 * when the program's own folder or registry key vouches for it, **likely**
 * when the product's name does, **possible** when only the publisher's name
 * or a single word of the product's does.
 *
 * Whatever the tier, nothing is returned that belongs to Windows or to a
 * Microsoft component, or that would damage another INSTALLED program --
 * `installedPrograms` (an array or a promise of one) is that list; without
 * it the other-program check is skipped, never guessed. The group reports
 * how many it held back as `protected`.
 *
 * `fileRoots` and `walkOptions` exist so a test can point the Advanced walk
 * at a temporary tree. */
export async function scanForLeftovers({
  name, publisher, mode, anchors = {}, installedPrograms, selfId, fileRoots, walkOptions, extraFiles = []
} = {}) {
  const scanMode = normalizeScanMode(mode);
  // For the disk, only folders that still exist. For the registry and the
  // task list, every folder the program named: an uninstaller removes the
  // folder and leaves the startup entry pointing into it.
  const anchorDirs = anchorDirectories(anchors, { existing: true });
  const referencedDirs = anchorDirectories(anchors);
  const tokens = scanMode === 'advanced' ? productTokens(name, publisher) : [];
  const matchers = buildMatchers({ name, publisher, tokens });
  const others = await loadOtherPrograms(installedPrograms, { selfId, selfRegistryKey: anchors?.registryKey });
  const ctx = {
    anchorDirs, referencedDirs, matchers, registryKey: anchors?.registryKey, extraFiles,
    footprints: buildFootprints(others),
    otherKeys: new Set(others.map((program) => program.registryKey).filter(Boolean).map(canonicalKeyPath))
  };

  if (scanMode === 'safe') {
    const [files, registryKeys] = await Promise.all([
      scanAnchorFiles(anchorDirs).catch(FAILED),
      scanRegistryAnchor(anchors?.registryKey).catch(FAILED)
    ]);
    return {
      files: finishFiles(files, ctx),
      registryKeys: finishRegistry(registryKeys, ctx),
      scheduledTasks: EMPTY(),
      mode: scanMode
    };
  }

  const advanced = scanMode === 'advanced';

  const [filesFound, registryKeys, scheduledTasks, services] = await Promise.all([
    (advanced
      ? scanFilesAdvanced(name, publisher, tokens, { fileRoots, walkOptions })
      : scanFiles(name, publisher)).catch(FAILED),
    scanRegistryLeftovers(name, publisher, {
      advanced, extraPattern: buildTokenPattern(tokens), anchorDirs: referencedDirs
    }).catch(FAILED),
    scanScheduledTasks(name, referencedDirs).catch(FAILED),
    advanced ? scanServices(name, publisher, tokens, referencedDirs).catch(FAILED) : Promise.resolve(null)
  ]);

  const files = await withAnchorFiles(filesFound, anchorDirs);
  const result = {
    files: finishFiles(files, ctx),
    registryKeys: finishRegistry(registryKeys, ctx),
    scheduledTasks: finishTasks(scheduledTasks, ctx),
    mode: scanMode
  };
  if (services) result.services = finishServices(services, ctx);
  return result;
}

async function loadOtherPrograms(installedPrograms, options) {
  if (!installedPrograms) return [];
  try {
    return otherPrograms(await installedPrograms, options);
  } catch {
    // Not knowing the other programs is not a reason to fail the scan; the
    // protections that need no list (Windows, Microsoft, drive roots) hold.
    return [];
  }
}

/* ----------------------------------------------------- tiering and guards */

function finishFiles(group, ctx) {
  if (!group?.ok) return group;
  const items = [];
  let withheld = 0;
  for (const item of group.items) {
    const certain = isUnder(item.path, ctx.anchorDirs) || ctx.extraFiles.some((p) => p.toLowerCase() === item.path.toLowerCase());
    const refusal = permanentDeletionRefusal(item.path) || osComponentRefusal(item.path) || footprintRefusal(item.path, ctx.footprints, { certain });
    if (refusal) { withheld += 1; continue; }
    const label = leafOf(item.path).replace(/\.(lnk|url)$/i, '');
    items.push({ ...item, confidence: certain ? 'certain' : classifyLabel(label, ctx.matchers) });
  }
  return { ...group, items, ...(withheld > 0 ? { protected: withheld } : {}) };
}

function finishRegistry(group, ctx) {
  if (!group?.ok) return group;
  // Another installed program's own Add/Remove entry is not a leftover of
  // this one, however alike their names are ("Visual Studio 2019" and "2022").
  const items = [];
  let withheld = 0;
  for (const raw of group.items) {
    const { anchored, text, ...item } = raw;
    if (item.isUninstallEntry && !item.valueName && ctx.otherKeys.has(canonicalKeyPath(item.path))) { withheld += 1; continue; }
    const isOwnKey = ctx.registryKey && canonicalKeyPath(item.path) === canonicalKeyPath(ctx.registryKey);
    const label = text || (item.valueName ?? leafOf(item.path));
    items.push({ ...item, confidence: anchored || isOwnKey ? 'certain' : classifyLabel(label, ctx.matchers) });
  }
  return { ...group, items, ...(withheld > 0 ? { protected: withheld } : {}) };
}

function finishTasks(group, ctx) {
  if (!group?.ok) return group;
  const items = [];
  let withheld = 0;
  for (const raw of group.items) {
    const { how, ...item } = raw;
    // Tasks Windows ships and schedules itself.
    if (/^\\Microsoft\\Windows(\\|$)/i.test(item.path || '')) { withheld += 1; continue; }
    items.push({ ...item, confidence: how === 'anchor' ? 'certain' : classifyLabel(`${item.name} ${item.path}`, ctx.matchers) });
  }
  return { ...group, items, ...(withheld > 0 ? { protected: withheld } : {}) };
}

function finishServices(group, ctx) {
  if (!group?.ok) return group;
  const items = group.items.map((raw) => {
    const { how, ...item } = raw;
    return { ...item, confidence: how === 'anchor' ? 'certain' : classifyLabel(`${item.name} ${item.displayName}`, ctx.matchers) };
  });
  return { ...group, items };
}

/* --------------------------------------------------------------- files */

/** The anchor folders as scan items, sized. */
async function scanAnchorFiles(dirs) {
  const items = [];
  for (const path of dirs) items.push({ path, sizeBytes: await measureDirectory(path) });
  return { ok: true, items };
}

/** Adds the anchor folders to a name-search result without listing one twice.
 * A name-search hit lying INSIDE an anchor is dropped: the anchor already
 * covers it, and offering both would count the same bytes twice. */
async function withAnchorFiles(found, dirs) {
  if (dirs.length === 0 || !found.ok) return found;
  const anchored = await scanAnchorFiles(dirs);
  return { ...found, items: [...anchored.items, ...found.items.filter((item) => !isUnder(item.path, dirs))] };
}

async function scanFiles(name, publisher) {
  const pattern = buildSearchPattern(name, publisher);
  if (pattern === null) return { ok: true, items: [] };
  const script = `
$roots = ${buildRootsExpression()} | Where-Object { $_ -and (Test-Path $_) }
$pattern = '${psQuote(pattern)}'
$roots | ForEach-Object {
  Get-ChildItem -Path $_ -Directory -ErrorAction SilentlyContinue |
    Where-Object { $_.Name -match $pattern }
} | Select-Object @{N='path';E={$_.FullName}}, @{N='sizeBytes';E={
    (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue |
      Measure-Object -Property Length -Sum).Sum
  }} | ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: items.map(i => ({ path: i.path, sizeBytes: i.sizeBytes || 0 })) };
}

/** Folder names the walk will not enter. Neither can hold a program's
 * leftovers, and both are enormous. */
const NEVER_ENTER = new Set(['windowsapps', 'windows nt', '$recycle.bin', 'system volume information']);

async function scanFilesAdvanced(name, publisher, tokens, { fileRoots, walkOptions } = {}) {
  const pattern = buildSearchPattern(name, publisher);
  if (pattern === null) return { ok: true, items: [] };
  const nameRe = new RegExp(pattern, 'i');
  const tokenPattern = buildTokenPattern(tokens);
  const tokenRe = tokenPattern ? new RegExp(tokenPattern, 'i') : null;

  // A shortcut is matched on its name without the extension: "Acme.lnk".
  const isMatch = (entryName, _full, isDirectory) => {
    const label = isDirectory ? entryName : entryName.replace(/\.(lnk|url)$/i, '');
    return nameRe.test(label) || (tokenRe !== null && tokenRe.test(label));
  };

  const { matches, truncated } = await walkForLeftovers({
    roots: fileRoots ?? advancedFileRoots(),
    isMatch,
    skipDescent: (folder) => NEVER_ENTER.has(folder.toLowerCase()),
    ...walkOptions
  });

  const items = [];
  for (const match of matches) {
    items.push({
      path: match.path,
      sizeBytes: match.isDirectory ? await measureDirectory(match.path) : await measureDirectory(match.path, { maxEntries: 1 })
    });
  }
  return { ok: true, items, ...(truncated ? { truncated: true } : {}) };
}

/* ---------------------------------------------------------------- tasks */

/** A PowerShell array literal of the anchor folders, lower-cased with a
 * trailing separator, for a script to test a command line against. */
function anchorsLiteral(dirs) {
  const quoted = dirs.map((dir) => `'${psQuote(dir.toLowerCase().replace(/[\\/]+$/, ''))}\\'`);
  return `@(${quoted.join(',')})`;
}

async function scanScheduledTasks(name, anchorDirs = []) {
  const pattern = buildSearchPattern(name);
  if (pattern === null && anchorDirs.length === 0) return { ok: true, items: [] };
  const script = `
$pattern = '${psQuote(pattern ?? '(?!)')}'
$anchors = ${anchorsLiteral(anchorDirs)}
function Test-Anchored($value) {
  if (-not $value) { return $false }
  $lower = ([string]$value).ToLowerInvariant().TrimEnd('\\') + '\\'
  foreach ($anchor in $anchors) { if ($lower.Contains($anchor)) { return $true } }
  return $false
}
Get-ScheduledTask -ErrorAction SilentlyContinue | ForEach-Object {
  $actions = (@($_.Actions) | ForEach-Object { ([string]$_.Execute + ' ' + [string]$_.Arguments).Trim() }) -join ' | '
  if (Test-Anchored $actions) { $how = 'anchor' }
  elseif ($_.TaskName -match $pattern -or $_.TaskPath -match $pattern) { $how = 'name' }
  else { return }
  [pscustomobject]@{ name = $_.TaskName; path = $_.TaskPath; actions = $actions; how = $how }
} | ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items };
}

/* ------------------------------------------------------------- services */

/** Services the program registered, reported and never removed.
 *
 * A service is removed with `sc delete` and administrator rights, and
 * deleting the wrong one can stop Windows booting; Prune lists what it
 * found so the person can look, and does not offer to take it away. Anything
 * running out of the Windows folder is dropped here, whatever it is called. */
async function scanServices(name, publisher, tokens, anchorDirs = []) {
  const base = buildSearchPattern(name, publisher);
  if (base === null && anchorDirs.length === 0) return { ok: true, items: [] };
  const extra = buildTokenPattern(tokens);
  const named = base ?? '(?!)';
  const pattern = extra ? `${named}|${extra}` : named;
  const script = `
$pattern = '${psQuote(pattern)}'
$anchors = ${anchorsLiteral(anchorDirs)}
$windows = [string]$env:SystemRoot
function Test-Anchored($value) {
  if (-not $value) { return $false }
  $lower = ([string]$value).ToLowerInvariant().Trim('"') + '\\'
  foreach ($anchor in $anchors) { if ($lower.Contains($anchor)) { return $true } }
  return $false
}
Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue | ForEach-Object {
  if (([string]$_.PathName).Trim('"').StartsWith($windows, [System.StringComparison]::OrdinalIgnoreCase)) { return }
  if (Test-Anchored $_.PathName) { $how = 'anchor' }
  elseif ($_.Name -match $pattern -or $_.DisplayName -match $pattern -or $_.PathName -match $pattern) { $how = 'name' }
  else { return }
  [pscustomobject]@{ name = $_.Name; displayName = $_.DisplayName; pathName = $_.PathName; how = $how }
} | ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items };
}
