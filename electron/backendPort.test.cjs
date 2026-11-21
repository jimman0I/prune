const { test } = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const http = require('node:http');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const {
  PREFERRED_BACKEND_PORT, probePort, portAnswers, chooseBackendPort, createInstanceToken, createNonce, instanceProof,
  verifyBackend, waitForBackend, isPrunePageUrl, ForeignBackendError
} = require('./backendPort.cjs');

/* The 2026-11-20 bug: another program on 3101 meant Prune's window talked to
 * it. These run against real sockets on 127.0.0.1, because the thing being
 * decided is what the operating system says about a port. */

/** A server on a free port, holding it. */
function occupy(handler) {
  const server = handler ? http.createServer(handler) : net.createServer();
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}
const close = (server) => new Promise((resolve) => server.close(resolve));

test('the preferred port is 3101', () => {
  assert.equal(PREFERRED_BACKEND_PORT, 3101);
});

test('a free preferred port is used as it is', async () => {
  const free = await probePort(0);
  const chosen = await chooseBackendPort({ preferred: free });
  assert.deepEqual(chosen, { port: free, fallback: false, reason: null });
});

test('a taken preferred port falls back to a different, free one', async () => {
  const holder = await occupy();
  const taken = holder.address().port;
  try {
    const chosen = await chooseBackendPort({ preferred: taken });
    assert.equal(chosen.fallback, true);
    assert.equal(chosen.reason, 'ANSWERED');
    assert.notEqual(chosen.port, taken);
    assert.ok(chosen.port > 0 && chosen.port < 65536);
    // ...and it really is free: it can be bound.
    assert.equal(await probePort(chosen.port), chosen.port);
    // A holder that binds 127.0.0.1 itself also fails the bind test, which is
    // what catches one that does not accept connections (yet).
    const bindOnly = await chooseBackendPort({ preferred: taken, answers: async () => false });
    assert.equal(bindOnly.reason, 'EADDRINUSE');
    assert.notEqual(bindOnly.port, taken);
  } finally {
    await close(holder);
  }
});

test('a server listening on every address (0.0.0.0 / ::) also makes it fall back', async () => {
  // Windows lets 127.0.0.1:port be bound on top of such a server, but every
  // request made before Prune's backend is up still reaches the other one.
  for (const host of ['0.0.0.0', '::']) {
    const holder = net.createServer();
    await new Promise((resolve) => holder.listen(0, host, resolve));
    const taken = holder.address().port;
    try {
      assert.equal(await portAnswers(taken), true, host);
      const chosen = await chooseBackendPort({ preferred: taken });
      assert.equal(chosen.fallback, true, host);
      assert.equal(chosen.reason, 'ANSWERED', host);
      assert.notEqual(chosen.port, taken, host);
    } finally {
      await close(holder);
    }
  }
});

test('nothing answers on a free port', async () => {
  assert.equal(await portAnswers(await probePort(0)), false);
});

test('a port Windows refuses for another reason (EACCES) also falls back', async () => {
  const calls = [];
  const probe = async (port) => {
    calls.push(port);
    if (port === 3101) throw Object.assign(new Error('denied'), { code: 'EACCES' });
    return 50123;
  };
  assert.deepEqual(await chooseBackendPort({ probe, answers: async () => false }), { port: 50123, fallback: true, reason: 'EACCES' });
  assert.deepEqual(calls, [3101, 0]);
});

test('a fallback port that something answers on is skipped for another', async () => {
  const offered = [50001, 50002];
  const probe = async (port) => (port === 0 ? offered.shift() : port);
  const answers = async (port) => port === 3101 || port === 50001;
  assert.deepEqual(await chooseBackendPort({ probe, answers }), { port: 50002, fallback: true, reason: 'ANSWERED' });
});

test('the token and nonce are fresh random hex each time', () => {
  const a = createInstanceToken();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.notEqual(a, createInstanceToken());
  assert.match(createNonce(), /^[0-9a-f]{32}$/);
});

test('the backend computes the same proof as the main process', async () => {
  const lib = path.join(__dirname, '..', 'backend', 'src', 'lib', 'instanceIdentity.js');
  const backend = await import(pathToFileURL(lib).href);
  const token = createInstanceToken();
  const nonce = createNonce();
  assert.equal(backend.instanceProof(token, nonce), instanceProof(token, nonce));
});

