/** What reaches the page from File Explorer's right-click menu, and from a
 * program dropped onto the Applications screen.
 *
 * The desktop app exposes `window.pruneWindow.onOpenRequest` (electron/
 * preload.cjs): the main process reads `--shred <path>` / `--find-program
 * <path>` from the command line (electron/explorerRequests.cjs) and sends each
 * one here, once the page says it is listening. In a browser, a test, or a
 * development build served without Electron there is no such bridge and
 * nothing is ever sent.
 *
 * A request only ever SHOWS something: 'shred' opens the Shred dialog with the
 * path filled in (the dialog's own confirmation still stands), 'find-program'
 * looks the program up and opens the ordinary uninstall dialog. This file checks
 * what arrives once more -- the bridge is the one place a request enters the
 * page -- and does nothing else. */

const MAX_PATH_LENGTH = 4096;
const KINDS = new Set(['shred', 'find-program']);

/** The same rule as electron/explorerRequests.cjs isAcceptablePath and the
 * backend's programFinder: an absolute path on a drive letter, no `..`, no
 * control characters, none of the characters Windows forbids in a name. */
function isDrivePath(value) {
  if (typeof value !== 'string' || value.length < 3 || value.length > MAX_PATH_LENGTH) return false;
  if (!/^[A-Za-z]:\\/.test(value)) return false;
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f<>"|?*]/.test(value)) return false;
  if (value.indexOf(':', 2) !== -1) return false;
  return !value.split('\\').some((segment) => segment === '..');
}

/** `{ kind, path }` for a request that checks out, else null. A new object: only
 * those two fields ever go on. */
export function normalizeOpenRequest(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!KINDS.has(raw.kind) || !isDrivePath(raw.path)) return null;
  return { kind: raw.kind, path: raw.path };
}

const bridge = () => (typeof window === 'undefined' ? undefined : window.pruneWindow);

/** Calls back with each valid request. Returns the function that stops
 * listening (a no-op where there is no bridge). */
export function onOpenRequest(callback) {
  const subscribe = bridge()?.onOpenRequest;
  if (typeof subscribe !== 'function') return () => {};
  const stop = subscribe((raw) => {
    const request = normalizeOpenRequest(raw);
    if (request) callback(request);
  });
  return typeof stop === 'function' ? stop : () => {};
}

const PROGRAM_FILE = /\.(exe|lnk)$/i;

/** What a drop onto the Applications screen holds: `{ path }` for the first
 * file when it is a program (.exe) or a shortcut (.lnk) whose real path the
 * desktop bridge can read, else `{ error: 'notProgram' | 'unreadable' }`. A file
 * that is not a program is refused before its path is read at all. */
export function programFileFromDrop(files) {
  const first = files && files.length > 0 ? files[0] : null;
  if (!first) return { error: 'unreadable' };
  if (!PROGRAM_FILE.test(String(first.name ?? ''))) return { error: 'notProgram' };
  const path = bridge()?.pathForFile?.(first);
  return isDrivePath(path) ? { path } : { error: 'unreadable' };
}
