import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The uninstall history, and the setting that stops it being kept --
 * Revo's "Disable Uninstall History". Off means nothing is written: the
 * point of the setting is that there is no record, not a hidden one. */

const appendHistoryEntry = vi.fn(async (fields) => ({ id: 'abc123', ...fields }));
const updateHistoryEntry = vi.fn(async () => true);
const clearHistory = vi.fn(async () => 3);
const getAllHistory = vi.fn(async () => [{ id: 'a', programName: 'All' }]);
const getRecentHistory = vi.fn(async () => [{ id: 'r', programName: 'Recent' }]);
vi.mock('../services/uninstallHistory.js', async (importOriginal) => ({
  ...(await importOriginal()),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  updateHistoryEntry: (...a) => updateHistoryEntry(...a),
  clearHistory: (...a) => clearHistory(...a),
  getAllHistory: (...a) => getAllHistory(...a),
  getRecentHistory: (...a) => getRecentHistory(...a)
}));

let settings = {};
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (p) => ({ ...settings, ...p })
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); settings = {}; });

const json = (method, path, body) => server.call(path, {
  method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body)
});
const record = (body = { programName: 'Thing', publisher: 'Acme', sizeBytes: 5 }) => json('POST', '/uninstall-history', body);

describe('POST /uninstall-history', () => {
  it('records a removal by default, and answers with the id of the entry', async () => {
    const res = await record();
    expect(res.status).toBe(200);
    expect(appendHistoryEntry).toHaveBeenCalledWith({ programName: 'Thing', publisher: 'Acme', sizeBytes: 5 });
    expect(res.body).toEqual({ ok: true, id: 'abc123' });
  });

  it('writes nothing when the history is turned off, and says it skipped', async () => {
    settings = { keepUninstallHistory: false };
    const res = await record();
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, skipped: true });
    expect(appendHistoryEntry).not.toHaveBeenCalled();
  });

  it('keeps recording for any value but an explicit false', async () => {
    // A settings file from before this existed has no such key; the
    // history it has always kept carries on.
    for (const value of [undefined, true, 'false', 0, null]) {
      settings = { keepUninstallHistory: value };
      await record();
    }
    expect(appendHistoryEntry).toHaveBeenCalledTimes(5);
  });

  it('carries the richer fields and drops anything it does not know', async () => {
    await record({
      programName: 'Thing', version: '1.2', scanMode: 'advanced', leftoversFound: 4, leftoversRemoved: 3, bytesFreed: 99,
      destination: 'quarantine', outcome: 'removed', restorePoint: { created: false, reason: 'turned off' },
      isAdmin: true, __proto__: { polluted: true }, leftoversFound2: 'x'
    });
    expect(appendHistoryEntry).toHaveBeenCalledWith({
      programName: 'Thing', version: '1.2', scanMode: 'advanced', leftoversFound: 4, leftoversRemoved: 3, bytesFreed: 99,
      destination: 'quarantine', outcome: 'removed', restorePoint: { created: false, reason: 'turned off' }
    });
  });

  it('needs a program name', async () => {
    expect((await record({ publisher: 'x' })).status).toBe(400);
    expect(appendHistoryEntry).not.toHaveBeenCalled();
  });
});

describe('GET /uninstall-history', () => {
  it('gives the latest five by default and everything with ?all=1', async () => {
    expect((await server.call('/uninstall-history')).body.entries[0].programName).toBe('Recent');
    expect(getRecentHistory).toHaveBeenCalledWith(5);
    expect((await server.call('/uninstall-history?all=1')).body.entries[0].programName).toBe('All');
  });
});

describe('PATCH /uninstall-history/:id', () => {
  it('adds the outcome of the review to an entry', async () => {
    const res = await json('PATCH', '/uninstall-history/abc123', { leftoversRemoved: 2, outcome: 'removed', evil: 'x' });
    expect(res.body).toEqual({ ok: true, updated: true });
    expect(updateHistoryEntry).toHaveBeenCalledWith('abc123', { leftoversRemoved: 2, outcome: 'removed', evil: 'x' });
  });

  it('does nothing when the history is off', async () => {
    settings = { keepUninstallHistory: false };
    const res = await json('PATCH', '/uninstall-history/abc123', { outcome: 'removed' });
    expect(res.body).toEqual({ ok: true, skipped: true });
    expect(updateHistoryEntry).not.toHaveBeenCalled();
  });
});

describe('DELETE /uninstall-history', () => {
  it('clears the log, even when new entries are turned off', async () => {
    settings = { keepUninstallHistory: false };
    const res = await json('DELETE', '/uninstall-history');
    expect(res.body).toEqual({ ok: true, cleared: 3 });
    expect(clearHistory).toHaveBeenCalledTimes(1);
  });
});
