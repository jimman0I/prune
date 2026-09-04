import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractIcons } from './iconExtract.js';
import { getFileTypeIcons } from './fileTypeIcons.js';

const execFileAsync = promisify(execFile);
const TIMEOUT_MS = 30_000;

/** Icons for the startup list.
 *
 * The rows carried a lettered tile and nothing else, which on this screen
 * costs more than it does on the Applications tab: the entries here are
 * named by whatever string a program chose to write into a registry
 * value, so "RtkAudUService", "SunJavaUpdateSched" and "vgtray" are the
 * names, and an icon is often the only thing that says what any of them
 * actually is.
 *
 * Three sources, because the entries are three different kinds of thing:
 *
 *   1. An executable, read directly. This is thirteen of the fifteen
 *      entries on this machine.
 *   2. A Startup-folder shortcut, resolved through the shell first.
 *      PrivateExtractIcons returns nothing at all for a .lnk -- verified
 *      against the real FxSound.lnk here -- because the icon belongs to
 *      what the shortcut points at, and only the shell knows what that
 *      is.
 *   3. The file-type icon, for a file that carries no icon of its own.
 *      Scripts are the case that matters: a .cmd or .vbs running at
 *      sign-in is exactly the entry worth recognising on sight, and
 *      Windows already has an answer for what one looks like.
 */

/** Extraction is a pure function of the file it reads, and those files do
 * not change while the app is open. Keyed by "path|index" rather than by
 * entry id, so the two Discord entries -- one in each hive -- share a
 * single extraction. */
const cache = new Map();

/** Resolves Startup-folder shortcuts to something with an icon in it.
 *
 * IconLocation before TargetPath. A shortcut can name its own icon, and
 * for anything installed by MSI it usually does: FxSound's points into
 * C:\Windows\Installer rather than at Program Files, and that cached copy
 * is what Explorer draws. Falling straight through to TargetPath would
 * show a different icon from the one the user sees in their own Startup
 * folder.
 *
 * Both are checked for existence before being offered, because an
 * IconLocation naming a file that is no longer there is common enough --
 * an MSI cache cleaned up, a repair that moved things -- and would
 * otherwise lose the icon entirely rather than falling back. */
const RESOLVE_SCRIPT = String.raw`
$paths = Get-Content -LiteralPath '__INPUT__' -Raw | ConvertFrom-Json
$shell = New-Object -ComObject WScript.Shell
$out = @{}
foreach ($p in $paths) {
  try {
    if (-not (Test-Path -LiteralPath $p)) { continue }
    $link = $shell.CreateShortcut($p)

    $file = $null
    $index = 0
    if ($link.IconLocation) {
      # "path,index" -- and the path itself can contain commas, so the
      # split has to come off the END rather than the first one found.
      $loc = [string]$link.IconLocation
      $comma = $loc.LastIndexOf(',')
      if ($comma -ge 0) {
        $candidate = $loc.Substring(0, $comma)
        $parsed = 0
        if ([int]::TryParse($loc.Substring($comma + 1), [ref]$parsed)) {
          if ($candidate -and (Test-Path -LiteralPath $candidate)) { $file = $candidate; $index = $parsed }
        }
      } elseif ($loc -and (Test-Path -LiteralPath $loc)) { $file = $loc }
    }

    if (-not $file -and $link.TargetPath -and (Test-Path -LiteralPath $link.TargetPath)) {
      $file = [string]$link.TargetPath
    }

    if ($file) { $out[$p] = [PSCustomObject]@{ path = $file; index = $index } }
  } catch { }
}
ConvertTo-Json -InputObject $out -Compress -Depth 4
`;

/** Whether this path is a shell shortcut rather than a file to read. */
function isShortcutFile(path) {
  return /\.(lnk|url)$/i.test(path || '');
}

/** The icon index a command carries, if it carries one.
 *
 * A Run value pointing at "shell32.dll,42" means the forty-third icon in
 * that file, and ignoring the number shows the wrong icon rather than no
 * icon. Only read when the text after the comma is nothing but digits:
 * plenty of commands have a comma in an argument, and treating
 * `--flag,value` as an index would send every one of those to icon zero
 * of a file that is not the one named.
 *
 * Deliberately not applied to a quoted command. `"C:\a.exe" -x,1` ends
 * its path at the closing quote, so the comma is unambiguously inside an
 * argument. */
function iconIndexFrom(command) {
  const text = String(command || '').trim();
  if (text.startsWith('"')) return 0;
  const match = /,(\d{1,4})\s*$/.exec(text);
  return match ? Number(match[1]) : 0;
}

/** File types whose icon lives inside the file, so the shell's answer for
 * the TYPE is worth nothing.
 *
 * This is not a tidiness rule, it is a measured bug. The shell's icon for
 * ".exe" is a single generic glyph, and on this machine it was handed to
 * both Discord's Update.exe and RtkAudUService64.exe -- neither of which
 * carries an icon -- so two unrelated programs rendered as the same
 * picture, one row claiming to be the other. A lettered tile carrying the
 * entry's own initial is strictly more informative than a glyph that is
 * identical for everything that failed.
 *
 * Scripts are the opposite case and the reason the fallback exists at
 * all: a .cmd has no icon of its own, "what a batch file looks like" IS
 * the answer, and a script running at sign-in is exactly the entry worth
 * recognising on sight. */
