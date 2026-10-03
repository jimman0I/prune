/** Requests from File Explorer's right-click menu, kept free of Electron so
 * they can be tested without a window.
 *
 * "Add Prune to the right-click menu" (Settings -> General) writes shell verbs
 * that run
 *
 *   "<Prune.exe>" --shred "%1"           on any file or folder
 *   "<Prune.exe>" --find-program "%1"    on a program (.exe) or a shortcut (.lnk)
 *
 * (backend/src/services/explorerMenu.js). Prune is either started by that
 * command or already running, in which case Electron hands the second launch's
 * command line to the first (`second-instance`). Either way the command line
 * is untrusted input, so it is read strictly here, and what comes out of it is
 * a request to SHOW something -- never to do it:
 *
 *   shred          the Shred dialog opens in Deep Clean with that path filled
 *                  in. Nothing is shredded until the person has read the
 *                  dialog's own confirmation and pressed its button.
 *   find-program   Prune looks the program up in the installed list and opens
 *                  the ordinary uninstall dialog (or offers Forced uninstall).
 *
 * The request reaches the page on a one-way event (preload.cjs
 * `onOpenRequest`). The page cannot send anything back that makes the main
 * process act, except one flag saying whether it is listening. */

const SHRED_FLAG = '--shred';
const FIND_FLAG = '--find-program';

/** Main -> page, one request. Page -> main, true/false: is the page listening. */
const OPEN_REQUEST_CHANNEL = 'prune:open-request';
const OPEN_REQUEST_READY_CHANNEL = 'prune:open-request:ready';

const KINDS = { [SHRED_FLAG]: 'shred', [FIND_FLAG]: 'find-program' };
const KIND_NAMES = new Set(Object.values(KINDS));

/** Far beyond any real path (Windows stops at 32,767 and Explorer hands over
 * far less), and low enough to refuse a command line built to be enormous. */
const MAX_PATH_LENGTH = 4096;

/** An absolute path on a drive letter, as Explorer's %1 gives it. No relative
 * paths, no `..` segments, no control characters, none of the characters
 * Windows forbids in a name, no second colon, and a sane length. A network
 * path (\\server\share) is not accepted: a mapped drive has a letter, and
 * the program lookup only knows drive paths. */
function isAcceptablePath(value) {
  if (typeof value !== 'string' || value.length < 3 || value.length > MAX_PATH_LENGTH) return false;
  if (!/^[A-Za-z]:\\/.test(value)) return false;
  if (/[\u0000-\u001f\u007f<>"|?*]/.test(value)) return false;
  if (value.indexOf(':', 2) !== -1) return false;
  return !value.split('\\').some((segment) => segment === '..');
}

/** `{ request, rejected }`. `request` is `{ kind, path }` or null; `rejected`
 * says why a request that WAS asked for was refused ('duplicate' for more than
 * one, 'missingPath', 'badPath'), and is null when there was no request at all
 * or it was fine. argv[0] is the program and is never read as a flag. Only the
 * two-argument spelling (`--shred <path>`) is accepted. */
function parseOpenRequest(argv) {
  const none = { request: null, rejected: null };
  if (!Array.isArray(argv)) return none;

  const found = [];
  for (let i = 1; i < argv.length; i += 1) {
    const arg = argv[i];
    if (typeof arg !== 'string') continue;
    const match = /^(--shred|--find-program)(=|$)/.exec(arg);
    if (!match) continue;
    if (match[2] === '=') { found.push({ flag: match[1], value: null, joined: true }); continue; }
    found.push({ flag: match[1], value: argv[i + 1], joined: false });
    i += 1; // the value belongs to the flag, whatever it looks like
  }

  if (found.length === 0) return none;
  if (found.length > 1) return { request: null, rejected: 'duplicate' };
  const { flag, value, joined } = found[0];
  if (joined) return { request: null, rejected: 'badPath' };
  if (value === undefined) return { request: null, rejected: 'missingPath' };
  if (!isAcceptablePath(value)) return { request: null, rejected: 'badPath' };
  return { request: { kind: KINDS[flag], path: value }, rejected: null };
}

/** A request fit to send: exactly `{ kind, path }`, both checked. */
function cleanRequest(request) {
  if (!request || typeof request !== 'object') return null;
  if (!KIND_NAMES.has(request.kind) || !isAcceptablePath(request.path)) return null;
  return { kind: request.kind, path: request.path };
}

/** Delivers requests to the page without losing one that arrives early.
 *
 * A launch from Explorer can arrive before the window exists, while it is still
 * loading, or while the page is mid-reload. Until the page says it is
 * listening (`setReady(true)`), requests wait, up to `maxPending` of them (the
 * newest are kept). A send that throws -- the window is going away -- keeps the
 * request and marks the page not ready, so the next page gets it. */
function createOpenRequestRelay({ send, maxPending = 8 }) {
  let ready = false;
  let queue = [];

  function flush() {
    while (ready && queue.length > 0) {
      const next = queue[0];
      try {
        send(next);
      } catch {
        ready = false;
        return;
      }
      queue.shift();
    }
  }

  return {
    handle(request) {
      const clean = cleanRequest(request);
      if (!clean) return;
      queue.push(clean);
      if (queue.length > maxPending) queue = queue.slice(queue.length - maxPending);
      flush();
    },
    setReady(value) {
      ready = value === true;
      flush();
    },
    pending: () => queue.length
  };
}

module.exports = {
  SHRED_FLAG, FIND_FLAG, OPEN_REQUEST_CHANNEL, OPEN_REQUEST_READY_CHANNEL, MAX_PATH_LENGTH,
  isAcceptablePath, parseOpenRequest, cleanRequest, createOpenRequestRelay
};
