import { runPowerShellJson } from './powershell.js';
import { scanRegistryLeftovers, scanRegistryAnchor } from './registryLeftovers.js';
import { buildSearchPattern, psQuote } from './leftoverPattern.js';
import { normalizeScanMode, advancedFileRoots } from './leftoverModes.js';
import { anchorDirectories } from './leftoverAnchors.js';
import { walkForLeftovers, measureDirectory } from './leftoverWalk.js';
import { productTokens, buildTokenPattern } from './leftoverMatch.js';

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
 * what the name search finds. `fileRoots` and `walkOptions` exist so a test
 * can point the Advanced walk at a temporary tree. */
export async function scanForLeftovers({ name, publisher, mode, anchors = {}, fileRoots, walkOptions } = {}) {
  const scanMode = normalizeScanMode(mode);
  const anchorDirs = anchorDirectories(anchors, { existing: true });

  if (scanMode === 'safe') {
    const [files, registryKeys] = await Promise.all([
      scanAnchorFiles(anchorDirs).catch(FAILED),
      scanRegistryAnchor(anchors?.registryKey).catch(FAILED)
    ]);
    return { files, registryKeys, scheduledTasks: EMPTY(), mode: scanMode };
  }

  const advanced = scanMode === 'advanced';
  const tokens = advanced ? productTokens(name, publisher) : [];

  const [filesFound, registryKeys, scheduledTasks, services] = await Promise.all([
    (advanced
      ? scanFilesAdvanced(name, publisher, tokens, { fileRoots, walkOptions })
      : scanFiles(name, publisher)).catch(FAILED),
    scanRegistryLeftovers(name, publisher, { advanced, extraPattern: buildTokenPattern(tokens) }).catch(FAILED),
    scanScheduledTasks(name).catch(FAILED),
    advanced ? scanServices(name, publisher, tokens).catch(FAILED) : Promise.resolve(null)
  ]);

  const files = await withAnchorFiles(filesFound, anchorDirs);
  const result = { files, registryKeys, scheduledTasks, mode: scanMode };
  if (services) result.services = services;
  return result;
}

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
  const inside = (path) => dirs.some((dir) => {
    const lower = path.toLowerCase();
    const root = dir.toLowerCase();
    return lower === root || lower.startsWith(`${root}\\`);
  });
  return { ...found, items: [...anchored.items, ...found.items.filter((item) => !inside(item.path))] };
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

async function scanScheduledTasks(name) {
  const pattern = buildSearchPattern(name);
  if (pattern === null) return { ok: true, items: [] };
  const script = `
$pattern = '${psQuote(pattern)}'
Get-ScheduledTask -ErrorAction SilentlyContinue |
  Where-Object { $_.TaskName -match $pattern -or $_.TaskPath -match $pattern } |
  Select-Object @{N='name';E={$_.TaskName}}, @{N='path';E={$_.TaskPath}} |
  ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items };
}

/** Services the program registered, reported and never removed.
 *
 * A service is removed with `sc delete` and administrator rights, and
 * deleting the wrong one can stop Windows booting; Prune lists what it
 * found so the person can look, and does not offer to take it away. Anything
 * running out of the Windows folder is dropped here, whatever it is called. */
async function scanServices(name, publisher, tokens) {
  const base = buildSearchPattern(name, publisher);
  if (base === null) return { ok: true, items: [] };
  const extra = buildTokenPattern(tokens);
  const pattern = extra ? `${base}|${extra}` : base;
  const script = `
$pattern = '${psQuote(pattern)}'
$windows = [string]$env:SystemRoot
Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue |
  Where-Object { ($_.Name -match $pattern -or $_.DisplayName -match $pattern -or $_.PathName -match $pattern) -and -not ([string]$_.PathName).Trim('"').StartsWith($windows, [System.StringComparison]::OrdinalIgnoreCase) } |
  Select-Object @{N='name';E={$_.Name}}, @{N='displayName';E={$_.DisplayName}}, @{N='pathName';E={$_.PathName}} |
  ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items };
}
