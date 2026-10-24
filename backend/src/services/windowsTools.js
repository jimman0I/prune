import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { win32 } from 'node:path';
import { windowsPowerShellEnv } from './powershell.js';
import { runElevatedPowerShellJson } from '../lib/elevated.js';

/** Windows' own tools, one click away: System Restore, Services, Event
 * Viewer, the repair commands and the rest of what a person otherwise digs
 * out of the Start menu, Control Panel or a Run box.
 *
 * The whole list is FIXED, here, and is the only thing that can run. The
 * window sends an id and nothing else -- no path, no argument, no command
 * text -- and an id that is not in this list is refused before anything
 * starts. Every executable is named by its full path under System32, never
 * looked up on PATH, so a planted "services.msc" in some other folder can
 * never be the one that opens.
 *
 * Four ways to start one:
 *   open    -- the file is opened through the shell, as a double-click
 *              would: Start-Process, which is ShellExecute. That matters:
 *              .msc and .cpl files are documents, not programs, and several
 *              of these (System Restore, System Properties, Disk
 *              Management) ask Windows for elevation in their manifest,
 *              which CreateProcess -- what node's spawn uses -- refuses with
 *              "elevation required" instead of showing the prompt.
 *   console -- an elevated Command Prompt that stays open (cmd /k) running
 *              one fixed command: System File Checker, DISM, Check Disk.
 *              Start-Process -Verb RunAs, so Windows' own UAC dialog asks
 *              first, every time; declining it is an ordinary answer.
 *   uri     -- Windows Security, which is a Store app reached through its
 *              own registered "windowsdefender:" protocol. Only offered when
 *              that protocol is registered, so the shell is never asked to
 *              find a handler for a scheme nothing claims.
 *   capture -- Flush DNS: ipconfig /flushdns run hidden, its result handed
 *              back so the window can say what happened. Nothing to look at
 *              but the outcome, so no console is left open. Where Windows
 *              refuses it without administrator, it is run once more
 *              elevated (lib/elevated.js), behind one UAC dialog.
 *
 * Nothing here starts a browser, and nothing can: none of these names a web
 * address, and the one protocol it opens is checked to be registered first
 * (see backend/src/services/noBrowserLaunch.test.js for why that matters).
 *
 * Only tools whose files exist on this PC are listed: Group Policy
 * (gpedit.msc) is absent from Home editions, and a button that opens
 * nothing is worse than no button. */

/** The groups, in the order the window shows them. */
export const TOOL_GROUPS = ['repair', 'diagnose', 'manage', 'programs', 'network', 'access'];

/** id -> what runs. `requires` lists the System32 files that must exist for
 * the tool to be offered (defaults to `file`). Frozen: nothing may add to it
 * at run time. */
export const WINDOWS_TOOLS = Object.freeze([
  { id: 'systemRestore', group: 'repair', launch: 'open', file: 'rstrui.exe' },
  { id: 'sfc', group: 'repair', launch: 'console', file: 'cmd.exe', command: 'sfc /scannow', requires: ['cmd.exe', 'sfc.exe'] },
  { id: 'dism', group: 'repair', launch: 'console', file: 'cmd.exe', command: 'DISM /Online /Cleanup-Image /RestoreHealth', requires: ['cmd.exe', 'Dism.exe'] },
  // A read-only check of the Windows drive: no /f, so nothing is repaired
  // and nothing is scheduled for the next restart without being asked.
  { id: 'chkdsk', group: 'repair', launch: 'console', file: 'cmd.exe', command: 'chkdsk %SystemDrive%', requires: ['cmd.exe', 'chkdsk.exe'] },
  { id: 'diskCleanup', group: 'repair', launch: 'open', file: 'cleanmgr.exe' },

  { id: 'systemInformation', group: 'diagnose', launch: 'open', file: 'msinfo32.exe' },
  { id: 'eventViewer', group: 'diagnose', launch: 'open', file: 'eventvwr.msc' },
  { id: 'resourceMonitor', group: 'diagnose', launch: 'open', file: 'resmon.exe' },
  { id: 'directxDiagnostics', group: 'diagnose', launch: 'open', file: 'dxdiag.exe' },

  { id: 'systemProperties', group: 'manage', launch: 'open', file: 'SystemPropertiesAdvanced.exe' },
  { id: 'services', group: 'manage', launch: 'open', file: 'services.msc' },
  { id: 'taskScheduler', group: 'manage', launch: 'open', file: 'taskschd.msc' },
  { id: 'deviceManager', group: 'manage', launch: 'open', file: 'devmgmt.msc' },
  { id: 'diskManagement', group: 'manage', launch: 'open', file: 'diskmgmt.msc' },
  { id: 'sharedFolders', group: 'manage', launch: 'open', file: 'fsmgmt.msc' },
  { id: 'groupPolicy', group: 'manage', launch: 'open', file: 'gpedit.msc' },

  { id: 'programsAndFeatures', group: 'programs', launch: 'open', file: 'control.exe', args: 'appwiz.cpl', requires: ['control.exe', 'appwiz.cpl'] },
  { id: 'optionalFeatures', group: 'programs', launch: 'open', file: 'OptionalFeatures.exe' },

  { id: 'networkConnections', group: 'network', launch: 'open', file: 'control.exe', args: 'ncpa.cpl', requires: ['control.exe', 'ncpa.cpl'] },
  // Recent Windows 11 builds refuse /flushdns without administrator ("The
  // requested operation requires elevation"); older ones allow it. So it is
  // tried as is first, and only asks -- one UAC dialog -- when that fails.
  { id: 'flushDns', group: 'network', launch: 'capture', file: 'ipconfig.exe', args: '/flushdns', elevation: 'fallback' },

  { id: 'windowsSecurity', group: 'access', launch: 'uri', uri: 'windowsdefender:', protocol: 'windowsdefender', requires: [] },
  { id: 'onScreenKeyboard', group: 'access', launch: 'open', file: 'osk.exe' }
].map((tool) => Object.freeze(tool)));

