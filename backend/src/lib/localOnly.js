/** Keeping this API reachable only by Prune's own window.
 *
 * The backend is an HTTP server on 127.0.0.1, and "only listens on
 * loopback" is not the protection it sounds like: every web page the user
 * has open can reach loopback too. Before this file, the server sent
 * `Access-Control-Allow-Origin: *` on every response and checked nothing,
 * which meant any site the user was browsing could -- with one fetch --
 * read their installed programs and disk contents, toggle their startup
 * entries, run a Deep Clean, move a folder through /quarantine/path, or
 * POST /quarantine/empty and destroy every undo the app holds.
 *
 * Two checks, because either alone is bypassable:
 *
 *   ORIGIN. Browsers attach it to every cross-origin request and a page
 *   cannot forge it. Prune's own window loads from file://, which sends
 *   no Origin or the literal "null"; a website sends its own.
 *
 *   HOST. Defeats DNS rebinding, where an attacker's domain is made to
 *   resolve to 127.0.0.1 so the browser believes it is same-origin and
 *   sends no Origin at all. The Host header still carries the attacker's
 *   name, and a real request from this app never does.
 *
 * This does not stop another program running as the same user. Nothing
 * can: a process with the user's privileges can delete their files
 * directly, and the API grants it nothing it did not already have.
 */

/** Where the UI legitimately comes from. `file://` is the packaged app;
 * the two localhost ports are the Vite dev server. */
const TRUSTED_ORIGINS = new Set([
  'null',
  'file://',
  'http://localhost:5174',
  'http://127.0.0.1:5174'
]);

/** Compared whole, never by prefix. "http://localhost:5174.evil.com" is a
 * domain an attacker can register, and startsWith would welcome it. */
function originAllowed(origin) {
  if (origin === undefined || origin === null || origin === '') return true;
  return TRUSTED_ORIGINS.has(String(origin).trim().toLowerCase());
}

/** Loopback, on our own port, and nothing else. */
function hostAllowed(host, port) {
  if (!host) return false;
  const value = String(host).trim().toLowerCase();
  return value === `127.0.0.1:${port}`
    || value === `localhost:${port}`
    || value === `[::1]:${port}`;
}

export function isTrustedRequest({ origin, host } = {}, { port } = {}) {
  return originAllowed(origin) && hostAllowed(host, port);
}

/** Express middleware. Refuses with 403 and a body that says why, because
 * the one person who will ever see it is a developer wondering where
 * their request went. */
export function localOnly(port) {
  return (req, res, next) => {
    if (isTrustedRequest({ origin: req.headers.origin, host: req.headers.host }, { port })) {
      return next();
    }
    res.status(403).json({
      error: 'Prune only accepts requests from its own window.'
    });
  };
}
