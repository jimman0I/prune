import { existsSync } from 'node:fs';
import { runPowerShellJson } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';
import { parseUninstallerPath } from './uninstallerPath.js';
import { expandPath } from '../lib/cleanerRules.js';
import { revealPath } from './revealPath.js';

/** The startup screen's per-entry commands beyond the switch and Remove:
 * open where the entry lives, open its program's folder, run it or end it,
 * and add a new entry.
 *
 * Every command acts on an entry the route has just re-read from the real
 * startup locations by id (see routes/programs.js), never on a path or key
 * the client supplied -- the same guarantee the switch gives. Each is split
 * into a pure plan, which is what the tests check, and the step that acts
 * on it. Every value reaches PowerShell as a single-quoted literal. */

function psLiteral(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

const HIVES = { HKCU: 'HKEY_CURRENT_USER', HKLM: 'HKEY_LOCAL_MACHINE' };

/** "HKCU:\SOFTWARE\..." as Registry Editor's address bar writes it, or null. */
export function regeditPath(key) {
  const match = /^(HKCU|HKLM):\\(.+)$/i.exec(String(key || ''));
  if (!match) return null;
  return `Computer\\${HIVES[match[1].toUpperCase()]}\\${match[2]}`;
}

/** Where "Open location" goes for this entry. */
export function locationPlan(item) {
  if (item?.source === 'task') return { kind: 'open', target: 'taskschd.msc' };
  if (item?.source === 'service') return { kind: 'open', target: 'services.msc' };
  if (item?.source === 'appx') return { kind: 'open', target: 'ms-settings:startupapps' };
  if (item?.source === 'folder' || item?.isShortcut) return { kind: 'reveal', path: item.executable || item.command };
  const key = regeditPath(item?.registryKey);
  return key ? { kind: 'regedit', key } : null;
}

/** The arguments after the executable in a command line. */
function argumentsOf(command) {
  const trimmed = String(command || '').trim();
  if (trimmed.startsWith('"')) {
    const closing = trimmed.indexOf('"', 1);
    return closing === -1 ? '' : trimmed.slice(closing + 1).trim();
  }
  const { executable } = parseUninstallerPath(trimmed);
  return executable ? trimmed.slice(executable.length).trim() : '';
}

/** What "Run" or "End" does for this entry, or null when it has nothing to act on. */
export function processPlan(item, action) {
  if (action !== 'run' && action !== 'end') return null;
  if (item?.source === 'task' && item.key) return { kind: 'task', key: item.key, action };
  if (item?.source === 'service' && item.key) return { kind: 'service', key: item.key, action, elevated: true };
  if (item?.source !== 'registry' && item?.source !== 'folder') return null;
  if (item.exists === false || !item.executable) return null;
  if (action === 'end') return { kind: 'stop', executable: item.executable };
  // A Startup-folder shortcut is run as the shortcut, which carries its own
  // arguments and working folder; a Run value as its own command line.
  return item.isShortcut
    ? { kind: 'start', file: item.executable, args: '' }
    : { kind: 'start', file: item.executable, args: argumentsOf(item.command) };
}

function taskWhere(key) {
  const cut = key.lastIndexOf('\\');
  return `-TaskPath ${psLiteral(key.slice(0, cut + 1) || '\\')} -TaskName ${psLiteral(key.slice(cut + 1))}`;
}

function processScript(plan) {
  switch (plan.kind) {
    case 'start':
      return plan.args
        ? `Start-Process -FilePath ${psLiteral(plan.file)} -ArgumentList ${psLiteral(plan.args)}\nConvertTo-Json @{ done = $true }`
        : `Start-Process -FilePath ${psLiteral(plan.file)}\nConvertTo-Json @{ done = $true }`;
    case 'stop':
      // By the executable's full path, so ending "Update.exe" here never ends
      // some other program's Update.exe.
      return `$p = @(Get-Process | Where-Object { $_.Path -and $_.Path -ieq ${psLiteral(plan.executable)} })
$p | Stop-Process -Force
ConvertTo-Json @{ done = $true; count = $p.Count }`;
    case 'task':
      return `${plan.action === 'run' ? 'Start-ScheduledTask' : 'Stop-ScheduledTask'} ${taskWhere(plan.key)}\nConvertTo-Json @{ done = $true }`;
    case 'service':
      return `${plan.action === 'run' ? 'Start-Service' : 'Stop-Service -Force'} -Name ${psLiteral(plan.key)}\nConvertTo-Json @{ done = $true }`;
    default:
      return null;
  }
}

export async function runStartupProcess(item, action, { run = runPowerShellJson, runElevated = runElevatedPowerShellJson } = {}) {
  const plan = processPlan(item, action);
  if (!plan) return { ok: false, error: 'There is nothing to run or end for this entry.' };
  const script = `$ErrorActionPreference = 'Stop'\n${processScript(plan)}`;
  if (plan.elevated) {
    const result = await runElevated(script, { timeoutMs: 60000 });
    return result.ok ? { ok: true } : result;
  }
  try {
    const data = await run(script, { timeoutMs: 20000 });
    return { ok: true, ...(typeof data?.count === 'number' ? { ended: data.count } : {}) };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

export async function openStartupLocation(item, { run = runPowerShellJson, reveal = revealPath } = {}) {
  const plan = locationPlan(item);
  if (!plan) return { ok: false, error: 'Windows gives this entry no location to open.' };
  if (plan.kind === 'reveal') return reveal(plan.path);
  if (plan.kind === 'open') {
    await run(`Start-Process ${psLiteral(plan.target)}\nConvertTo-Json @{ done = $true }`);
    return { ok: true };
  }
  // Registry Editor reopens at the key it last showed, kept in LastKey.
  // Start-Process goes through ShellExecute, so its own consent prompt
  // appears exactly as it does when it is started from the Start menu.
  await run(`New-Item -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\Regedit' -Force | Out-Null
Set-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Applets\\Regedit' -Name LastKey -Value ${psLiteral(plan.key)}
Start-Process regedit.exe
ConvertTo-Json @{ done = $true }`);
  return { ok: true };
}

/** The folder the entry's program lives in, opened with the program
 * selected. A Startup-folder shortcut is followed to what it points at. */
export async function openContainingFolder(item, { run = runPowerShellJson, reveal = revealPath } = {}) {
  let target = item?.executable;
  if (item?.isShortcut && target) {
    const data = await run(`$l = (New-Object -ComObject WScript.Shell).CreateShortcut(${psLiteral(target)})
ConvertTo-Json @{ target = [string]$l.TargetPath }`).catch(() => null);
    if (data?.target) target = data.target;
  }
  if (!target) return { ok: false, error: 'This entry does not name a program on disk.' };
  return reveal(target);
}

/* ------------------------------------------------------------ new entries */

const KINDS = ['run', 'runonce', 'folder'];
const SCOPES = ['user', 'machine'];

/** Why this entry cannot be added, or null. */
export function validateNewEntry({ name, command, scope, kind } = {}) {
  const cleanName = String(name || '').trim();
  if (!cleanName) return 'Give the entry a name.';
  if (/[\\/:*?"<>|]/.test(cleanName)) return 'A name cannot contain \\ / : * ? " < > or |.';
  if (!SCOPES.includes(scope)) return 'Choose whether it starts for this user or for all users.';
  if (!KINDS.includes(kind)) return 'Choose how it starts: every sign-in, next sign-in only, or from the Startup folder.';
  const { executable } = parseUninstallerPath(String(command || ''));
  if (!executable) return 'Give the program to start.';
  const expanded = expandPath(executable);
  if (!/^[a-z]:[\\/]/i.test(expanded) || !existsSync(expanded)) return `No file was found at ${executable}.`;
  return null;
}

export function buildAddEntryScript({ name, command, scope, kind }) {
  const cleanName = String(name).trim();
  if (kind === 'folder') {
    const folder = scope === 'machine'
      ? '(Join-Path $env:ProgramData \'Microsoft\\Windows\\Start Menu\\Programs\\StartUp\')'
      : '(Join-Path $env:APPDATA \'Microsoft\\Windows\\Start Menu\\Programs\\Startup\')';
    const { executable } = parseUninstallerPath(command);
    return `$ErrorActionPreference = 'Stop'
$path = Join-Path ${folder} (${psLiteral(cleanName)} + '.lnk')
if (Test-Path -LiteralPath $path) { ConvertTo-Json @{ added = $false; reason = 'exists' }; exit }
$link = (New-Object -ComObject WScript.Shell).CreateShortcut($path)
$link.TargetPath = ${psLiteral(executable)}
$link.Arguments = ${psLiteral(argumentsOf(command))}
$link.WorkingDirectory = Split-Path -Parent ${psLiteral(executable)}
$link.Save()
ConvertTo-Json @{ added = $true }`;
  }
  const hive = scope === 'machine' ? 'HKLM' : 'HKCU';
  const key = `${hive}:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\${kind === 'runonce' ? 'RunOnce' : 'Run'}`;
  return `$ErrorActionPreference = 'Stop'
$key = ${psLiteral(key)}
$name = ${psLiteral(cleanName)}
if (-not (Test-Path -LiteralPath $key)) { New-Item -Path $key -Force | Out-Null }
# An entry that is already there is never overwritten -- its name is already taken.
$existing = Get-ItemProperty -LiteralPath $key | ForEach-Object { $_.PSObject.Properties } | Where-Object { $_.Name -eq $name }
if ($existing) { ConvertTo-Json @{ added = $false; reason = 'exists' }; exit }
New-ItemProperty -LiteralPath $key -Name $name -Value ${psLiteral(String(command).trim())} -PropertyType String | Out-Null
ConvertTo-Json @{ added = $true }`;
}

export async function addStartupEntry(entry, { run = runPowerShellJson, runElevated = runElevatedPowerShellJson } = {}) {
  const problem = validateNewEntry(entry);
  if (problem) return { ok: false, error: problem };
  const script = buildAddEntryScript(entry);
  let data;
  if (entry.scope === 'machine') {
    const result = await runElevated(script, { timeoutMs: 60000 });
    if (!result.ok) return result;
    data = result.data;
  } else {
    try {
      data = await run(script, { timeoutMs: 15000 });
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
  if (data?.added) return { ok: true };
  if (data?.reason === 'exists') return { ok: false, error: 'An entry with that name is already there. Choose another name.' };
  return { ok: false, error: 'The entry could not be added.' };
}
