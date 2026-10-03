import { execFile } from 'node:child_process';
import { parseHunterOutput, matchHunted, endProcessRefusal } from './hunterMatch.js';

/** Hunter: drag the crosshair onto any window and Prune names the program.
 *
 * The pointing happens in Electron (electron/hunterWidget.cjs): a small
 * crosshair window the person drags and drops. When it is dropped, the main
 * process reads where the pointer is with Electron's own screen API, hides
 * the crosshair, and asks this service about that one point. The question is
 * answered by a short PowerShell script that does exactly three lookups for
 * fixed coordinates -- the window at the point (WindowFromPoint), its
 * top-level window (GetAncestor), and the process that owns it
 * (GetWindowThreadProcessId) -- then reads that process's executable path.
 *
 * What it deliberately does not do, because that is how a keylogger or a
 * click-stealer looks to antivirus (Microsoft Defender has already flagged an
 * earlier Prune build for browser-credential behaviour): it never polls, never
 * reads the keyboard or the pointer, never installs a hook and never draws an
 * overlay. backend/src/services/noKeyPolling.test.js keeps it that way.
 *
 * It reports a process id and executable path; deciding which installed
 * program that is belongs to hunterMatch.js. Limits, stated: a Store app's
 * window belongs to ApplicationFrameHost, so it names that host, and a window
 * of an elevated program may not be describable from a standard-rights
 * process ('unreadable'). */

/** Screen coordinates are 32-bit, but no desktop is larger than this; the
 * bound only stops nonsense, it does not describe a real monitor layout. */
export const COORD_LIMIT = 100000;

/** { x, y } when both are whole numbers within bounds, else null. */
export function validatePoint(point) {
  if (!point || typeof point !== 'object') return null;
  const { x, y } = point;
  const ok = (n) => Number.isInteger(n) && Math.abs(n) <= COORD_LIMIT;
  return ok(x) && ok(y) ? { x, y } : null;
}

/** The script for one point. The coordinates are validated integers written
 * into the text, never anything the caller supplied as a string. */
export function buildPointScript(point) {
  const checked = validatePoint(point);
  if (!checked) throw new Error('A point needs whole-number x and y coordinates.');
  return `
$ErrorActionPreference = 'Stop'
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class PruneHunter {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] public static extern int GetClassName(IntPtr window, StringBuilder name, int max);
  [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
  public static string ClassOf(IntPtr window) { var name = new StringBuilder(256); GetClassName(window, name, 256); return name.ToString(); }
}
"@

# The coordinates arrive in physical pixels. Without this a scaled display would
# read them as logical ones and land on the wrong window. Awareness only: it
# changes how the point is read, nothing else.
try { [void][PruneHunter]::SetThreadDpiAwarenessContext([IntPtr](-4)) } catch { }

$point = New-Object PruneHunter+POINT
$point.X = ${checked.x}
$point.Y = ${checked.y}
$window = [PruneHunter]::WindowFromPoint($point)
if ($window -eq [IntPtr]::Zero) { [pscustomobject]@{ status = 'nothing' } | ConvertTo-Json -Compress; exit 0 }
$root = [PruneHunter]::GetAncestor($window, 2)
if ($root -eq [IntPtr]::Zero) { $root = $window }

# The desktop and the taskbar belong to Explorer, which would answer "Windows".
# They are not a program the person meant.
$class = [PruneHunter]::ClassOf($root)
if (@('Progman', 'WorkerW', 'Shell_TrayWnd', 'Shell_SecondaryTrayWnd') -contains $class) {
  [pscustomobject]@{ status = 'nothing' } | ConvertTo-Json -Compress; exit 0
}

$processId = [uint32]0
[void][PruneHunter]::GetWindowThreadProcessId($root, [ref]$processId)
$info = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + $processId) -ErrorAction SilentlyContinue
$path = $(if ($info) { [string]$info.ExecutablePath } else { '' })
if (-not $path) {
  [pscustomobject]@{ status = 'unreadable'; pid = [int]$processId; name = $(if ($info) { [string]$info.Name } else { $null }) } | ConvertTo-Json -Compress
  exit 0
}
$proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
[pscustomobject]@{
  status = 'picked'
  pid = [int]$processId
  exePath = $path
  name = [string]$info.Name
  title = $(if ($proc) { [string]$proc.MainWindowTitle } else { '' })
} | ConvertTo-Json -Compress
`;
}

function defaultRun(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', script],
      { timeout: 30_000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout) => (err && !stdout ? reject(new Error(`The lookup could not run: ${err.message}`)) : resolve(stdout))
    );
  });
}

/** What is at this screen point: { status: 'picked' | 'nothing' | 'unreadable'
 * | 'failed', ... }. A bad point is rejected (the route answers 400 first);
 * a lookup that could not run is a 'failed' result with the reason. */
export async function huntAtPoint(point, { run = defaultRun } = {}) {
  const script = buildPointScript(point);
  let output;
  try {
    output = await run(script);
  } catch (err) {
    return { status: 'failed', error: err.message };
  }
  return parseHunterOutput(output);
}

/** Resolves a result to what the screen shows: the process, the installed
 * program it belongs to, the startup entries that launch it, and whether it
 * can be ended. */
export function describeHunt(result, context) {
  if (result.status !== 'picked') return result;
  const matched = matchHunted(result, context);
  return {
    ...result,
    program: matched.program,
    startupItems: matched.startupItems,
    endRefusal: endProcessRefusal(result)
  };
}

/** Ends one process the Hunter named. The pid alone is not trusted: it is
 * looked up again and must still be running the same executable, because a
 * pid is reused the moment its process exits. */
export async function endHuntedProcess({ pid, exePath }, { lookup, kill, self } = {}) {
  const refusal = endProcessRefusal({ pid, exePath }, self ? { self } : undefined);
  if (refusal) return { ok: false, error: refusal };

  const currentPath = await (lookup || defaultLookup)(pid);
  if (!currentPath) return { ok: false, error: 'That process is no longer running.' };
  if (currentPath.toLowerCase() !== String(exePath).toLowerCase()) {
    return { ok: false, error: 'That process is no longer the same program.' };
  }
  try {
    await (kill || defaultKill)(pid);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: `Windows would not end it: ${err.message}` };
  }
}

function defaultLookup(pid) {
  return new Promise((resolve) => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
      `$p = Get-CimInstance Win32_Process -Filter "ProcessId = ${Number(pid)}"; if ($p) { [Console]::Out.Write($p.ExecutablePath) }`],
    { windowsHide: true, timeout: 15000 }, (err, stdout) => resolve(err ? null : stdout.trim() || null));
  });
}

function defaultKill(pid) {
  return new Promise((resolve, reject) => {
    // /T ends the program's own child processes too; /F because a program
    // that is asked politely and refuses is what the person is hunting.
    execFile('taskkill.exe', ['/PID', String(Number(pid)), '/T', '/F'], { windowsHide: true, timeout: 15000 },
      (err, _stdout, stderr) => (err ? reject(new Error(String(stderr || err.message).trim())) : resolve()));
  });
}
