import { readdirSync, existsSync } from 'node:fs';
import { dirname, join, basename } from 'node:path';

/** Following a Squirrel launcher stub to the program it actually starts.
 *
 * Squirrel is the installer Electron apps ship with, and it lays an
 * install out like this:
 *
 *   %LOCALAPPDATA%\Discord\
 *     Update.exe          <- the stub the Run key points at
 *     app-1.0.9256\
 *       Discord.exe       <- the real program, and the real icon
 *
 * The Run value reads "…\Update.exe" --processStart Discord.exe, so the
 * only file Prune ever opened was the stub -- and the stub is
 * deliberately iconless. Measured on this machine rather than assumed:
 * PrivateExtractIcons reports 0 icon resources in Update.exe, and so does
 * Windows' own ExtractIconExW, at every size from 16 to 256. There is
 * nothing in that file to find, which is why the row showed a lettered
 * "D" while the icon everyone would recognise sat one directory away.
 *
 * Worth doing generally rather than special-casing Discord: this is how
 * Slack, GitHub Desktop, Signal and Teams classic all register themselves
 * too. The command already names the executable; it just was not being
 * read.
 */

/** The bare executable name a Squirrel stub is told to launch, or null.
 *
 * Only a leaf name is accepted, and that restriction is load-bearing
 * rather than tidiness. The name gets joined onto a directory this module
 * picks, and a Run value is writable by anything already running as the
 * user -- so a value of `--processStart ..\..\..\Windows\System32\x.exe`
 * must not become a path Prune then opens. A name with a separator, a
 * drive letter or a parent segment in it is refused outright instead of
 * being sanitised, because there is no legitimate Squirrel command that
 * uses one. */
export function processStartTarget(command) {
  const match = /--processStart(?:AndWait)?(?:=|\s+)("[^"]+"|[^\s"]+)/i.exec(String(command || ''));
  if (!match) return null;

  const target = match[1].replace(/^"|"$/g, '');
  // A flag rather than a value: `--processStart --other` matches the
  // pattern above and means nothing.
  if (!target || target.startsWith('-')) return null;
  if (target !== basename(target)) return null;
  if (/[\\/:]/.test(target)) return null;
  return target;
}

/** The highest-versioned app-x.y.z directory in a listing, or null.
 *
 * Squirrel keeps the previous version beside the current one until an
 * update settles, so "the only app- directory" is not a safe assumption.
 *
 * Compared segment by segment as numbers, because text order gets this
 * wrong in a way that shows up immediately in practice: "app-1.0.9256" --
 * Discord's actual directory here -- sorts BELOW "app-1.0.999" as text,
 * since '2' precedes '9' at the third character. */
export function newestAppDir(names) {
  let best = null;
  let bestParts = null;

  for (const name of names || []) {
    const match = /^app-(\d+(?:\.\d+)*)$/.exec(name);
    if (!match) continue;

    const parts = match[1].split('.').map(Number);
    if (bestParts === null || compareVersions(parts, bestParts) > 0) {
      best = name;
      bestParts = parts;
    }
  }

  return best;
}

function compareVersions(a, b) {
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) {
    // A missing segment is zero, so 1.0 sorts below 1.0.1.
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** The real executable behind a Squirrel stub, or null if this is not one.
 *
 * Touches the disk, which is why the two decisions above are separate
 * pure functions -- the version comparison is the part with a bug in it
 * worth testing, and it needs no filesystem to exercise.
 *
 * Every failure here is silent and returns null: the caller's next move
 * is the lettered tile it was already going to show, so a stub that
 * cannot be followed costs nothing that was not already lost. */
export function resolveSquirrelStub(stubPath, command) {
  if (!/\\Update\.exe$/i.test(stubPath || '')) return null;

  const target = processStartTarget(command);
  if (!target) return null;

  try {
    const root = dirname(stubPath);
    const newest = newestAppDir(readdirSync(root));
    if (!newest) return null;

    const candidate = join(root, newest, target);
    return existsSync(candidate) ? candidate : null;
  } catch {
    return null;
  }
}
