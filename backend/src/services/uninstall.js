import { spawn } from 'node:child_process';
import { resolveSilentCommand } from './silentUninstall.js';
import { runPowerShellJson } from './powershell.js';

/** Grants whichever process next calls SetForegroundWindow (ASFW_ANY = -1)
 * the right to actually succeed.
 *
 * Without this, a real GUI window spawned by a background Node process
 * (this backend) gets a genuine window handle but Windows' own
 * focus-stealing prevention refuses to bring it to the front -- it sits
 * behind Prune's own window, unclicked, indistinguishable from nothing
 * having happened at all. Confirmed empirically on this project's own
 * dev machine, with the exact `cmd.exe /c <command>` + `windowsHide:true`
 * spawn shape below: a plain GUI app launched this way got a real window
 * handle immediately, but the foreground window stayed whatever already
 * had focus, until this call ran first -- after which the same spawn
 * correctly became the foreground window.
 *
 * Real-world trigger: reported directly as "the uninstaller doesn't
 * open" for VALORANT, whose uninstall is a real confirmation dialog
 * (via RiotClientServices.exe) that was genuinely spawning, just hidden
 * behind Prune's own window the whole time.
 *
 * Best-effort: if this fails for any reason, the uninstall still
 * proceeds exactly as it did before this existed -- this is a UX
 * improvement on top of an already-working mechanism, not something the
 * uninstall itself depends on. */
async function allowChildWindowToForeground() {
  try {
    await runPowerShellJson(`
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class PruneForeground { [DllImport("user32.dll")] public static extern bool AllowSetForegroundWindow(int dwProcessId); }
"@
[PruneForeground]::AllowSetForegroundWindow(-1) | Out-Null
`);
  } catch {
    // Best-effort -- see doc comment above.
  }
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
  await allowChildWindowToForeground();
  return new Promise((resolve, reject) => {
    const command = resolveSilentCommand({ uninstallString, quietUninstallString });
    onEvent('running', { command });

    // cmd.exe /c: an UninstallString is a raw shell command line (e.g.
    // `MsiExec.exe /X{GUID} /qn` or `"C:\...\uninst.exe" /S`), not a
    // single executable + argv array — cmd.exe is what correctly splits
    // quoted paths and flags the way the registry entry expects.
    const child = spawn('cmd.exe', ['/c', command], { windowsHide: true });
    let stderr = '';
    child.stderr?.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', (err) => reject(new Error(`Failed to launch uninstaller: ${err.message}`)));
    child.on('exit', (code) => {
      onEvent('exited', { code, stderr: stderr.trim() || null });
      resolve({ code });
    });
  });
}
