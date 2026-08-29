import { describe, it, expect, afterEach } from 'vitest';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Real bug, found dogfooding (2026-08-29): a port conflict on
// server.listen() (most commonly a second copy of this exact backend
// already running) fired as an unhandled 'error' event, crashing the
// whole process silently — inside Electron specifically, this crashed
// the ENTIRE APP during startup with no window and no visible reason
// beyond a native crash dialog. This is a real child-process integration
// test (spawn the real entry point twice, the same way the real bug
// actually reproduced), not a mock — a mocked http.Server would prove
// nothing about the actual 'error' event wiring this bug lived in.
const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = join(__dirname, 'index.js');
const TEST_PORT = '58421'; // arbitrary, unlikely to collide with a real dev server

function spawnBackend() {
  return spawn(process.execPath, [entry], {
    env: { ...process.env, UNREVO_BACKEND_PORT: TEST_PORT },
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function waitForOutput(child, matcher, timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let out = '';
    const cleanup = () => {
      clearTimeout(timer);
      child.stdout.off('data', onData);
      child.stderr.off('data', onData);
    };
    const onData = (chunk) => {
      out += chunk.toString();
      if (matcher.test(out)) { cleanup(); resolve(out); }
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error(`Timed out waiting for output matching ${matcher}. Got: ${out}`)); }, timeoutMs);
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
  });
}

describe('backend server startup', () => {
  let procs = [];

  afterEach(() => {
    for (const p of procs) { if (!p.killed) p.kill(); }
    procs = [];
  });

  it('logs a clear, actionable message and does not crash when the port is already in use', async () => {
    const first = spawnBackend();
    procs.push(first);
    await waitForOutput(first, /listening on/i);

    const second = spawnBackend();
    procs.push(second);
    const output = await waitForOutput(second, /already in use/i);
    expect(output).toMatch(new RegExp(TEST_PORT));

    // The second process is still alive to be cleaned up, not already
    // dead from an uncaught exception — proving the crash is actually
    // prevented, not just that SOME message happened to print before
    // the old crash.
    expect(second.exitCode).toBeNull();
  }, 10000);
});
