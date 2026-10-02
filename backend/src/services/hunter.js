import { execFile } from 'node:child_process';
import { parseHunterOutput, matchHunted, endProcessRefusal } from './hunterMatch.js';

/** Hunter mode: click any window and Prune names the program.
 *
 * A time-limited PowerShell script (about 30 seconds, cancellable) does the
 * pointing. It minimises Prune's own window so the person can see what they
 * want to click, covers every screen with a nearly invisible topmost form
 * that SWALLOWS the click -- the window underneath never receives it, so
 * hunting for a program cannot press that program's buttons -- and on the
 * button release reads the cursor (GetCursorPos), finds the window under it
 * (WindowFromPoint), climbs to its top-level window (GetAncestor), and reads
 * its process (GetWindowThreadProcessId). Esc cancels
 * (GetAsyncKeyState). Prune's window is restored whatever happens.
 *
 * It reports a process id and executable path; deciding which installed
 * program that is belongs to hunterMatch.js. Limits, stated: a Store app's
 * window belongs to ApplicationFrameHost, so it names that host, and an
 * elevated window cannot be inspected from a standard-rights process. */

export const HUNT_SECONDS = 30;

const int = (value, fallback) => (Number.isInteger(value) && value >= 0 ? value : fallback);

export function buildHunterScript({ timeoutSec = HUNT_SECONDS, selfPids = [] } = {}) {
  const seconds = Math.min(120, Math.max(1, int(timeoutSec, HUNT_SECONDS)));
  const pids = selfPids.filter((pid) => Number.isInteger(pid) && pid > 4);
  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PruneHunter {
  [StructLayout(LayoutKind.Sequential)] public struct POINT { public int X; public int Y; }
  [DllImport("user32.dll")] public static extern bool GetCursorPos(out POINT point);
  [DllImport("user32.dll")] public static extern IntPtr WindowFromPoint(POINT point);
  [DllImport("user32.dll")] public static extern IntPtr GetAncestor(IntPtr window, uint flags);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr window, int command);
}
"@

$state = @{ done = $false; status = 'timeout'; x = 0; y = 0; down = $false }
$deadline = (Get-Date).AddSeconds(${seconds})
$minimized = New-Object System.Collections.ArrayList
foreach ($id in @(${pids.join(',')})) {
  $p = Get-Process -Id $id -ErrorAction SilentlyContinue
  if ($p -and $p.MainWindowHandle -ne [IntPtr]::Zero) {
    [void][PruneHunter]::ShowWindow($p.MainWindowHandle, 6)
    [void]$minimized.Add($p.MainWindowHandle)
  }
}
try {
  Start-Sleep -Milliseconds 400
  $form = New-Object System.Windows.Forms.Form
  $form.FormBorderStyle = 'None'
  $form.StartPosition = 'Manual'
  $form.Bounds = [System.Windows.Forms.SystemInformation]::VirtualScreen
  $form.TopMost = $true
  $form.ShowInTaskbar = $false
  $form.Opacity = 0.01
  $form.Cursor = [System.Windows.Forms.Cursors]::Cross
  $form.Add_Shown({ $form.Activate() }.GetNewClosure())
  # A click that began before the overlay appeared must not count: only a
  # press that lands on the overlay, then its release, picks a window.
  $form.Add_MouseDown({ $state.down = $true }.GetNewClosure())
  $form.Add_MouseUp({
    if (-not $state.down) { return }
    $point = New-Object PruneHunter+POINT
    [void][PruneHunter]::GetCursorPos([ref]$point)
    $state.x = $point.X; $state.y = $point.Y
    $state.status = 'picked'; $state.done = $true
    $form.Close()
  }.GetNewClosure())
  $timer = New-Object System.Windows.Forms.Timer
  $timer.Interval = 100
  $timer.Add_Tick({
    if (([PruneHunter]::GetAsyncKeyState(0x1B) -band 0x8000) -ne 0) { $state.status = 'cancelled'; $state.done = $true; $form.Close() }
    elseif ((Get-Date) -gt $deadline) { $state.status = 'timeout'; $state.done = $true; $form.Close() }
  }.GetNewClosure())
  $timer.Start()
  [void]$form.ShowDialog()
  $timer.Stop()
  $form.Dispose()
} finally {
  foreach ($handle in $minimized) { [void][PruneHunter]::ShowWindow($handle, 9) }
}

if ($state.status -ne 'picked') { [pscustomobject]@{ status = $state.status } | ConvertTo-Json -Compress; exit 0 }

Start-Sleep -Milliseconds 120
$point = New-Object PruneHunter+POINT
$point.X = $state.x; $point.Y = $state.y
$window = [PruneHunter]::WindowFromPoint($point)
if ($window -eq [IntPtr]::Zero) { [pscustomobject]@{ status = 'failed' } | ConvertTo-Json -Compress; exit 0 }
$root = [PruneHunter]::GetAncestor($window, 2)
if ($root -eq [IntPtr]::Zero) { $root = $window }
$processId = [uint32]0
[void][PruneHunter]::GetWindowThreadProcessId($root, [ref]$processId)
$info = Get-CimInstance -ClassName Win32_Process -Filter ("ProcessId = " + $processId) -ErrorAction SilentlyContinue
$proc = Get-Process -Id $processId -ErrorAction SilentlyContinue
[pscustomobject]@{
  status = 'picked'
  pid = [int]$processId
  exePath = $(if ($info) { [string]$info.ExecutablePath } else { $null })
  name = $(if ($info) { [string]$info.Name } else { $null })
  title = $(if ($proc) { [string]$proc.MainWindowTitle } else { '' })
} | ConvertTo-Json -Compress
`;
}

let active = null;

/** Runs one hunt and resolves its result: { status: 'picked' | 'cancelled' |
 * 'timeout' | 'failed', ... }. One at a time. `run` is injectable. */
export function startHunt({ run, timeoutSec = HUNT_SECONDS, selfPids = [process.pid, process.ppid] } = {}) {
  if (active) return Promise.reject(new Error('A hunt is already running.'));
  const runner = run || ((script) => new Promise((resolve, reject) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', script],
      { timeout: (timeoutSec + 15) * 1000, windowsHide: true, maxBuffer: 1024 * 1024 },
      (err, stdout) => {
        if (active?.child === child && active.cancelled) { resolve('{"status":"cancelled"}'); return; }
        if (err && !stdout) reject(new Error(`The hunt could not run: ${err.message}`)); else resolve(stdout);
      }
    );
    active.child = child;
  }));

  active = { child: null, cancelled: false };
  const finished = Promise.resolve()
    .then(() => runner(buildHunterScript({ timeoutSec, selfPids })))
    .then(parseHunterOutput)
    .finally(() => { active = null; });
  return finished;
}

/** Stops the running hunt; the pending startHunt then resolves cancelled. */
export function cancelHunt() {
  if (!active) return false;
  active.cancelled = true;
  active.child?.kill();
  return true;
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
