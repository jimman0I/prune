import { describe, it, expect, vi, afterEach } from 'vitest';
import { createHmac, webcrypto } from 'node:crypto';
import {
  DEFAULT_BACKEND_PORT, backendInfo, apiUrlFor, expectedProof, verifyBackend, createApiFetch, ForeignBackendError
} from './backendConnection.js';

/* The 2026-11-20 bug: another program had 127.0.0.1:3101 and answered every
 * request with 401 {"error":"Unauthorized"}; the window loaded from it and
 * showed "Couldn't load programs: Unauthorized". */

const TOKEN = 'a'.repeat(64);
const PORT = 50123;
const BASE = apiUrlFor(PORT);

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const nonceOf = (url) => new URL(url).searchParams.get('nonce');
const proofFor = (token, nonce) => createHmac('sha256', token).update(`prune-backend:${nonce}`).digest('hex');

/** Prune's own backend for TOKEN: proves itself, then answers `answer`. */
function ownBackend(answer = json(200, { programs: [] })) {
  return vi.fn(async (url) => (String(url).includes('/identity?')
    ? json(200, { app: 'prune', proof: proofFor(TOKEN, nonceOf(url)) })
    : answer));
}

/** What was on 3101: 401 Unauthorized to everything. */
const foreignServer = () => vi.fn(async () => json(401, { error: 'Unauthorized' }));

afterEach(() => vi.unstubAllGlobals());

describe('backendInfo', () => {
  it('is 3101 with no token when there is no preload (a browser, a test)', () => {
    expect(backendInfo(undefined)).toEqual({ port: DEFAULT_BACKEND_PORT, token: null });
    expect(backendInfo({})).toEqual({ port: 3101, token: null });
  });

  it('takes the port and token the preload was given', () => {
    expect(backendInfo({ pruneWindow: { backend: { port: PORT, token: TOKEN } } })).toEqual({ port: PORT, token: TOKEN });
  });

  it('keeps 3101 when the preload had no port (development)', () => {
    expect(backendInfo({ pruneWindow: { backend: { port: null, token: null } } })).toEqual({ port: 3101, token: null });
  });

  it.each([0, -1, 65536, 3101.5, '3101', NaN])('ignores an unusable port %s', (port) => {
    expect(backendInfo({ pruneWindow: { backend: { port } } }).port).toBe(3101);
  });

  it('builds the API base on 127.0.0.1 only', () => {
    expect(apiUrlFor(PORT)).toBe('http://127.0.0.1:50123/api');
  });
});

describe('expectedProof', () => {
  it('matches the backend: HMAC-SHA256 of "prune-backend:<nonce>" under the token', async () => {
    expect(await expectedProof(TOKEN, 'abc123', webcrypto)).toBe(proofFor(TOKEN, 'abc123'));
  });
});

describe('verifyBackend', () => {
  it('passes its own backend, and never sends the token', async () => {
    const fetchImpl = ownBackend();
    await verifyBackend({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toMatch(/^http:\/\/127\.0\.0\.1:50123\/api\/identity\?nonce=[0-9a-f]{32}$/);
    expect(url).not.toContain(TOKEN);
    expect(init).toBeUndefined();
  });

  it('a fresh nonce every time', async () => {
    const fetchImpl = ownBackend();
    await verifyBackend({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto });
    await verifyBackend({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto });
    expect(nonceOf(fetchImpl.mock.calls[0][0])).not.toBe(nonceOf(fetchImpl.mock.calls[1][0]));
  });

  it('refuses the 401 server with a clear error', async () => {
    await expect(verifyBackend({ base: BASE, port: PORT, token: TOKEN, fetchImpl: foreignServer(), cryptoImpl: webcrypto }))
      .rejects.toThrow(new ForeignBackendError(PORT).message);
  });

  it.each([
    ['says it is Prune but has the wrong proof', json(200, { app: 'prune', proof: 'f'.repeat(64) })],
    ['is a Prune backend started without a token', json(200, { app: 'prune', proof: null })],
    ['is some other app', json(200, { ok: true })],
    ['answers 404', json(404, { error: 'Not found' })]
  ])('refuses a server that %s', async (_label, answer) => {
    const err = await verifyBackend({ base: BASE, port: PORT, token: TOKEN, fetchImpl: async () => answer, cryptoImpl: webcrypto })
      .catch((e) => e);
    expect(err).toBeInstanceOf(ForeignBackendError);
    expect(err.reason).toBe('foreign-backend');
  });

  it('refuses an answer that is not JSON', async () => {
    const fetchImpl = async () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } });
    await expect(verifyBackend({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto }))
      .rejects.toBeInstanceOf(ForeignBackendError);
  });
});

