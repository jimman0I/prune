import { runPowerShellJson } from './powershell.js';

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

/** Heuristic leftover scan: files/folders and registry keys whose name
 * matches the program's name or publisher, plus scheduled tasks the
 * program registered. NOT a full before/after system snapshot — that's
 * Hunter mode (Phase B), deliberately deferred. Each of the three checks
 * runs independently so one failing (e.g. a locked directory) doesn't
 * take the other two down. */
export async function scanForLeftovers({ name, publisher }) {
  const [files, registryKeys, scheduledTasks] = await Promise.all([
    scanFiles(name, publisher).catch(() => ({ ok: false, items: [] })),
    scanRegistry(name, publisher).catch(() => ({ ok: false, items: [] })),
    scanScheduledTasks(name).catch(() => ({ ok: false, items: [] }))
  ]);
  return { files, registryKeys, scheduledTasks };
}

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function scanFiles(name, publisher) {
  const terms = [name, publisher].filter(Boolean).map(escapeForRegex);
  if (terms.length === 0) return { ok: true, items: [] };
  const pattern = terms.join('|');
  const script = `
$roots = ${buildRootsExpression()} | Where-Object { $_ -and (Test-Path $_) }
$pattern = '${pattern}'
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

async function scanRegistry(name, publisher) {
  const terms = [name, publisher].filter(Boolean).map(escapeForRegex);
  if (terms.length === 0) return { ok: true, items: [] };
  const pattern = terms.join('|');
  const script = `
$pattern = '${pattern}'
$roots = @('HKCU:\\Software', 'HKLM:\\Software')
$roots | ForEach-Object {
  Get-ChildItem -Path $_ -ErrorAction SilentlyContinue |
    Where-Object { $_.PSChildName -match $pattern }
} | Select-Object @{N='path';E={$_.Name}} | ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items: items.map(i => ({ path: i.path })) };
}

async function scanScheduledTasks(name) {
  if (!name) return { ok: true, items: [] };
  const pattern = escapeForRegex(name);
  const script = `
$pattern = '${pattern}'
Get-ScheduledTask -ErrorAction SilentlyContinue |
  Where-Object { $_.TaskName -match $pattern -or $_.TaskPath -match $pattern } |
  Select-Object @{N='name';E={$_.TaskName}}, @{N='path';E={$_.TaskPath}} |
  ConvertTo-Json -Compress
`;
  const raw = await runPowerShellJson(script);
  const items = raw ? (Array.isArray(raw) ? raw : [raw]) : [];
  return { ok: true, items };
}