const OWN_ICON_TYPES = new Set(['.exe', '.dll', '.com', '.scr', '.cpl', '.ocx', '.ico', '.mun']);

/** The extension a file-type icon can be asked for, or null.
 *
 * Null rather than a guess when there is no extension: `hosts` has no
 * type and no icon, and handing the row a generic page glyph would be
 * claiming to know something. The lettered tile at least carries the
 * entry's initial. */
export function typeIconExtension(path) {
  const match = /(\.[A-Za-z0-9_-]{1,12})$/.exec(String(path || ''));
  if (!match) return null;
  const extension = match[1].toLowerCase();
  return OWN_ICON_TYPES.has(extension) ? null : extension;
}

/** Where each entry's icon should come from, as entryId -> source.
 *
 * Pure, and separate from the reading, because this is the part with the
 * decisions in it: which of the three kinds an entry is, whether its
 * command carries an index, and whether there is anything to read at all.
 * An entry whose command is a bare name resolved through PATH has no file
 * to open and is simply absent. */
export function startupIconSources(items) {
  const sources = new Map();

  for (const item of items || []) {
    const path = item?.executable;
    if (!path || !item.id) continue;
    sources.set(item.id, {
      path,
      index: iconIndexFrom(item.command),
      viaShortcut: isShortcutFile(path)
    });
  }

  return sources;
}

async function resolveShortcuts(paths) {
  if (paths.length === 0) return {};

  const workDir = mkdtempSync(join(tmpdir(), 'prune-lnk-'));
  const inputPath = join(workDir, 'paths.json');
  try {
    writeFileSync(inputPath, JSON.stringify(paths), 'utf8');
    const script = RESOLVE_SCRIPT.replace('__INPUT__', inputPath.replace(/'/g, "''"));
    const { stdout } = await execFileAsync(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
      { timeout: TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 }
    );
    const trimmed = stdout.trim();
    return trimmed ? JSON.parse(trimmed) : {};
  } catch {
    // A shortcut that will not resolve costs that row its icon and
    // nothing else. The other fourteen should still get theirs.
    return {};
  } finally {
    try { rmSync(workDir, { recursive: true, force: true }); } catch { /* best-effort */ }
  }
}

/** Icons for the startup entries, as { entryId: dataUri }.
 *
 * Its own endpoint like the program icons, and for the same reason: this
 * spawns PowerShell twice and opens every executable in the list, and the
 * rows should be on screen long before any of that finishes. An entry
 * with no icon is simply absent from the map and keeps its lettered tile.
 */
export async function getStartupIcons(items) {
  const sources = startupIconSources(items);
  if (sources.size === 0) return {};

  // One resolution pass for every shortcut in the list, then the sources
  // are all ordinary files and the rest of this does not care which kind
  // they started as.
  const shortcutPaths = [...new Set(
    [...sources.values()].filter((s) => s.viaShortcut).map((s) => s.path)
  )];
  const resolved = await resolveShortcuts(shortcutPaths);

  const keyForEntry = new Map();
  const pending = new Map();

  for (const [id, source] of sources) {
    const target = source.viaShortcut ? resolved[source.path] : source;
    // A shortcut that resolved to nothing has no file to read. It still
    // gets a type-icon attempt below, which for a .lnk is the generic
    // shortcut glyph -- honest, and better than an empty cell.
    const path = target?.path || source.path;
    const index = target?.index ?? 0;

    const key = `${path}|${index}`;
    keyForEntry.set(id, key);
    if (!cache.has(key) && !pending.has(key)) pending.set(key, { key, path, index });
  }

  if (pending.size > 0) {
    const extracted = await extractIcons([...pending.values()]);
    for (const { key } of pending.values()) {
      // Cached either way. A file with no extractable icon should not be
      // reopened on every refresh just to fail again.
      cache.set(key, extracted[key] ? `data:image/png;base64,${extracted[key]}` : null);
    }
  }

  const icons = {};
  const needsType = new Map();
  for (const [id, key] of keyForEntry) {
    const dataUri = cache.get(key);
    if (dataUri) {
      icons[id] = dataUri;
      continue;
    }
    const extension = typeIconExtension(key.slice(0, key.lastIndexOf('|')));
    if (extension) needsType.set(id, extension);
  }

  if (needsType.size > 0) {
    // One call for every extension still missing an answer. Its own cache
    // lives in fileTypeIcons.js and is shared with the disk map, which
    // has usually filled it already.
    const typeIcons = await getFileTypeIcons([...new Set(needsType.values())]);
    for (const [id, extension] of needsType) {
      if (typeIcons[extension]) icons[id] = typeIcons[extension];
    }
  }

  return icons;
}

/** Testing seam -- the cache is process-wide and would otherwise leak
 * between test cases. */
export function clearStartupIconCache() {
  cache.clear();
}
