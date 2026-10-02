import { describe, it, expect, afterEach } from 'vitest';
import { canRestartAsAdmin, restartAsAdmin } from './adminRelaunch.js';

afterEach(() => { delete globalThis.window; });

const withBridge = (admin) => { globalThis.window = { pruneWindow: { admin } }; };

describe('the restart-as-administrator bridge', () => {
  it('is unavailable outside the desktop app, where there is no bridge', async () => {
    globalThis.window = {};
    expect(await canRestartAsAdmin()).toBe(false);
    expect(await restartAsAdmin()).toEqual({ ok: false, unsupported: true });
  });

  it('is unavailable when there is no window at all', async () => {
    delete globalThis.window;
    expect(await canRestartAsAdmin()).toBe(false);
  });

  it('asks the main process, and only says yes to a real true', async () => {
    withBridge({ canRelaunch: async () => true });
    expect(await canRestartAsAdmin()).toBe(true);
    withBridge({ canRelaunch: async () => 'yes' });
    expect(await canRestartAsAdmin()).toBe(false);
    withBridge({ canRelaunch: async () => { throw new Error('ipc gone'); } });
    expect(await canRestartAsAdmin()).toBe(false);
  });

  it('passes the main process\'s answer through', async () => {
    withBridge({ relaunch: async () => ({ ok: false, cancelled: true }) });
    expect(await restartAsAdmin()).toEqual({ ok: false, cancelled: true });
  });

  it('turns a rejected request into an error result instead of throwing', async () => {
    withBridge({ relaunch: async () => { throw new Error('Not a request from Prune.'); } });
    expect(await restartAsAdmin()).toEqual({ ok: false, error: 'Not a request from Prune.' });
  });
});
