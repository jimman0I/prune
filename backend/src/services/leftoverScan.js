import { runPowerShellJson } from './powershell.js';

const SEARCH_ROOTS = [
  '$env:ProgramFiles', '${env:ProgramFiles(x86)}', '$env:APPDATA',
  '$env:LOCALAPPDATA', '$env:ProgramData', "$env:APPDATA\\Microsoft\\Windows\\Start Menu\\Programs"
];

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
  const roots = SEARCH_ROOTS.join(',');
  const script = `
$roots = @(${roots}) | Where-Object { $_ -and (Test-Path $_) }
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