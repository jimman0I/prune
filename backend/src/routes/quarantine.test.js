import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { join, basename } from 'node:path';
import { startTestServer } from '../testSupport/routeServer.js';
import { quarantineRoot } from '../services/quarantine.js';

/** The routes behind every destructive action in the app.
 *
 * Every service under these endpoints is mocked. Not for speed: the point
 * of the test is what the route does with the request BEFORE the service
 * is reached -- what it refuses, what it rewrites, and what it passes on
 * -- and running the real ones would mean a test suite that permanently
 * deletes things on the machine it runs on.
 */

const restoreQuarantine = vi.fn(async (batchDir) => ({ restored: true, batchDir }));
const deletePermanently = vi.fn(async () => ({ deleted: true }));
const emptyQuarantine = vi.fn(async () => ({ ok: true, removed: 3 }));
const listQuarantineBatches = vi.fn(async () => [{ batchDir: 'x', programName: 'Thing' }]);
const quarantineAndDelete = vi.fn(async ({ programName }) => ({ programName, batchDir: 'b' }));

vi.mock('../services/quarantine.js', async (importOriginal) => ({
  // quarantineRoot stays real: the route resolves batch names against it,
  // and a stubbed root would let a wrong join look right.
  quarantineRoot: (await importOriginal()).quarantineRoot,
  restoreQuarantine: (...a) => restoreQuarantine(...a),
  deletePermanently: (...a) => deletePermanently(...a),
  emptyQuarantine: (...a) => emptyQuarantine(...a),
  listQuarantineBatches: (...a) => listQuarantineBatches(...a),
  quarantineAndDelete: (...a) => quarantineAndDelete(...a)
}));

const tryCreateRestorePoint = vi.fn(async () => ({ created: true }));
vi.mock('../services/restorePoint.js', () => ({
  tryCreateRestorePoint: (...a) => tryCreateRestorePoint(...a)
}));

let settings = { createRestorePoint: true, quarantineRetentionDays: 30 };
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (partial) => ({ ...settings, ...partial })
}));

const purgeExpiredQuarantine = vi.fn(async () => ({ ok: true, purged: ['Thing'] }));
vi.mock('../services/quarantineRetention.js', () => ({
  purgeExpiredQuarantine: (...a) => purgeExpiredQuarantine(...a)
}));