const BY_ID = new Map(WINDOWS_TOOLS.map((tool) => [tool.id, tool]));

/** Whether `id` names a tool in the list. Exactly: a string, own entry. */
export function isKnownTool(id) {
  return typeof id === 'string' && BY_ID.has(id);
}

export function system32(env = process.env) {
  return win32.join(env.SystemRoot || env.windir || 'C:\\Windows', 'System32');
}

/** Whether a URL protocol is registered on this PC (HKCR\<name> exists).
 * reg.exe by full path, an argv array, no shell; the name only ever comes
 * from the fixed list above. */
export function protocolRegistered(name, { exec = execFile, systemDir = system32() } = {}) {
  return new Promise((resolve) => {
    exec(win32.join(systemDir, 'reg.exe'), ['query', `HKCR\\${name}`, '/ve'], { windowsHide: true, timeout: 10000 }, (error) => resolve(!error));
  });
}

let protocolCache = new Map();
/** For tests: forget what was learnt about protocols. */
export function resetToolCache() {
  protocolCache = new Map();
}

/** Whether `tool` can be offered here: every file it needs is in System32,
 * and a protocol it opens is registered. The protocol answer is kept for the
 * life of the process -- an installed Windows component does not come and go
 * while Prune is open, and the check is a process start. */
export async function toolAvailable(tool, { exists = existsSync, hasProtocol = protocolRegistered, systemDir = system32() } = {}) {
  const needs = tool.requires ?? [tool.file];
  if (!needs.every((name) => exists(win32.join(systemDir, name)))) return false;
  if (tool.protocol) {
    if (!protocolCache.has(tool.protocol)) protocolCache.set(tool.protocol, Promise.resolve(hasProtocol(tool.protocol)).catch(() => false));
    return protocolCache.get(tool.protocol);
  }
  return true;
}

/** What the window lists: the tools on this PC, in group order, each with
 * whether it may ask for administrator (`elevated`: the console ones, and
 * Flush DNS where Windows requires it). */
export async function listWindowsTools(options = {}) {
  const checked = await Promise.all(WINDOWS_TOOLS.map(async (tool) => ((await toolAvailable(tool, options)) ? tool : null)));
  return checked
    .filter(Boolean)
    .sort((a, b) => TOOL_GROUPS.indexOf(a.group) - TOOL_GROUPS.indexOf(b.group))
    .map((tool) => ({
      id: tool.id,
      group: tool.group,
      elevated: tool.launch === 'console' || tool.elevation === 'fallback',
      kind: tool.launch === 'capture' ? 'action' : 'window',
      // The command line itself, for the ones that are one, so the window can
      // show exactly what will run. Display only: the launch never reads it.
      ...(tool.launch === 'console' ? { command: tool.command } : {}),
      ...(tool.launch === 'capture' ? { command: `${tool.file.replace(/\.exe$/i, '')} ${tool.args}` } : {})
    }));
}

/** The Start-Process call for an id, as data: what the host script is
 * handed in environment variables. Pure, so the exact command line of every
 * tool is tested without starting any of them. */
export function launchPlan(id, { systemDir = system32() } = {}) {
  const tool = BY_ID.get(id);
  if (!tool || !isKnownTool(id)) return null;
  if (tool.launch === 'uri') return { launch: 'uri', file: tool.uri, args: '', verb: '' };
  if (tool.launch === 'console') {
    return { launch: 'console', file: win32.join(systemDir, 'cmd.exe'), args: `/k ${tool.command}`, verb: 'RunAs' };
  }
  return { launch: tool.launch, file: win32.join(systemDir, tool.file), args: tool.args ?? '', verb: '' };
}

