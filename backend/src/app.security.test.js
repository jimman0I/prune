import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestServer } from './testSupport/routeServer.js';

/** The localOnly middleware, exercised through a real HTTP server.
 *
 * lib/localOnly.test.js already covers isTrustedRequest as a function.
 * This covers the thing that actually protects the user: that the
 * middleware is mounted, that it is mounted ahead of every route, and
 * that a refused request never reaches a handler. A correct predicate
 * wired in after express.json(), or mounted on only some routers, would
 * pass that unit test and leave the hole open.
 */

const emptyQuarantine = vi.fn(async () => ({ ok: true, removed: [] }));
const quarantinePath = vi.fn(async () => ({ ok: true }));

vi.mock('./services/quarantine.js', async (importOriginal) => ({
  ...(await importOriginal()),
  emptyQuarantine: (...args) => emptyQuarantine(...args)
}));

vi.mock('./services/quarantinePath.js', () => ({
  quarantinePath: (...args) => quarantinePath(...args)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });

describe("the API is reachable only by Prune's own window", () => {
  it('answers its own window, which sends no Origin', async () => {
    const res = await server.call('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('REFUSES a request from a web page', async () => {
    const res = await server.callAsWebPage('/health');
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/its own window/);
  });

  it('refuses on every route, not just the ones someone remembered', async () => {
    // The failure this catches is a guard mounted per-router. Each of
    // these reads or changes something the user would not want a website
    // to have: what they have installed, what is on their disk, what
    // launches at sign-in, and their settings.
    const paths = [
      '/programs',
      '/programs/startup',
      '/settings',
      '/quarantine',
      '/disk-space',
      '/disk-scan?path=C:%5C',
      '/duplicates?path=C:%5CUsers',
      '/resources',
      '/automation'
    ];
    for (const path of paths) {
      const res = await server.callAsWebPage(path);
      expect(res.status, `${path} should have been refused`).toBe(403);
    }
  });

  it('refuses BEFORE the handler runs, so nothing is destroyed on the way to the 403', async () => {
    // The point of ordering the middleware ahead of the routes. A guard
    // that answered 403 after emptyQuarantine() had already run would
    // look identical from outside and would still have destroyed every
    // undo the app holds.
    const res = await server.callAsWebPage('/quarantine/empty', { method: 'POST' });
    expect(res.status).toBe(403);
    expect(emptyQuarantine).not.toHaveBeenCalled();

    const moved = await server.callAsWebPage('/quarantine/path', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: 'C:\\Users\\someone\\Documents' })
    });
    expect(moved.status).toBe(403);
    expect(quarantinePath).not.toHaveBeenCalled();
  });

  it('REFUSES a spoofed Host, which is what DNS rebinding looks like', async () => {
    // The attack a correct Origin check does not stop: an attacker's
    // domain made to resolve to 127.0.0.1, so the browser believes it is
    // same-origin and sends no Origin at all. What it cannot hide is the
    // Host header, which still carries the attacker's name.
    expect(await server.statusWithHost('evil.example.com')).toBe(403);
    expect(await server.statusWithHost(`evil.example.com:${server.port}`)).toBe(403);
    expect(await server.statusWithHost(`prune.local:${server.port}`)).toBe(403);
    // And the spellings that are genuinely us still work.
    expect(await server.statusWithHost(`127.0.0.1:${server.port}`)).toBe(200);
    expect(await server.statusWithHost(`localhost:${server.port}`)).toBe(200);
  });

  it('does not answer with a wildcard allow-origin', async () => {
    // The header the server used to send unconditionally. `*` on a
    // loopback API is a standing invitation to every page the user has
    // open, and it is what made the routes above reachable at all.
    const res = await server.call('/health');
    expect(res.headers.get('access-control-allow-origin')).not.toBe('*');
  });

  it('refuses a preflight from a web page too', async () => {
    // Without this the browser would be told the POST is permitted and
    // would send it; the request would then be refused, but the app would
    // have advertised an opening it does not have.
    const res = await server.callAsWebPage('/quarantine/empty', {
      method: 'OPTIONS',
      headers: {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
      }
    });
    expect(res.status).toBe(403);
  });
});
