import { spawn } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { win32 } from 'node:path';
import { windowsPowerShellEnv } from './powershell.js';
import { iconSourceForProgram } from './iconSource.js';
import { findMainExecutable } from './findMainExecutable.js';

/** Windows' own Properties sheet for a file -- the one Explorer opens from
 * right-click > Properties, with the Details tab (version, company,
 * copyright), Digital Signatures and Compatibility. Prune shows some of that
 * itself; the sheet is the place a person already trusts to read the rest.
 *
 * There is no command line that opens it. Explorer has no switch for it,
 * rundll32 has no entry point for it, and Electron's shell module does not
 * reach it. What does is the shell's own "properties" verb, through the
 * Shell.Application object (FolderItem.InvokeVerb), and that has a catch
 * that decides the whole shape of this module: the sheet is not a separate
 * program. The shell builds it on a new thread INSIDE the process that asked,
 * and returns at once. A PowerShell that asks and exits takes the sheet with
 * it a fraction of a second after it appears -- which is why the obvious
 * one-liner seems to do nothing at all.
 *
 * So a small PowerShell host asks, then waits: it finds the sheet among its
 * own windows (a dialog, class #32770, owned by its own process id), says
 * SHOWN on stdout, and stays alive exactly as long as that window exists.
 * Closing the sheet ends the host. Nothing is polled from here once it is
 * shown, and nothing here waits on it: the request is answered the moment
 * the sheet is up, and the host lives on by itself.
 *
 * "properties" is the verb's canonical name, the same on every display
 * language -- the localised menu text ("Eigenschaften") is never used.
 *
 * Verified live on Windows 11 for C:\Windows\notepad.exe: the host printed
 * SHOWN, a visible "notepad.exe Properties" #32770 window belonged to it,
 * and ending the host closed the sheet. The sheet was visible on its own,
 * with the host started hidden; the explicit ShowWindow below is there in
 * case a build ever honours the hidden start for the sheet's first show. */

/** How long the sheet may take to appear before the attempt counts as
 * failed. Typically well under a second; the first ever call compiles the
 * small window-finding type, which is most of the wait. */
const SHOW_TIMEOUT_MS = 15000;

/** The host script. The path arrives in an environment variable and is
 * never part of the script text, so nothing in a file name -- quotes, `$`,
 * backticks, semicolons -- can ever be read as PowerShell. */
const HOST_SCRIPT = `
$ErrorActionPreference = 'Stop'
try {
  $path = $env:PRUNE_PROPERTIES_PATH
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public static class PrunePropertiesSheet {
  delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  public static IntPtr Find(uint pid) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint owner; GetWindowThreadProcessId(h, out owner);
      if (owner != pid) return true;
      StringBuilder name = new StringBuilder(64);
      GetClassName(h, name, 64);
      if (name.ToString() != "#32770") return true;
      found = h; return false;
    }, IntPtr.Zero);
    return found;
  }
}
'@
  $folder = (New-Object -ComObject Shell.Application).Namespace([System.IO.Path]::GetDirectoryName($path))
  if (-not $folder) { [Console]::Out.WriteLine('FAILED folder'); exit 2 }
  $item = $folder.ParseName([System.IO.Path]::GetFileName($path))
  if (-not $item) { [Console]::Out.WriteLine('FAILED file'); exit 2 }
  $item.InvokeVerb('properties')
  $deadline = (Get-Date).AddSeconds(${Math.round(SHOW_TIMEOUT_MS / 1000) - 2})
  $sheet = [IntPtr]::Zero
  while ($sheet -eq [IntPtr]::Zero -and (Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 100
    $sheet = [PrunePropertiesSheet]::Find([uint32]$PID)
  }
  if ($sheet -eq [IntPtr]::Zero) { [Console]::Out.WriteLine('FAILED nowindow'); exit 3 }
  [void][PrunePropertiesSheet]::ShowWindow($sheet, 5)
  [void][PrunePropertiesSheet]::SetForegroundWindow($sheet)
  [Console]::Out.WriteLine('SHOWN')
  [Console]::Out.Flush()
  # Alive for as long as the sheet is, and never longer than a working day:
  # a host must not outlive its purpose if the window check ever misreads.
  $limit = (Get-Date).AddHours(8)
  while ([PrunePropertiesSheet]::IsWindow($sheet) -and (Get-Date) -lt $limit) { Start-Sleep -Milliseconds 500 }
} catch {
  [Console]::Out.WriteLine('FAILED ' + $_.Exception.Message)
  exit 1
}
`;

const fail = (error) => ({ ok: false, error });