const quarantinePath = vi.fn(async () => ({ ok: true, movedTo: 'somewhere' }));
vi.mock('../services/quarantinePath.js', () => ({
  quarantinePath: (...a) => quarantinePath(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => {
  vi.clearAllMocks();
  settings = { createRestorePoint: true, quarantineRetentionDays: 30 };
});

const postJson = (path, body) => server.call(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

describe('POST /quarantine/remove', () => {
  it('refuses a request that names no program', async () => {
    const res = await postJson('/quarantine/remove', { files: ['C:\\somewhere'] });
    expect(res.status).toBe(400);
    expect(quarantineAndDelete).not.toHaveBeenCalled();
  });

  it('makes a restore point first, and reports it alongside the manifest', async () => {
    const res = await postJson('/quarantine/remove', { programName: 'Thing', files: [] });
    expect(res.status).toBe(200);
    expect(tryCreateRestorePoint).toHaveBeenCalled();
    expect(res.body.restorePoint).toEqual({ created: true });
  });

  it('skips the restore point when the user turned it off, and says why', async () => {
    // A slow no-op on a machine with System Protection disabled. The
    // reason travels with the response so the UI can say "turned off in
    // Settings" rather than showing a silent absence.
    settings = { createRestorePoint: false };
    const res = await postJson('/quarantine/remove', { programName: 'Thing' });
    expect(tryCreateRestorePoint).not.toHaveBeenCalled();
    expect(res.body.restorePoint).toEqual({ created: false, reason: 'turned off in Settings' });
  });

  it('defaults the file and registry lists rather than passing undefined through', async () => {
    await postJson('/quarantine/remove', { programName: 'Thing' });
    expect(quarantineAndDelete).toHaveBeenCalledWith({
      programName: 'Thing', files: [], registryKeys: []
    });
  });
});

describe('naming a batch', () => {
  it('resolves a full absolute batchDir under the quarantine root, not onto it twice', async () => {
    // The dogfooding bug of 2026-09-01. manifest.batchDir is the FULL
    // path, the panel passes it straight through as the route param, and
    // join(root, absolutePath) concatenates rather than replacing -- so
    // restore and permanent delete both hit a doubled, nonexistent path
    // and had never once worked through HTTP.
    const full = join(quarantineRoot(), '20260901-Thing');
    await postJson(`/quarantine/${encodeURIComponent(full)}/restore`, {});
    expect(restoreQuarantine).toHaveBeenCalledWith(full);
  });

  it('resolves a bare directory name the same way', async () => {
    await postJson('/quarantine/20260901-Thing/restore', {});
    expect(restoreQuarantine).toHaveBeenCalledWith(join(quarantineRoot(), '20260901-Thing'));
  });

  it('cannot be walked out of the quarantine root', async () => {
    // basename() is what makes this true, and it is worth pinning: the
    // param is a user-reachable string that names a directory this app
    // then deletes permanently.
    const escapes = [
      '..\\..\\Windows\\System32',
      '../../Users/jimmanol/Documents',
      'C:\\Windows\\System32'
    ];
    for (const attempt of escapes) {
      vi.clearAllMocks();
      await server.call(`/quarantine/${encodeURIComponent(attempt)}`, { method: 'DELETE' });
      const [used] = deletePermanently.mock.calls[0];
      expect(used, `${attempt} escaped the root`).toBe(join(quarantineRoot(), basename(attempt)));
      expect(used.startsWith(quarantineRoot())).toBe(true);
    }
  });
});

describe('DELETE /quarantine/:batchDir', () => {
  it('is a 404, not a success, when there was no such batch', async () => {
    deletePermanently.mockResolvedValueOnce({ deleted: false });
    const res = await server.call('/quarantine/nope', { method: 'DELETE' });
    expect(res.status).toBe(404);
  });

  it('reports the service failing as a 500 rather than a silent success', async () => {
    deletePermanently.mockRejectedValueOnce(new Error('EBUSY'));
    const res = await server.call('/quarantine/20260901-Thing', { method: 'DELETE' });
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('EBUSY');
  });
});

describe('POST /quarantine/path', () => {
  it('passes a numeric reported size through and nulls anything else', async () => {
    // The size is only a hint the Disk Map already measured; a string or
    // a missing value must not reach the service as one.
    await postJson('/quarantine/path', { path: 'C:\\Users\\x\\Downloads\\big', reportedSizeBytes: 4096 });
    expect(quarantinePath).toHaveBeenCalledWith({ path: 'C:\\Users\\x\\Downloads\\big', reportedSizeBytes: 4096 });

    await postJson('/quarantine/path', { path: 'C:\\Users\\x\\Downloads\\big', reportedSizeBytes: '4096' });
    expect(quarantinePath).toHaveBeenLastCalledWith({ path: 'C:\\Users\\x\\Downloads\\big', reportedSizeBytes: null });
  });

  it('answers a refusal as a 200 carrying the reason, not as an error', async () => {
    // Deliberate. "That cannot be deleted" as a 4xx reads to the UI as
    // the app being broken; a refusal with a reason reads as the app
    // being careful, and the client can print the sentence.
    quarantinePath.mockResolvedValueOnce({
      ok: false, protected: true, reason: 'That is Windows itself.'
    });
    const res = await postJson('/quarantine/path', { path: 'C:\\Windows' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: false, protected: true, reason: 'That is Windows itself.' });
  });

  it('survives a request with no body at all', async () => {
    const res = await server.call('/quarantine/path', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(quarantinePath).toHaveBeenCalledWith({ path: undefined, reportedSizeBytes: null });
  });
});

describe('POST /quarantine/purge', () => {
  it('takes the retention window from settings and ignores the body', async () => {
    // A client that could name its own retention could pass 0 and empty
    // the whole quarantine through an endpoint whose name says it only
    // removes expired batches.
    await postJson('/quarantine/purge', { quarantineRetentionDays: 0, retentionDays: 0 });
    expect(purgeExpiredQuarantine).toHaveBeenCalledWith(settings);
  });

  it('reports a failed purge as a 500 with the service result', async () => {
    purgeExpiredQuarantine.mockResolvedValueOnce({ ok: false, error: 'EPERM' });
    const res = await postJson('/quarantine/purge', {});
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ ok: false, error: 'EPERM' });
  });
});

describe('the rest', () => {
  it('lists batches', async () => {
    const res = await server.call('/quarantine');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ batches: [{ batchDir: 'x', programName: 'Thing' }] });
  });

  it('empties the quarantine only on POST, never on GET', async () => {
    // /empty destroys every undo the app holds. Reachable by a GET it
    // would be reachable by a prefetch, a retry, or a link.
    const get = await server.call('/quarantine/empty');
    expect(get.status).toBe(404);
    expect(emptyQuarantine).not.toHaveBeenCalled();

    const post = await server.call('/quarantine/empty', { method: 'POST' });
    expect(post.status).toBe(200);
    expect(emptyQuarantine).toHaveBeenCalledTimes(1);
  });
});