test('the frontend computes the same proof as the main process', async () => {
  const lib = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'backendConnection.js');
  const frontend = await import(pathToFileURL(lib).href);
  const token = createInstanceToken();
  const nonce = createNonce();
  assert.equal(await frontend.expectedProof(token, nonce, globalThis.crypto), instanceProof(token, nonce));
});

/** A backend that knows `token`, as backend/src/lib/instanceIdentity.js does. */
function ownBackend(token) {
  return (req, res) => {
    const nonce = new URL(req.url, 'http://x').searchParams.get('nonce');
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ app: 'prune', proof: instanceProof(token, nonce) }));
  };
}

/** What was on 3101 on 2026-11-20: 401 {"error":"Unauthorized"} to everything. */
function foreignServer(req, res) {
  res.statusCode = 401;
  res.setHeader('Content-Type', 'application/json');
  res.end('{"error":"Unauthorized"}');
}

test('its own backend passes the identity check', async () => {
  const token = createInstanceToken();
  const server = await occupy(ownBackend(token));
  try {
    assert.equal(await verifyBackend({ http, port: server.address().port, token }), true);
  } finally {
    await close(server);
  }
});

test('a foreign server on the port fails the identity check with a clear error', async () => {
  const server = await occupy(foreignServer);
  const port = server.address().port;
  try {
    await assert.rejects(verifyBackend({ http, port, token: createInstanceToken() }), (err) => {
      assert.ok(err instanceof ForeignBackendError);
      assert.match(err.message, new RegExp(`Another program is answering on Prune's port \\(${port}\\)`));
      return true;
    });
  } finally {
    await close(server);
  }
});

test('a server that claims to be Prune but cannot prove it fails too', async () => {
  const server = await occupy((req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ app: 'prune', proof: 'f'.repeat(64) }));
  });
  try {
    await assert.rejects(verifyBackend({ http, port: server.address().port, token: createInstanceToken() }), ForeignBackendError);
  } finally {
    await close(server);
  }
});

test('a backend for a different launch (another token) fails too', async () => {
  const server = await occupy(ownBackend(createInstanceToken()));
  try {
    await assert.rejects(verifyBackend({ http, port: server.address().port, token: createInstanceToken() }), ForeignBackendError);
  } finally {
    await close(server);
  }
});

test('waitForBackend stops at once on a foreign server rather than polling it', async () => {
  const server = await occupy(foreignServer);
  const started = Date.now();
  try {
    await assert.rejects(
      waitForBackend({ http, port: server.address().port, token: createInstanceToken(), timeoutMs: 10_000 }),
      ForeignBackendError
    );
    assert.ok(Date.now() - started < 5000);
  } finally {
    await close(server);
  }
});

test('waitForBackend keeps polling until its own backend is listening', async () => {
  const token = createInstanceToken();
  const port = await probePort(0);
  const server = http.createServer(ownBackend(token));
  setTimeout(() => server.listen(port, '127.0.0.1'), 400);
  try {
    await waitForBackend({ http, port, token, timeoutMs: 10_000, intervalMs: 100 });
  } finally {
    await close(server);
  }
});

test('waitForBackend without a token (development) accepts any answer, as before', async () => {
  const server = await occupy(foreignServer);
  try {
    await waitForBackend({ http, port: server.address().port, token: null, timeoutMs: 5000 });
  } finally {
    await close(server);
  }
});

test('waitForBackend gives up when nothing ever answers', async () => {
  const port = await probePort(0);
  await assert.rejects(waitForBackend({ http, port, token: createInstanceToken(), timeoutMs: 300, intervalMs: 50 }), /did not start in time/);
});

test('only a page Prune loaded is told the token', () => {
  assert.equal(isPrunePageUrl('file:///C:/Program%20Files/Prune/resources/frontend-dist/index.html', { isPackaged: true }), true);
  assert.equal(isPrunePageUrl('https://evil.example.com/', { isPackaged: true }), false);
  assert.equal(isPrunePageUrl('http://localhost:5174/', { isPackaged: true }), false);
  assert.equal(isPrunePageUrl('http://localhost:5174/', { isPackaged: false }), true);
  assert.equal(isPrunePageUrl('http://localhost:5174.evil.com/', { isPackaged: false }), false);
  assert.equal(isPrunePageUrl(undefined, { isPackaged: true }), false);
});
