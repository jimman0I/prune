import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const listDrives = vi.fn();
vi.mock('../services/drives.js', () => ({ listDrives: (...a) => listDrives(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });

describe('GET /drives', () => {
  it('returns the drive list and the system drive', async () => {
    listDrives.mockResolvedValueOnce({ systemDrive: 'C', drives: [{ letter: 'C' }] });
    const res = await server.call('/drives');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ systemDrive: 'C', drives: [{ letter: 'C' }] });
  });

  it('answers a failure as a JSON 500 instead of leaving the request open', async () => {
    listDrives.mockRejectedValueOnce(new Error('PowerShell command failed'));
    const res = await server.call('/drives');
    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/PowerShell/);
  });
});
