import { createHmac } from 'node:crypto';

/** How Prune's window knows it reached THIS launch's backend.
 *
 * The Electron main process makes a random token per launch and hands it to
 * the backend (UNREVO_INSTANCE_TOKEN, read once by index.js and cleared) and
 * to the window. The window sends a random nonce here and checks the answer
 * against HMAC-SHA256(token, nonce) before its first real request, so a
 * different program listening on the port -- the 2026-11-20 bug, where a dev
 * server on 3101 answered every request with 401 -- is caught and named
 * instead of loaded from. The token itself never crosses the wire. See
 * electron/backendPort.cjs.
 *
 * Behind localOnly like every other route: it tells a web page nothing even
 * if one could reach it, and the guard is not loosened for it. Without a
 * token (the backend started on its own, in development) it answers with
 * `proof: null`, and the window, which has no token either, does not ask. */

/** The nonce's accepted shape: what the window and main.cjs send (hex) with
 * room to spare, and nothing that needs escaping. */
const NONCE_SHAPE = /^[A-Za-z0-9_-]{16,128}$/;

export function instanceProof(token, nonce) {
  return createHmac('sha256', token).update(`prune-backend:${nonce}`).digest('hex');
}

export function identityRoute(token) {
  return (req, res) => {
    const { nonce } = req.query;
    if (typeof nonce !== 'string' || !NONCE_SHAPE.test(nonce)) {
      res.status(400).json({ error: 'A nonce of 16 to 128 letters, digits, "-" or "_" is required.' });
      return;
    }
    res.set('Cache-Control', 'no-store');
    res.json({ app: 'prune', proof: token ? instanceProof(token, nonce) : null });
  };
}
