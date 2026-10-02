import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

const pickPath = vi.fn();
vi.mock('../services/filePicker.js', () => ({ pickPath: (...a) => pickPath(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const post = (kind) => server.call(`/picker/${kind}`, { method: 'POST' });

describe('POST /picker/:kind', () => {
  it('answers with the chosen path', async () => {
    pickPath.mockResolvedValue({ path: 'D:\\Chosen' });
    const res = await post('folder');
    expect(res.body).toEqual({ path: 'D:\\Chosen' });
    expect(pickPath).toHaveBeenCalledWith('folder');
  });

  it('answers null when the dialog was cancelled', async () => {
    pickPath.mockResolvedValue({ path: null });
    expect((await post('installer')).body).toEqual({ path: null });
  });

  it('is a 409 while another dialog is open and a 400 for an unknown kind', async () => {
    pickPath.mockRejectedValueOnce(new Error('A file dialog is already open.'));
    expect((await post('folder')).status).toBe(409);
    pickPath.mockRejectedValueOnce(new Error('Unknown picker kind "x".'));
    expect((await post('x')).status).toBe(400);
  });

  it('is not reachable by a GET', async () => {
    expect((await server.call('/picker/folder')).status).toBe(404);
  });
});
