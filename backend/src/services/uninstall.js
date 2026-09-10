import { spawn } from 'node:child_process';
import { resolveSilentCommand } from './silentUninstall.js';

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
export function runUninstaller({ uninstallString, quietUninstallString } = {}, onEvent) {
  return new Promise((resolve, reject) => {
    if (!uninstallString) {
      reject(new Error('This program has no registered uninstall command.'));
      return;
    }
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
