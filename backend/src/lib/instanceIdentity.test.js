import { describe, it, expect, afterEach } from 'vitest';
import { createHmac, randomBytes } from 'node:crypto';
import { startTestServer } from '../testSupport/routeServer.js';
import { instanceProof } from './instanceIdentity.js';

/* /api/identity: how the window tells this launch's backend from another
 * program on the same port (the 2026-11-20 bug). Through the real server and
 * middleware stack, so the localOnly guard is exercised too. */

const token = randomBytes(32).toString('hex');
const nonce = randomBytes(16).toString('hex');
let server;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe('instanceProof', () => {
  it('is HMAC-SHA256 of the nonce under the token', () => {
    const expected = createHmac('sha256', token).update(`prune-backend:${nonce}`).digest('hex');
    expect(instanceProof(token, nonce)).toBe(expected);
  });

  it('differs for another token or another nonce', () => {
    expect(instanceProof(token, nonce)).not.toBe(instanceProof(randomBytes(32).toString('hex'), nonce));
    expect(instanceProof(token, nonce)).not.toBe(instanceProof(token, randomBytes(16).toString('hex')));
  });
});

describe('GET /api/identity', () => {
  it('answers the nonce with the proof, never with the token', async () => {
    server = await startTestServer({ instanceToken: token });
    const res = await server.call(`/identity?nonce=${nonce}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ app: 'prune', proof: instanceProof(token, nonce) });
    expect(JSON.stringify(res.body)).not.toContain(token);
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('answers proof: null when the backend was started without a token (development)', async () => {
    server = await startTestServer();
    const res = await server.call(`/identity?nonce=${nonce}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ app: 'prune', proof: null });
  });

  it.each([
    ['missing', ''],
    ['too short', '?nonce=abc'],
    ['too long', `?nonce=${'a'.repeat(129)}`],
    ['odd characters', '?nonce=aaaaaaaaaaaaaaaa%3Cscript%3E'],
    ['repeated', `?nonce=${nonce}&nonce=${nonce}`]
  ])('refuses a nonce that is %s', async (_label, query) => {
    server = await startTestServer({ instanceToken: token });
    const res = await server.call(`/identity${query}`);
    expect(res.status).toBe(400);
    expect(res.body.proof).toBeUndefined();
  });

  it('stays behind the localOnly guard: a web page is refused', async () => {
    server = await startTestServer({ instanceToken: token });
    const res = await server.callAsWebPage(`/identity?nonce=${nonce}`);
    expect(res.status).toBe(403);
    expect(res.body.proof).toBeUndefined();
  });

  it('stays behind the localOnly guard: a rebinding Host header is refused', async () => {
    server = await startTestServer({ instanceToken: token });
    expect(await server.statusWithHost(`evil.example.com:${server.port}`, `/identity?nonce=${nonce}`)).toBe(403);
  });
});
