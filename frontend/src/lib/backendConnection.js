/** Where the window's backend is, and making sure it is Prune's own.
 *
 * Real bug (2026-11-20): the window called a fixed http://127.0.0.1:3101.
 * Another local dev server already had that port, so Prune's own backend
 * could not listen there, and the window loaded from the other server instead
 * -- "Couldn't load programs: Unauthorized", from a 401 that was never Prune's.
 *
 * Now the packaged app's main process chooses the port (3101 unless something
 * else has it) and makes a random token per launch; the preload hands both to
 * this page as `window.pruneWindow.backend` (electron/preload.cjs,
 * electron/backendPort.cjs). Before the first request, apiFetch sends a random
 * nonce to /api/identity and checks the answer is HMAC-SHA256(token, nonce).
 * The token is never sent: a program on the port learns nothing it could
 * answer with. Anything that answers wrongly is refused with a clear error,
 * and nothing it sends is used.
 *
 * Without a token -- development, where `npm run dev` serves the backend on
 * 3101, or a test -- there is no check and apiFetch is plain fetch, as
 * before. */

export const DEFAULT_BACKEND_PORT = 3101;

/** `{ port, token }` from the preload, with anything that is not a usable
 * port or token replaced by the defaults (3101, no token). */
export function backendInfo(win = globalThis.window) {
  const given = win?.pruneWindow?.backend;
  const port = Number.isInteger(given?.port) && given.port > 0 && given.port < 65536
    ? given.port
    : DEFAULT_BACKEND_PORT;
  const token = typeof given?.token === 'string' && given.token ? given.token : null;
  return { port, token };
}

export function apiUrlFor(port) {
  return `http://127.0.0.1:${port}/api`;
}

/** The server on Prune's port is not Prune's backend. `reason` lets a screen
 * tell it apart from an ordinary failed request. */
export class ForeignBackendError extends Error {
  constructor(port) {
    super(`Another program is answering on Prune's port (${port}), so Prune is not using it. Restart Prune.`);
    this.name = 'ForeignBackendError';
    this.reason = 'foreign-backend';
    this.port = port;
  }
}

function toHex(bytes) {
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('');
}

function randomNonce(cryptoImpl) {
  return toHex(cryptoImpl.getRandomValues(new Uint8Array(16)));
}

/** What Prune's backend answers for `nonce`. Must stay identical to
 * instanceProof() in backend/src/lib/instanceIdentity.js and
 * electron/backendPort.cjs. */
export async function expectedProof(token, nonce, cryptoImpl = globalThis.crypto) {
  const encoder = new TextEncoder();
  const key = await cryptoImpl.subtle.importKey(
    'raw', encoder.encode(token), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  return toHex(await cryptoImpl.subtle.sign('HMAC', key, encoder.encode(`prune-backend:${nonce}`)));
}

/** Compares every character, so how long it took says nothing about where
 * a wrong proof first differed. */
function sameText(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Resolves when the server at `base` proves it holds `token`; rejects with
 * ForeignBackendError when it answers anything else, and with fetch's own
 * error when nothing answers (the backend still starting). */
export async function verifyBackend({ base, port, token, fetchImpl, cryptoImpl = globalThis.crypto }) {
  const nonce = randomNonce(cryptoImpl);
  const res = await fetchImpl(`${base}/identity?nonce=${nonce}`);
  let body = null;
  try { body = await res.json(); } catch { /* not JSON: not ours */ }
  if (!res.ok || body?.app !== 'prune' || !sameText(await expectedProof(token, nonce, cryptoImpl), body?.proof)) {
    throw new ForeignBackendError(port);
  }
}

/** fetch, behind the identity check when there is a token.
 *
 * The check runs once, before the first request, and every request waits on
 * it. Only a success is kept: a backend that is still starting (nothing
 * answers yet) is asked again by the next request, and so is a foreign one,
 * which fails each request with the same clear error and is never forwarded
 * to. Without a token this IS fetch -- same arguments, same timing. */
export function createApiFetch({
  base,
  port,
  token,
  fetchImpl = (...args) => globalThis.fetch(...args),
  cryptoImpl = globalThis.crypto
}) {
  if (!token) return (...args) => fetchImpl(...args);
  let verified = null;
  return async (...args) => {
    if (!verified) {
      verified = verifyBackend({ base, port, token, fetchImpl, cryptoImpl }).catch((err) => {
        verified = null;
        throw err;
      });
    }
    await verified;
    return fetchImpl(...args);
  };
}

const { port: BACKEND_PORT, token: BACKEND_TOKEN } = backendInfo();

/** The window's API base and its fetch, shared by api.js and
 * programSourcesApi.js so the check runs once for both. */
export const API_URL = apiUrlFor(BACKEND_PORT);
export const apiFetch = createApiFetch({ base: API_URL, port: BACKEND_PORT, token: BACKEND_TOKEN });
