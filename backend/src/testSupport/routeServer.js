import { createServer } from 'node:http';
import { connect } from 'node:net';
import { createApp } from '../app.js';

/** A real server on a real ephemeral port, for testing routes.
 *
 * Not supertest: this is the actual http server with the actual
 * middleware stack, which matters because the layer being tested IS the
 * middleware -- localOnly, the CORS reflector, express.json and the
 * routes' own validation. A harness that mounted the routes directly
 * would skip the exact code that had the security hole in it.
 *
 * The port has to exist before the app does, because localOnly checks
 * the Host header against it. Creating the server first and attaching the
 * app as a request listener afterwards resolves that without guessing a
 * port and hoping it is free -- an Express app is just a request handler.
 */
export async function startTestServer() {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

  const { port } = server.address();
  server.on('request', createApp({ port }));

  const base = `http://127.0.0.1:${port}/api`;

  return {
    port,
    base,
    /** Requests as Prune's own window does: from file://, so no Origin. */
    async call(path, options = {}) {
      const res = await fetch(base + path, options);
      const text = await res.text();
      let body = null;
      try { body = text ? JSON.parse(text) : null; } catch { body = text; }
      return { status: res.status, body, headers: res.headers };
    },
    /** Requests as a web page would. */
    async callAsWebPage(path, options = {}) {
      return this.call(path, {
        ...options,
        headers: { ...(options.headers || {}), Origin: 'https://evil.example.com' }
      });
    },
    /** Requests with a Host header of our choosing, which is what DNS
     * rebinding looks like on the wire.
     *
     * A raw socket rather than fetch(), because Host is a forbidden
     * header: fetch silently ignores an attempt to set it and sends the
     * real authority instead, so a rebinding test written with fetch
     * proves nothing. Returns the status line's code. */
    async statusWithHost(host, path = '/health') {
      return new Promise((resolve) => {
        const socket = connect(port, '127.0.0.1', () => {
          socket.write(
            `GET /api${path} HTTP/1.1\r\nHost: ${host}\r\nConnection: close\r\n\r\n`
          );
        });
        let data = '';
        socket.on('data', (chunk) => { data += chunk.toString(); });
        socket.on('end', () => resolve(Number(data.split(' ')[1])));
        socket.on('error', () => resolve(0));
      });
    },
    async close() {
      await new Promise((resolve) => server.close(resolve));
    }
  };
}