describe('createApiFetch', () => {
  it('without a token is plain fetch: same arguments, called at once', () => {
    const fetchImpl = vi.fn(() => 'response');
    const apiFetch = createApiFetch({ base: BASE, port: PORT, token: null, fetchImpl });
    expect(apiFetch('http://127.0.0.1:3101/api/programs', { method: 'POST' })).toBe('response');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith('http://127.0.0.1:3101/api/programs', { method: 'POST' });
  });

  it('with a token, checks once and then forwards every request', async () => {
    const fetchImpl = ownBackend();
    const apiFetch = createApiFetch({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto });
    await Promise.all([apiFetch(`${BASE}/programs`), apiFetch(`${BASE}/stats`)]);
    await apiFetch(`${BASE}/settings`, { method: 'GET' });
    const urls = fetchImpl.mock.calls.map(([url]) => url);
    expect(urls.filter((u) => u.includes('/identity?'))).toHaveLength(1);
    expect(urls.slice(1)).toEqual([`${BASE}/programs`, `${BASE}/stats`, `${BASE}/settings`]);
    expect(fetchImpl.mock.calls[3][1]).toEqual({ method: 'GET' });
  });

  it('never forwards a request to a foreign server, and says why', async () => {
    const fetchImpl = foreignServer();
    const apiFetch = createApiFetch({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto });
    await expect(apiFetch(`${BASE}/programs`)).rejects.toBeInstanceOf(ForeignBackendError);
    await expect(apiFetch(`${BASE}/quarantine/empty`, { method: 'POST' })).rejects.toBeInstanceOf(ForeignBackendError);
    expect(fetchImpl.mock.calls.every(([url]) => url.includes('/identity?'))).toBe(true);
  });

  it('a backend that is still starting is asked again by the next request', async () => {
    const own = ownBackend();
    let up = false;
    const fetchImpl = vi.fn(async (url, init) => {
      if (!up) throw new TypeError('Failed to fetch');
      return own(url, init);
    });
    const apiFetch = createApiFetch({ base: BASE, port: PORT, token: TOKEN, fetchImpl, cryptoImpl: webcrypto });
    await expect(apiFetch(`${BASE}/programs`)).rejects.toThrow('Failed to fetch');
    up = true;
    await expect(apiFetch(`${BASE}/programs`)).resolves.toMatchObject({ status: 200 });
    expect(own.mock.calls.map(([url]) => url.includes('/identity?'))).toEqual([true, false]);
  });

  it('uses the global fetch at call time, so a test stub is seen', async () => {
    const stub = vi.fn(async () => json(200, {}));
    vi.stubGlobal('fetch', stub);
    const apiFetch = createApiFetch({ base: BASE, port: PORT, token: null });
    await apiFetch('x');
    expect(stub).toHaveBeenCalledWith('x');
  });
});

describe('api.js with the preload in place', () => {
  async function loadApi(backend, fetchStub) {
    vi.resetModules();
    vi.stubGlobal('window', { pruneWindow: { backend } });
    vi.stubGlobal('fetch', fetchStub);
    return import('./api.js');
  }

  it('calls the port the main process chose', async () => {
    const fetchStub = vi.fn(async () => json(200, { programs: [{ id: 'x' }] }));
    const api = await loadApi({ port: PORT, token: null }, fetchStub);
    await expect(api.fetchPrograms()).resolves.toEqual([{ id: 'x' }]);
    expect(fetchStub).toHaveBeenCalledWith(`${BASE}/programs`);
  });

  it('Applications gets the clear error, not "Unauthorized", from a foreign server', async () => {
    const api = await loadApi({ port: 3101, token: TOKEN }, foreignServer());
    const err = await api.fetchPrograms().catch((e) => e);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("Another program is answering on Prune's port (3101), so Prune is not using it. Restart Prune.");
    expect(err.message).not.toContain('Unauthorized');
  });

  it('loads normally from its own backend on a fallback port', async () => {
    const api = await loadApi({ port: PORT, token: TOKEN }, ownBackend(json(200, { programs: [{ id: 'y' }] })));
    await expect(api.fetchPrograms()).resolves.toEqual([{ id: 'y' }]);
  });
});
