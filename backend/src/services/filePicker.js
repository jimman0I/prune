import { execFile } from 'node:child_process';
import { statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

/** A native "choose a folder" / "choose an installer" dialog.
 *
 * The window runs with contextIsolation on and no file API, and the app has
 * no preload bridge for dialogs, so the backend shows the standard Windows
 * dialog itself, through PowerShell and WinForms, and hands back only the
 * path that was chosen. Used by the forced uninstall (a folder) and the
 * install monitor (an installer).
 *
 * The dialog is owned by an invisible topmost form: a dialog with no owner,
 * opened by a background process, tends to appear BEHIND the window that
 * asked for it, which reads as the button doing nothing. -STA, because
 * WinForms dialogs need a single-threaded apartment.
 *
 * The result is checked here rather than trusted: it has to exist and be the
 * kind of thing that was asked for. */
export const PICKER_KINDS = ['folder', 'installer'];

const OWNER = `
Add-Type -AssemblyName System.Windows.Forms
$owner = New-Object System.Windows.Forms.Form
$owner.TopMost = $true
$owner.ShowInTaskbar = $false
$owner.StartPosition = 'CenterScreen'
$owner.Opacity = 0
$owner.Show()
`;

export function buildPickerScript(kind) {
  if (kind === 'folder') {
    return `${OWNER}
$dialog = New-Object System.Windows.Forms.FolderBrowserDialog
$dialog.Description = 'Choose the folder the program was installed in'
$dialog.ShowNewFolderButton = $false
$chosen = ''
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $chosen = $dialog.SelectedPath }
$owner.Dispose()
[Console]::Out.Write($chosen)
`;
  }
  if (kind === 'installer') {
    return `${OWNER}
$dialog = New-Object System.Windows.Forms.OpenFileDialog
$dialog.Title = 'Choose the installer to run'
$dialog.Filter = 'Installers (*.exe;*.msi)|*.exe;*.msi'
$dialog.CheckFileExists = $true
$dialog.Multiselect = $false
$chosen = ''
if ($dialog.ShowDialog($owner) -eq [System.Windows.Forms.DialogResult]::OK) { $chosen = $dialog.FileName }
$owner.Dispose()
[Console]::Out.Write($chosen)
`;
  }
  throw new Error(`Unknown picker kind "${kind}".`);
}

function runPickerScript(script) {
  return new Promise((resolve, reject) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-STA', '-Command', `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${script}`],
      { timeout: 10 * 60 * 1000, windowsHide: false, maxBuffer: 1024 * 1024 },
      (err, stdout) => (err ? reject(new Error(`The dialog could not be shown: ${err.message}`)) : resolve(stdout.trim()))
    );
  });
}

let open = false;

/** Shows the dialog and resolves { path } -- null when it was cancelled or
 * the answer is not something that exists and fits. One at a time. */
export async function pickPath(kind, { run = (k) => runPickerScript(buildPickerScript(k)) } = {}) {
  if (!PICKER_KINDS.includes(kind)) throw new Error(`Unknown picker kind "${kind}".`);
  if (open) throw new Error('A file dialog is already open.');
  open = true;
  try {
    const chosen = await run(kind);
    if (typeof chosen !== 'string' || chosen.trim() === '' || !isAbsolute(chosen.trim())) return { path: null };
    const path = chosen.trim();
    let info;
    try { info = statSync(path); } catch { return { path: null }; }
    if (kind === 'folder' && !info.isDirectory()) return { path: null };
    if (kind === 'installer' && !info.isFile()) return { path: null };
    return { path };
  } finally {
    open = false;
  }
}
