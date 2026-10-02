import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const svc = vi.hoisted(() => ({ listBackups: vi.fn(), restoreBackup: vi.fn(), deleteBackup: vi.fn() }));
vi.mock('../services/backups.js', () => svc);

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => vi.clearAllMocks());

describe('/backups', () => {
  it('lists', async () => {
    svc.listBackups.mockResolvedValue([{ id: 'registry:1-A', kind: 'registry' }]);
    expect((await server.call('/backups')).body).toEqual({ backups: [{ id: 'registry:1-A', kind: 'registry' }] });
  });

  it('restores by the id in the URL, decoded', async () => {
    svc.restoreBackup.mockResolvedValue({ kind: 'registry', restored: 2, failed: [], elevated: false });
    const res = await server.call(`/backups/${encodeURIComponent('registry:1-A')}/restore`, { method: 'POST' });
    expect(res.body.restored).toBe(2);
    expect(svc.restoreBackup).toHaveBeenCalledWith('registry:1-A');
  });

  it('is a 404 for a backup that does not exist', async () => {
    svc.restoreBackup.mockRejectedValue(new Error('There is no such backup.'));
    expect((await server.call('/backups/registry%3A9-x/restore', { method: 'POST' })).status).toBe(404);
    svc.deleteBackup.mockResolvedValue({ deleted: false, freedBytes: 0 });
    expect((await server.call('/backups/registry%3A9-x', { method: 'DELETE' })).status).toBe(404);
  });

  it('deletes', async () => {
    svc.deleteBackup.mockResolvedValue({ deleted: true, freedBytes: 5 });
    const res = await server.call('/backups/task%3A3-A', { method: 'DELETE' });
    expect(res.body).toEqual({ deleted: true, freedBytes: 5 });
    expect(svc.deleteBackup).toHaveBeenCalledWith('task:3-A');
  });
});
