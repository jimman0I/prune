const net = require('node:net');
const crypto = require('node:crypto');

/* Which port the backend listens on, and how the window knows it is talking
 * to THIS Prune's backend and not to whatever else happens to be there.
 *
 * Real bug (2026-11-20): the backend listened on a fixed 127.0.0.1:3101 and
 * the window called a fixed http://127.0.0.1:3101. Another local dev server
 * was already on 3101, so Prune's own backend could not listen, the window
 * talked to that other server instead, got its 401 {"error":"Unauthorized"},
 * and showed "Couldn't load programs: Unauthorized" -- the app was unusable,
 * and any program on 3101 would have done the same.
 *
 * Two parts, both decided in the main process before the window loads:
 *
 *   THE PORT. 3101 when it is free, so nothing changes for anyone today;
 *   otherwise a free port the system picks (listen on 0). The window is told
 *   which one through its preload (preload.cjs), never by asking the network.
 *
 *   WHO ANSWERS. A random token, made once per launch, is handed to the
 *   backend (in-process, through the environment it reads and then clears)
 *   and to the window (through the preload). Before its first request the
 *   window sends a random nonce to /api/identity and checks the answer is
 *   HMAC-SHA256(token, nonce). The token itself is never sent anywhere, so a
 *   program on the port learns nothing it could answer with, and a server
 *   that is not Prune's gets a clear error instead of being loaded from.
 *
 * Packaged builds only. In development the window keeps calling 3101 with no
 * check, exactly as before: the documented setup runs `npm run dev` in
 * backend/ on 3101 and the Electron window uses it. */

const PREFERRED_BACKEND_PORT = 3101;
const BACKEND_HOST = '127.0.0.1';
const IDENTITY_PATH = '/api/identity';

/** Binds `port` on 127.0.0.1, notes the port that was really bound (the
 * system's choice for 0), and lets it go again. Rejects with the listen
 * error -- EADDRINUSE, or EACCES for a port Windows has reserved. */
function probePort(port, { host = BACKEND_HOST, createServer = net.createServer } = {}) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    // exclusive: a cluster-shared handle would hide a port that is taken.
    server.listen({ port, host, exclusive: true }, () => {
      const bound = server.address().port;
      server.close(() => resolve(bound));
    });
  });
}

/** Does anything accept a connection on 127.0.0.1:port? A bind test alone
 * is not enough on Windows: a server listening on every address (0.0.0.0 or
 * ::, what a bare `app.listen(3101)` does) does not stop Prune binding
 * 127.0.0.1:3101 -- the more specific bind succeeds -- but until Prune's
 * backend is up, which is after the window starts asking, every request to
 * 127.0.0.1:3101 still reaches that other server. Measured on Windows 11. */
function portAnswers(port, { host = BACKEND_HOST, connect = net.connect, timeoutMs = 500 } = {}) {
  return new Promise((resolve) => {
    const socket = connect({ port, host });
    const done = (answered) => { socket.destroy(); resolve(answered); };
    socket.setTimeout(timeoutMs, () => done(true)); // something is there, if slow
    socket.once('connect', () => done(true));
    socket.once('error', () => done(false));
  });
}

/** The port the backend should listen on: `preferred` if nothing answers on
 * it and it can be bound, otherwise a free one. `{ port, fallback, reason }`,
 * where `reason` says what made 3101 unusable: 'ANSWERED' (another program is
 * serving on it) or the bind error's code (EADDRINUSE, or EACCES for a port
 * Windows has reserved). The free port is released here and bound by the
 * backend a moment later; something taking it in between is vanishingly
 * unlikely and is still caught, by the identity check. */
