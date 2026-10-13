import { spawn } from 'node:child_process';
import { resolveSilentCommand } from './silentUninstall.js';
import { runPowerShellText } from './powershell.js';

/** Finds the uninstaller's own window, wherever it ends up, and forces it
 * to the foreground -- repeatedly, for a few seconds after it starts.
 *
 * The first version of this granted AllowSetForegroundWindow(-1) once,
 * before the child was even spawned, on the theory that a Node process in
 * the background can't otherwise steal focus for a GUI window it starts
 * (confirmed true, and still true here -- see VALORANT below). What that
 * version got wrong: the grant is SINGLE-USE and goes to whichever
 * process calls SetForegroundWindow NEXT, not necessarily the
 * uninstaller. Reported live for SQLiteStudio: its real wizard genuinely
 * opened, just behind Prune's window -- the one-shot grant handed out
 * before the process even existed had nowhere reliable to land, and lost
 * the race to something else on the system calling SetForegroundWindow
 * in the gap. A self-relaunching uninstaller (copies itself to a temp
 * path and restarts there, common enough that this is written for it on
 * purpose) makes the race worse still: the window that finally appears
 * belongs to a DIFFERENT PID than the one Node spawned.
 *
 * So this no longer grants once and hopes. It polls -- walking the
 * spawned process's current descendants fresh on every pass, since a
 * relaunch can add a new one mid-poll -- for a visible, titled top-level
 * window owned by any PID in that tree, and when it finds one, grants the
 * allowance and calls SetForegroundWindow on that EXACT window in the
 * same PowerShell round trip, closing the gap the old version left open.
 * Gives up after `timeoutMs`, or the moment the whole process tree is
 * gone, whichever is first.
 *
 * Real-world trigger kept from the original: "the uninstaller doesn't
 * open" for VALORANT, whose uninstall is a real confirmation dialog (via
 * RiotClientServices.exe) that was genuinely spawning, just hidden behind
 * Prune's own window the whole time.
 *
 * Fire-and-forget: started right after spawn, never awaited by the
 * caller. Best-effort in the same sense the original was -- if this
 * fails or never finds a window (a silent installer that never shows one
 * at all, say), the uninstall proceeds exactly as it would without it. */
function bringUninstallerToForeground(rootPid, { timeoutMs = 10000 } = {}) {
  const script = `
Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class PruneFg {
  [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);
  public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);
}
"@

$rootPid = ${rootPid}
$deadline = (Get-Date).AddMilliseconds(${timeoutMs})

while ((Get-Date) -lt $deadline) {
  $all = Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Select-Object ProcessId, ParentProcessId
  $byParent = @{}
  foreach ($p in $all) {
    $pp = [int]$p.ParentProcessId
    if (-not $byParent.ContainsKey($pp)) { $byParent[$pp] = New-Object System.Collections.Generic.List[int] }
    $byParent[$pp].Add([int]$p.ProcessId)
  }
  $descendants = New-Object System.Collections.Generic.HashSet[int]
  $frontier = New-Object System.Collections.Generic.Queue[int]
  [void]$descendants.Add($rootPid)
  $frontier.Enqueue($rootPid)
  while ($frontier.Count -gt 0) {
    $cur = $frontier.Dequeue()
    if ($byParent.ContainsKey($cur)) {
      foreach ($child in $byParent[$cur]) { if ($descendants.Add($child)) { $frontier.Enqueue($child) } }
    }
  }
  if (-not ($all | Where-Object { $descendants.Contains([int]$_.ProcessId) })) { break }

  $windows = New-Object System.Collections.Generic.List[IntPtr]
  [PruneFg]::EnumWindows({ param($hWnd, $lParam) $windows.Add($hWnd); return $true }, [IntPtr]::Zero) | Out-Null

  $target = [IntPtr]::Zero
  foreach ($hWnd in $windows) {
    if (-not [PruneFg]::IsWindowVisible($hWnd)) { continue }
    if ([PruneFg]::GetWindowTextLength($hWnd) -eq 0) { continue }
    [uint32]$owner = 0
    [PruneFg]::GetWindowThreadProcessId($hWnd, [ref]$owner) | Out-Null
    if ($descendants.Contains([int]$owner)) { $target = $hWnd; break }
  }

  if ($target -ne [IntPtr]::Zero) {
    [PruneFg]::AllowSetForegroundWindow(-1) | Out-Null
    [PruneFg]::ShowWindow($target, 9) | Out-Null
    [PruneFg]::SetForegroundWindow($target) | Out-Null
    break
  }

  Start-Sleep -Milliseconds 400
}
`;
  return runPowerShellText(script, { timeoutMs: timeoutMs + 5000, retries: 0 }).catch(() => {
    // Best-effort -- see doc comment above.
  });
}

/** Runs a program's registered uninstaller. `onEvent('running'|'exited', {...})`
 * fires 'running' once with the resolved command before running it (so the
 * UI can show it live), then 'exited' with the code. The exit code is
 * surfaced but never used to gate whether the leftover scan runs
 * afterward — see routes/uninstall.js — uninstallers routinely report
 * success when they weren't, and vice versa.
 *
 * Takes the program rather than a bare string because making an uninstall
 * silent needs two registry values, not one: UninstallString and the
 * QuietUninstallString the vendor may have published beside it. See
 * services/silentUninstall.js for which wins and why. */
export async function runUninstaller({ uninstallString, quietUninstallString } = {}, onEvent) {
  if (!uninstallString) {
    throw new Error('This program has no registered uninstall command.');
  }
  return new Promise((resolve, reject) => {
    const command = resolveSilentCommand({ uninstallString, quietUninstallString });
    onEvent('running', { command });

    // cmd.exe /c: an UninstallString is a raw shell command line (e.g.
    // `MsiExec.exe /X{GUID} /qn` or `"C:\...\uninst.exe" /S`), not a
    // single executable + argv array — cmd.exe is what correctly splits
    // quoted paths and flags the way the registry entry expects.
    //
    // Verbatim arguments, wrapped in one extra pair of quotes, with /s:
    // handed the command as an ordinary argv element, Node escapes every
    // embedded quote as \" -- which cmd.exe does not understand -- so any
    // command that is a quoted path containing a space (every Program
    // Files uninstaller, and Riot's `"C:\Riot Games\Riot Client\...exe"`)
    // died with "not recognized" and exit 1 before starting anything. /s
    // makes cmd strip exactly the outer pair we add and leave the rest
    // untouched; /d skips AutoRun so a user's registry hook cannot run.
    const child = spawn('cmd.exe', ['/d', '/s', '/c', `"${command}"`], {
      windowsHide: true,
      windowsVerbatimArguments: true
    });
    // Started, not awaited: the window this is hunting for may not exist
    // for the first second or two (a self-extracting installer's real UI
    // can take a moment to appear), and the uninstall itself must not wait
    // on it -- a silent uninstaller that never shows a window at all would
    // otherwise sit here for the full timeout before 'running' even fires.
    if (child.pid) bringUninstallerToForeground(child.pid);
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => reject(new Error(`Failed to launch uninstaller: ${err.message}`)));
    child.on('exit', (code) => {
      onEvent('exited', { code, stderr: stderr.trim() || null });
      resolve({ code });
    });
  });
}
