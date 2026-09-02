import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listInstalledPrograms } from './programs.js';
import { iconSourceForProgram, iconSourceFromUninstaller } from './iconSource.js';
import { findMainExecutable } from './findMainExecutable.js';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 60_000;

/** Extraction is pure function of the file it reads, and those files don't
 * change while the app is open -- so this survives for the process's life
 * and makes every load after the first instant. Keyed by "path|index"
 * rather than by program id: several entries legitimately point at the
 * same executable, and they should share one extraction. */
const cache = new Map();

/** PrivateExtractIcons, not ExtractAssociatedIcon.
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
 * resource has no icon), not an error worth failing the batch over. */
async function extractIcons(requests) {
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

/** Icons for every installed program, as { programId: dataUri }.
 *
 * Deliberately its own endpoint rather than part of the program list.
 * Extraction spawns PowerShell and reads ~90 executables; making the
 * list wait on that would trade a fast list for a prettier one. The UI
 * renders rows immediately and fills icons in when they arrive.
 *
 * A program with no icon is simply missing from the map, which the UI
 * renders as its existing lettered tile. */
export async function getProgramIcons(programs) {
  const list = programs ?? await listInstalledPrograms();

  const keyForProgram = new Map();
  const pending = new Map();

  for (const program of list) {
    // Three sources, in descending order of how likely they are to be the
    // icon a person would recognise:
    //
    //   1. DisplayIcon -- what the vendor explicitly registered.
    //   2. The real binary in InstallLocation. This is what rescues the
    //      recognisable names: Discord and Epic Games Launcher both
    //      register no DisplayIcon, and their actual icon-bearing
    //      executables sit in there.
    //   3. The uninstaller, as a last resort.
    //
    // The order matters more than it looks. With the uninstaller ranked
    // second, Discord got no icon at all: Squirrel's Update.exe is an
    // absolute non-MSI path, so it satisfied the fallback and stopped the
    // search, and then turned out to carry no icon.
    let source = iconSourceForProgram(program);

    if (!source && program.installLocation) {
      const executable = await findMainExecutable(program.installLocation, program.name);
      if (executable) source = { path: executable, index: 0 };
    }

    if (!source) source = iconSourceFromUninstaller(program);

    if (!source) continue;
    const key = `${source.path}|${source.index}`;
    keyForProgram.set(program.id, key);
    if (!cache.has(key) && !pending.has(key)) {
      pending.set(key, { key, path: source.path, index: source.index });
    }
  }

  if (pending.size > 0) {
    const extracted = await extractIcons([...pending.values()]);
    for (const { key } of pending.values()) {
      // Cached either way: a file with no extractable icon shouldn't be
      // re-opened on every refresh just to fail again.
      cache.set(key, extracted[key] ? `data:image/png;base64,${extracted[key]}` : null);
    }
  }

  const icons = {};
  for (const [programId, key] of keyForProgram) {
    const dataUri = cache.get(key);
    if (dataUri) icons[programId] = dataUri;
  }
  return icons;
}

/** Testing seam -- the cache is process-wide and would otherwise leak
 * between test cases. */
export function clearIconCache() {
  cache.clear();
}