async function chooseBackendPort({
  preferred = PREFERRED_BACKEND_PORT, probe = probePort, answers = portAnswers, attempts = 5
} = {}) {
  let reason = 'ANSWERED';
  if (!(await answers(preferred))) {
    try {
      return { port: await probe(preferred), fallback: false, reason: null };
    } catch (err) {
      reason = err?.code ?? 'unknown';
    }
  }
  for (let i = 0; i < attempts; i += 1) {
    const port = await probe(0);
    if (!(await answers(port))) return { port, fallback: true, reason };
  }
  throw new Error('No free port could be found for the backend.');
}

/** A new random token for this launch. 64 hex characters. */
function createInstanceToken() {
  return crypto.randomBytes(32).toString('hex');
}

/** A new random nonce for one identity check. 32 hex characters, inside the
 * backend's accepted shape (backend/src/lib/instanceIdentity.js). */
function createNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/** What the backend answers for `nonce`. Must stay identical to
 * instanceProof() in backend/src/lib/instanceIdentity.js and expectedProof()
 * in frontend/src/lib/backendConnection.js; backendPort.test.cjs checks all
 * three agree. */
function instanceProof(token, nonce) {
  return crypto.createHmac('sha256', token).update(`prune-backend:${nonce}`).digest('hex');
}

function proofMatches(expected, actual) {
  if (typeof actual !== 'string' || actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

/** One GET to 127.0.0.1:port. Resolves `{ status, text }`; rejects when
 * nothing answers (the backend not listening yet) or on timeout. */
function getOnce({ http, port, path, timeoutMs = 1500 }) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: BACKEND_HOST, port, path, agent: false, timeout: timeoutMs }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { text += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, text }));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timed out')));
    req.on('error', reject);
  });
}

class ForeignBackendError extends Error {
  constructor(port) {
    super(`Another program is answering on Prune's port (${port}), so Prune is not using it. Restart Prune.`);
    this.name = 'ForeignBackendError';
    this.code = 'FOREIGN_BACKEND';
    this.port = port;
  }
}

/** Is the server on `port` this launch's backend? Resolves true, or rejects
 * with ForeignBackendError when something else answered; rejects with the
 * connection error when nothing did. */
async function verifyBackend({ http, port, token, nonce = createNonce() }) {
  const { status, text } = await getOnce({ http, port, path: `${IDENTITY_PATH}?nonce=${nonce}` });
  let body = null;
  try { body = JSON.parse(text); } catch { /* not JSON: not ours */ }
  if (status !== 200 || body?.app !== 'prune' || !proofMatches(instanceProof(token, nonce), body?.proof)) {
    throw new ForeignBackendError(port);
  }
  return true;
}

/** Polls until the backend answers, so the start-up sequence knows it is up.
 * With a token, "answers" means proves it is this launch's backend; a server
 * that answers wrongly ends the wait at once (it is not going to become
 * Prune). Without one (development), any answer to /api/health will do, as
 * before. */
function waitForBackend({ http, port, token = null, timeoutMs = 15000, intervalMs = 300 }) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const attempt = token
        ? verifyBackend({ http, port, token })
        : getOnce({ http, port, path: '/api/health' });
      attempt.then(() => resolve(), (err) => {
        if (err instanceof ForeignBackendError) { reject(err); return; }
        if (Date.now() > deadline) { reject(new Error('Backend did not start in time.')); return; }
        setTimeout(tryOnce, intervalMs);
      });
    };
    tryOnce();
  });
}

/** Only a page Prune itself loads may be told the token: the packaged
 * frontend (file://) or, in development, the Vite server. */
function isPrunePageUrl(url, { isPackaged }) {
  if (typeof url !== 'string') return false;
  if (isPackaged) return url.startsWith('file://');
  return url.startsWith('http://localhost:5174/') || url === 'http://localhost:5174';
}

module.exports = {
  PREFERRED_BACKEND_PORT,
  BACKEND_HOST,
  IDENTITY_PATH,
  probePort,
  portAnswers,
  chooseBackendPort,
  createInstanceToken,
  createNonce,
  instanceProof,
  verifyBackend,
  waitForBackend,
  isPrunePageUrl,
  ForeignBackendError
};