/** Whether `target` is something the sheet may be opened for, and its
 * normalised path. Only a full local or UNC path to a file that exists:
 *   - absolute, because a relative path would be resolved against whatever
 *     the backend's working directory happens to be;
 *   - no control characters or quotes, which no real Windows path holds;
 *   - not a device path (\\.\ or \\?\), which names things that are not
 *     files in the sense the shell means;
 *   - a FILE, not a folder: the folder sheet is a different dialog, and
 *     nothing here asks for it.
 * Separate from the spawn so every rule is tested without opening a window. */
export function resolvePropertiesTarget(target) {
  if (typeof target !== 'string' || !target.trim()) return fail('No file given.');
  const raw = target.trim();
  if (raw.length > 32767 || /[\u0000-\u001f"]/.test(raw)) return fail('That is not a file path.');
  if (/^[\\/]{2}[.?][\\/]/.test(raw)) return fail('That is not a file path.');
  if (!/^(?:[A-Za-z]:[\\/]|[\\/]{2}[^\\/]+[\\/][^\\/]+)/.test(raw)) return fail('Needs the full path to a file.');
  const path = win32.normalize(raw);
  if (!existsSync(path)) return fail('That file is no longer on disk.');
  let isFile;
  try {
    isFile = statSync(path).isFile();
  } catch {
    return fail('That file could not be read.');
  }
  if (!isFile) return fail('That is a folder, not a file.');
  return { ok: true, path };
}

/** Opens the sheet for `target` and answers once it is on screen (or why
 * not). Never throws. The host is left running on its own after SHOWN --
 * it ends when the person closes the sheet -- and is ended here only when
 * it never showed one in time.
 *
 * `spawnImpl` is injectable so the tests drive a fake host; every real
 * caller gets node's spawn. */
export function showFileProperties(target, { spawnImpl = spawn, timeoutMs = SHOW_TIMEOUT_MS } = {}) {
  const plan = resolvePropertiesTarget(target);
  if (!plan.ok) return Promise.resolve(plan);

  return new Promise((resolve) => {
    let settled = false;
    let output = '';
    let child;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      // Let the host go: its stdout is no longer read, and Node must not
      // wait on it (or on the sheet the person is reading) to exit.
      child?.stdout?.removeAllListeners('data');
      child?.stdout?.destroy?.();
      child?.unref?.();
      resolve(result);
    };

    try {
      child = spawnImpl('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', HOST_SCRIPT], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'ignore'],
        env: { ...windowsPowerShellEnv(), PRUNE_PROPERTIES_PATH: plan.path }
      });
    } catch (err) {
      resolve(fail(err.message));
      return;
    }

    const timer = setTimeout(() => {
      try { child.kill(); } catch { /* already gone */ }
      finish(fail('The Properties window did not open.'));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      output += String(chunk);
      if (/^SHOWN\s*$/m.test(output)) finish({ ok: true, path: plan.path });
      const failed = /^FAILED (.*)$/m.exec(output);
      if (failed) finish(fail(`The Properties window did not open (${failed[1].trim()}).`));
    });
    child.on('error', (err) => finish(fail(err.message)));
    child.on('exit', () => finish(fail('The Properties window did not open.')));
  });
}

// The same exclusion programSignatures.js makes: Windows' own tools stand for
// no program in particular, so a DisplayIcon pointing at one is not "the
// program's file".
const SYSTEM_TOOL = /\\windows\\(system32|syswow64)\\|(^|\\)(msiexec|rundll32|cmd)\.exe$/i;
const NOT_THE_PROGRAM = /^(unins|uninst|uninstall|setup)/i;

/** The executable a program is built around, for its Properties: the
 * vendor's DisplayIcon when that is an .exe of its own, else the main
 * executable findMainExecutable() finds in its folder. Never its
 * uninstaller -- the Properties of unins000.exe are not the program's. null
 * when neither gives a file. */
export async function mainExecutableFor(program, { findExecutable = findMainExecutable } = {}) {
  if (!program) return null;
  // Plenty of vendors register their uninstaller or installer as the icon
  // ("PawnIO\uninstall.exe,0", AMD Ryzen Master's bin\Setup.exe); neither file
  // is the program, so its folder is searched instead.
  const declared = iconSourceForProgram(program);
  if (declared && /\.exe$/i.test(declared.path) && !SYSTEM_TOOL.test(declared.path)
    && !NOT_THE_PROGRAM.test(win32.basename(declared.path)) && existsSync(declared.path)) {
    return declared.path;
  }
  if (program?.installLocation) {
    const executable = await findExecutable(program.installLocation, program.name).catch(() => null);
    if (executable && /\.exe$/i.test(executable) && !SYSTEM_TOOL.test(executable)) return executable;
  }
  return null;
}
