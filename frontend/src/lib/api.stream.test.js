import { describe, it, expect, beforeEach, vi } from 'vitest';
import { streamUninstall, removeQuarantined } from './api.js';

/** streamUninstall, and what an error event in the stream means.
 *
 * The backend ends a stream with an "error" event when an uninstaller
 * could not run -- and now also when a before-uninstall step, like the
 * registry backup the user asked for, stops the uninstall. streamUninstall
 * used to hand that event to a callback and resolve anyway, and both
 * dialogs pass a callback that ignores everything, so they went straight
 * on to a leftover scan as if the uninstall had worked.
 */

function sse(...events) {
  const text = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  const bytes = new TextEncoder().encode(text);
  return new ReadableStream({ start(controller) { controller.enqueue(bytes); controller.close(); } });
}

beforeEach(() => { globalThis.fetch = vi.fn(); });

describe('streamUninstall', () => {
  it('resolves when the uninstaller finished', async () => {
    fetch.mockResolvedValue({ ok: true, body: sse(['exited', { code: 0 }], ['done', { code: 0 }]) });
    const seen = [];
    await streamUninstall('thing', (type) => seen.push(type));
    expect(seen).toEqual(['exited', 'done']);
  });

  it('rejects with the reason when the stream ends in an error', async () => {
    fetch.mockResolvedValue({
      ok: true,
      body: sse(['registryBackup', { ok: false }], ['error', { message: 'The registry backup failed, so the uninstall did not run: disk full' }])
    });
    await expect(streamUninstall('thing', () => {})).rejects.toThrow(/so the uninstall did not run: disk full/);
  });

  it('still reports the events that came before the error', async () => {
    fetch.mockResolvedValue({ ok: true, body: sse(['preUninstall', { step: 'registryBackup' }], ['error', { message: 'x' }]) });
    const seen = [];
    await streamUninstall('thing', (type) => seen.push(type)).catch(() => {});
    expect(seen).toContain('preUninstall');
  });
});

describe('removeQuarantined', () => {
  it('sends the destination the dialog showed', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await removeQuarantined({ programName: 'Thing', files: [], registryKeys: [], destination: 'permanent' });
    expect(JSON.parse(fetch.mock.calls[0][1].body).destination).toBe('permanent');
  });

  it('sends no destination when none was given, which the backend reads as Quarantine', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    await removeQuarantined({ programName: 'Thing', files: [], registryKeys: [] });
    expect(JSON.parse(fetch.mock.calls[0][1].body)).not.toHaveProperty('destination');
  });
});