/** Starts one thing through the shell and reports STARTED, CANCELLED (the
 * UAC dialog was declined: error 1223, found on the Win32Exception rather
 * than matched in a message Windows translates) or FAILED with the reason.
 * Every value arrives in an environment variable and is never part of the
 * script text. */
const HOST_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $start = @{ FilePath = $env:PRUNE_TOOL_FILE }
  if ($env:PRUNE_TOOL_ARGS) { $start.ArgumentList = $env:PRUNE_TOOL_ARGS }
  if ($env:PRUNE_TOOL_VERB) { $start.Verb = $env:PRUNE_TOOL_VERB }
  Start-Process @start
  [Console]::Out.WriteLine('STARTED')
} catch {
  $e = $_.Exception
  $code = $null
  while ($e) {
    if ($e -is [System.ComponentModel.Win32Exception]) { $code = $e.NativeErrorCode; break }
    $e = $e.InnerException
  }
  if ($code -eq 1223) { [Console]::Out.WriteLine('CANCELLED') }
  else { [Console]::Out.WriteLine('FAILED ' + $_.Exception.Message) }
}
`;

function startThroughShell(plan, { exec = execFile } = {}) {
  return new Promise((resolve) => {
    exec('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', HOST_SCRIPT], {
      windowsHide: true,
      // Long enough for a UAC dialog someone reads before answering: the
      // call only returns once it is answered.
      timeout: 5 * 60 * 1000,
      env: { ...windowsPowerShellEnv(), PRUNE_TOOL_FILE: plan.file, PRUNE_TOOL_ARGS: plan.args, PRUNE_TOOL_VERB: plan.verb }
    }, (error, stdout) => {
      const out = String(stdout ?? '');
      if (/^STARTED\s*$/m.test(out)) { resolve({ ok: true }); return; }
      if (/^CANCELLED\s*$/m.test(out)) { resolve({ ok: false, cancelled: true }); return; }
      const failed = /^FAILED (.*)$/m.exec(out);
      resolve({ ok: false, error: failed?.[1]?.trim() || error?.message || 'The tool did not start.' });
    });
  });
}

/** Flush DNS: run hidden, wait, report. ipconfig writes in the console's
 * codepage, so its words are only passed on when it failed; success is said
 * in Prune's own words by the window. */
function runDirect(plan, { exec = execFile } = {}) {
  return new Promise((resolve) => {
    exec(plan.file, plan.args.split(' ').filter(Boolean), { windowsHide: true, timeout: 30000 }, (error, stdout, stderr) => {
      if (!error) { resolve({ ok: true }); return; }
      const said = `${stdout ?? ''}\n${stderr ?? ''}`.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).join(' ');
      resolve({ ok: false, error: said || error.message });
    });
  });
}

/** The same command, elevated, for when the plain run was refused. Hidden,
 * like the plain one, and the exit code comes back through lib/elevated.js's
 * temp file. The path is built in the elevated process from its own
 * SystemRoot; nothing from here is written into the script. */
const ELEVATED_FLUSH = `& (Join-Path $env:SystemRoot 'System32\\ipconfig.exe') /flushdns | Out-Null
ConvertTo-Json -Compress -InputObject @{ code = $LASTEXITCODE }`;

async function runCaptured(plan, tool, { exec = execFile, elevate = runElevatedPowerShellJson } = {}) {
  const direct = await runDirect(plan, { exec });
  if (direct.ok || tool.elevation !== 'fallback') return direct;
  const elevated = await elevate(ELEVATED_FLUSH);
  if (elevated.cancelled) return { ok: false, cancelled: true };
  if (!elevated.ok) return { ok: false, error: elevated.error };
  return elevated.data?.code === 0 ? { ok: true } : direct;
}

/** Starts the tool `id` names. Never throws:
 *   { ok: true }                    started (or, for Flush DNS, done)
 *   { ok: false, cancelled: true }  the UAC dialog was declined
 *   { ok: false, unknown: true }    not an id in the list
 *   { ok: false, missing: true }    in the list, not on this PC
 *   { ok: false, error }            anything else */
export async function launchWindowsTool(id, { exec = execFile, elevate = runElevatedPowerShellJson, ...options } = {}) {
  if (!isKnownTool(id)) return { ok: false, unknown: true, error: 'Unknown tool.' };
  const tool = BY_ID.get(id);
  try {
    if (!(await toolAvailable(tool, options))) return { ok: false, missing: true, error: 'That tool is not on this PC.' };
    const plan = launchPlan(id, options);
    return plan.launch === 'capture' ? await runCaptured(plan, tool, { exec, elevate }) : await startThroughShell(plan, { exec });
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
