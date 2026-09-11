import { runPowerShellJson } from './powershell.js';

/** Sends files to the Windows Recycle Bin instead of Prune's own quarantine.
 *
 * This is what `autoQuarantine: false` means. That setting was written by
 * the Settings screen and read by nothing at all -- Deep Clean quarantined
 * either way -- so the switch sat there doing nothing while claiming to
 * decide something.
 *
 * The alternative to quarantining is NOT deleting outright. Revo offers
 * exactly this choice ("Delete to bin") and the Recycle Bin is the right
 * answer to it: the user gets their space back from a place they already
 * know how to empty, and a file taken by mistake is still recoverable
 * through a UI they already trust. An unrecoverable delete would be a
 * worse product with no upside -- nobody cleaning a cache needs the bytes
 * gone in a way that survives a change of mind.
 *
 * There is no Node API for this. Recycling is a shell operation, and the
 * only thing on a stock Windows that performs one is
 * Microsoft.VisualBasic.FileIO.FileSystem -- the same call Explorer's own
 * delete uses, so a file recycled here appears in the bin exactly as if it
 * had been deleted from a folder window.
 */
function buildScript(paths) {
  // Every path single-quoted with its own quotes doubled, PowerShell's
  // escape inside a single-quoted string. Without it a path containing an
  // apostrophe ends the string early and the rest becomes syntax.
  const literals = paths.map((p) => `'${p.replace(/'/g, "''")}'`).join(',');

  return `
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName Microsoft.VisualBasic
$recycled = @()
$failed = @()
foreach ($path in @(${literals})) {
  try {
    if (Test-Path -LiteralPath $path -PathType Leaf) {
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteFile(
        $path,
        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
      )
      $recycled += $path
    } elseif (Test-Path -LiteralPath $path -PathType Container) {
      # A whole folder, contents and all -- what an uninstall's leftovers
      # usually are. Deep Clean only ever sends files, and this branch was
      # missing until a live check of the uninstall leftovers found folders
      # coming back neither recycled nor failed, still on the disk.
      [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory(
        $path,
        [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs,
        [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin
      )
      $recycled += $path
    }
  } catch {
    # One locked file must not abort the batch, the same way it doesn't
    # for a quarantine run.
    $failed += $path
  }
}
ConvertTo-Json -InputObject ([PSCustomObject]@{ recycled = @($recycled); failed = @($failed) }) -Compress -Depth 3
`;
}

/** Normalizes whatever PowerShell handed back into two string arrays.
 *
 * ConvertTo-Json flattens a one-element array to a bare value and omits an
 * empty one, so both shapes arrive from the same script depending only on
 * how many files matched. */
export function normalizeRecycleResult(raw) {
  const list = (value) => {
    if (Array.isArray(value)) return value.filter((v) => typeof v === 'string');
    return typeof value === 'string' ? [value] : [];
  };
  return { recycled: list(raw?.recycled), failed: list(raw?.failed) };
}

/** Recycles every listed file. Returns which ones went and which didn't.
 *
 * Reports rather than throws, matching quarantineAndDelete: a batch where
 * one file was locked is a partial success with a name attached, not a
 * failure of the whole run. */
export async function sendToRecycleBin(paths) {
  const usable = (paths || []).filter((p) => typeof p === 'string' && p.trim() !== '');
  if (usable.length === 0) return { recycled: [], failed: [] };

  try {
    return normalizeRecycleResult(await runPowerShellJson(buildScript(usable)));
  } catch (err) {
    // The whole call failed, so nothing was recycled. Saying so is the
    // point -- a caller that assumed success would report freed space
    // that is still on the disk.
    return { recycled: [], failed: usable, error: err.message };
  }
}
