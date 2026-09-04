import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 60_000;

/** Pulling a real icon out of a real file, for whoever needs one.
 *
 * Lifted out of programIcons.js unchanged when the startup screen needed
 * the same thing. Two copies of a forty-line block of inline C# would
 * have diverged the first time one of them was fixed, and the fix that
 * matters here -- DestroyIcon on every handle -- is exactly the kind that
 * gets applied to one copy and forgotten in the other.
 *
 * PrivateExtractIcons, not ExtractAssociatedIcon.
 *
 * ExtractAssociatedIcon is the obvious .NET call and it always returns
 * 32x32, which is visibly soft in a 36px box on a HiDPI screen.
 * PrivateExtractIcons takes the size as an argument, so we can ask for 64
 * and get a crisp result from both .exe resources and .ico files through
 * one code path.
 *
 * Every icon is freed with DestroyIcon. These are real GDI handles, and a
 * process that leaks a hundred of them per refresh will eventually stop
 * being able to draw anything. */
const EXTRACT_SCRIPT = String.raw`
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PruneIcon {
  [DllImport("user32.dll", CharSet = CharSet.Unicode)]
  public static extern int PrivateExtractIcons(string lpszFile, int nIconIndex, int cxIcon, int cyIcon, IntPtr[] phicon, int[] piconid, int nIcons, int flags);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@

$requests = Get-Content -LiteralPath '__INPUT__' -Raw | ConvertFrom-Json
$out = @{}
foreach ($r in $requests) {
  try {
    if (-not (Test-Path -LiteralPath $r.path)) { continue }
    $h = New-Object IntPtr[] 1
    $ids = New-Object int[] 1
    $n = [PruneIcon]::PrivateExtractIcons($r.path, $r.index, 64, 64, $h, $ids, 1, 0)
    if ($n -le 0 -or $h[0] -eq [IntPtr]::Zero) { continue }
    try {
      $icon = [System.Drawing.Icon]::FromHandle($h[0])
      $bmp = $icon.ToBitmap()
      $ms = New-Object System.IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $out[$r.key] = [Convert]::ToBase64String($ms.ToArray())
      $ms.Dispose()
      $bmp.Dispose()
    } finally { [PruneIcon]::DestroyIcon($h[0]) | Out-Null }
  } catch { }
}
ConvertTo-Json -InputObject $out -Compress -Depth 3
`;

/** Extracts icons for the given { key, path, index } requests, returning
 * { key: base64Png }. Anything that can't be extracted is simply absent
 * -- a missing icon is an ordinary outcome (the file was uninstalled, the
 * resource has no icon, the file is a .cmd with nothing in it to read),
 * not an error worth failing the batch over. */
export async function extractIcons(requests) {
  if (requests.length === 0) return {};

  // The request list goes via a temp file, not the command line: 129
  // paths is well past what a -Command argument can carry, and it would
  // fail as a truncated command rather than as anything diagnosable.
  const workDir = mkdtempSync(join(tmpdir(), 'prune-icons-'));
  const inputPath = join(workDir, 'requests.json');
  try {
    writeFileSync(inputPath, JSON.stringify(requests), 'utf8');
    const script = EXTRACT_SCRIPT.replace('__INPUT__', inputPath.replace(/'/g, "''"));
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 }
    );
    const trimmed = stdout.trim();
    if (!trimmed) return {};
    return JSON.parse(trimmed);
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}
