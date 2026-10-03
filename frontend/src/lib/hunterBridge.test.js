import { describe, it, expect, afterEach, vi } from 'vitest';
import { startHunter, cancelHunter, onHunterResult } from './hunterBridge.js';

afterEach(() => { delete globalThis.window; });

const withBridge = (hunter) => { globalThis.window = { pruneWindow: { hunter } }; };
const labels = { hint: 'Drag onto a window', cancel: 'Cancel' };

describe('the Hunter crosshair bridge', () => {
  it('is unavailable outside the desktop app, where there is no bridge', async () => {
    globalThis.window = {};
    expect(await startHunter(labels)).toEqual({ ok: false, unsupported: true });
    expect(await cancelHunter()).toEqual({ ok: false, unsupported: true });
    expect(onHunterResult(() => {})()).toBeUndefined(); // an unsubscribe that does nothing
  });

  it('is unavailable when there is no window at all', async () => {
    delete globalThis.window;
    expect(await startHunter(labels)).toEqual({ ok: false, unsupported: true });
  });

  it('sends the two labels and nothing else when it starts', async () => {
    const start = vi.fn(async () => ({ ok: true }));
    withBridge({ start });
    expect(await startHunter({ ...labels, exe: 'x', x: 5 })).toEqual({ ok: true });
    expect(start).toHaveBeenCalledWith({ hint: 'Drag onto a window', cancel: 'Cancel' });
  });

  it('turns a rejected request into an error result instead of throwing', async () => {
    withBridge({ start: async () => { throw new Error('Not a request from Prune.'); }, cancel: async () => { throw new Error('gone'); } });
    expect(await startHunter(labels)).toEqual({ ok: false, error: 'Not a request from Prune.' });
    expect(await cancelHunter()).toEqual({ ok: false, error: 'gone' });
  });

  it('cancels through the main process', async () => {
    withBridge({ cancel: async () => ({ ok: true, cancelled: true }) });
    expect(await cancelHunter()).toEqual({ ok: true, cancelled: true });
  });

  it('hears results, and stops hearing them when unsubscribed', () => {
    let listener;
    const off = vi.fn();
    withBridge({ onResult: (cb) => { listener = cb; return off; } });
    const seen = [];
    const unsubscribe = onHunterResult((r) => seen.push(r));
    listener({ status: 'nothing' });
    expect(seen).toEqual([{ status: 'nothing' }]);
    unsubscribe();
    expect(off).toHaveBeenCalled();
  });
});
