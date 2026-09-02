import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 30_000;

/** The key used for the directory icon, and for a file with no extension.
 * Exported so the frontend and the tests agree on the spelling rather
 * than each writing the literal. */
export const FOLDER_KEY = 'folder';
export const GENERIC_FILE_KEY = 'file';

/** File-type icons don't change while the app is open, and there are only
 * ever a few dozen distinct extensions on screen. Cached for the life of
 * the process. */
const cache = new Map();

/** Windows resolves an extension to an icon through a chain of registry
 * lookups (HKCR\.mp4 -> ProgID -> DefaultIcon). SHGetFileInfo walks that
 * chain, and SHGFI_USEFILEATTRIBUTES makes it resolve from the NAME
 * alone -- so "x.mp4" gives the video icon without any such file
 * existing, which is exactly what a treemap needs. Doing the registry
 * walk by hand would be a lot of code to reimplement a shell API.
 *
 * Unknown extensions come back as the generic blank-document icon rather
 * than nothing, which is the right answer for a treemap cell. */
const SCRIPT = String.raw`
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class PruneShellIcon {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct SHFILEINFO {
    public IntPtr hIcon;
    public int iIcon;
    public uint dwAttributes;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szDisplayName;
    [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)] public string szTypeName;
  }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  public static extern IntPtr SHGetFileInfo(string pszPath, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);
  [DllImport("user32.dll")]
  public static extern bool DestroyIcon(IntPtr hIcon);
}
"@

$SHGFI_ICON_USEATTRS = 0x100 -bor 0x10
$requests = Get-Content -LiteralPath '__INPUT__' -Raw | ConvertFrom-Json
$out = @{}
foreach ($r in $requests) {
  try {
    $info = New-Object PruneShellIcon+SHFILEINFO
    $size = [uint32][System.Runtime.InteropServices.Marshal]::SizeOf($info)
    $res = [PruneShellIcon]::SHGetFileInfo($r.name, [uint32]$r.attributes, [ref]$info, $size, $SHGFI_ICON_USEATTRS)
    if ($res -eq [IntPtr]::Zero -or $info.hIcon -eq [IntPtr]::Zero) { continue }
    try {
      $icon = [System.Drawing.Icon]::FromHandle($info.hIcon)
      $bmp = $icon.ToBitmap()
      $ms = New-Object System.IO.MemoryStream
      $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
      $out[$r.key] = [Convert]::ToBase64String($ms.ToArray())
      $ms.Dispose()
      $bmp.Dispose()
    } finally { [PruneShellIcon]::DestroyIcon($info.hIcon) | Out-Null }
  } catch { }
}
ConvertTo-Json -InputObject $out -Compress -Depth 3
`;

const FILE_ATTRIBUTE_NORMAL = 0x80;
const FILE_ATTRIBUTE_DIRECTORY = 0x10;

/** Lowercased ".ext" for a filename, or null when it has none. Only the
 * last extension counts: "archive.tar.gz" is a .gz as far as Windows'
 * icon association is concerned.
 *
 * The extension must contain a letter. Without that rule a versioned
 * directory name like "app-1.0.9255" -- Discord's, and every other
 * Squirrel app's -- parses as a ".9255 file", and the treemap ends up
 * asking the shell about hundreds of nonexistent file types. Every real
 * extension has a letter in it (.7z and .3gp included). */
export function extensionOf(name) {
  if (typeof name !== 'string') return null;
  const match = name.match(/(\.[a-z0-9_-]{1,12})$/i);
  if (!match) return null;
  const ext = match[1].toLowerCase();
  return /[a-z]/.test(ext) ? ext : null;
}

/** Icons for the given extensions plus the folder and generic-file icons,
 * as { key: dataUri }. Keys are the extension itself (".mp4"), or
 * FOLDER_KEY / GENERIC_FILE_KEY.
 *
 * Anything Windows can't resolve is simply absent; the caller falls back
 * to the plain coloured cell it drew before. */
export async function getFileTypeIcons(extensions = []) {
  const wanted = new Set([FOLDER_KEY, GENERIC_FILE_KEY]);
  for (const ext of extensions) {
    const normalized = typeof ext === 'string' ? ext.toLowerCase() : null;
    // Same letter rule as extensionOf: a caller could hand us anything.
    if (normalized && /^\.[a-z0-9_-]{1,12}$/.test(normalized) && /[a-z]/.test(normalized)) wanted.add(normalized);
  }

  const pending = [];
  for (const key of wanted) {
    if (cache.has(key)) continue;
    if (key === FOLDER_KEY) pending.push({ key, name: 'folder', attributes: FILE_ATTRIBUTE_DIRECTORY });
    else if (key === GENERIC_FILE_KEY) pending.push({ key, name: 'file.__prune_unknown__', attributes: FILE_ATTRIBUTE_NORMAL });
    else pending.push({ key, name: `file${key}`, attributes: FILE_ATTRIBUTE_NORMAL });
  }

  if (pending.length > 0) {
    const extracted = await runExtraction(pending);
    for (const { key } of pending) {
      cache.set(key, extracted[key] ? `data:image/png;base64,${extracted[key]}` : null);
    }
  }

  const icons = {};
  for (const key of wanted) {
    const dataUri = cache.get(key);
    if (dataUri) icons[key] = dataUri;
  }
  return icons;
}

async function runExtraction(requests) {
  const workDir = mkdtempSync(join(tmpdir(), 'prune-typeicons-'));
  const inputPath = join(workDir, 'requests.json');
  try {
    writeFileSync(inputPath, JSON.stringify(requests), 'utf8');
    const script = SCRIPT.replace('__INPUT__', inputPath.replace(/'/g, "''"));
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: TIMEOUT_MS, maxBuffer: 32 * 1024 * 1024 }
    );
    const trimmed = stdout.trim();
    return trimmed ? JSON.parse(trimmed) : {};
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Testing seam -- the cache is process-wide. */
export function clearFileTypeIconCache() {
  cache.clear();
}
