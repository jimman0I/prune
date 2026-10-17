import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The startup screen's commands beyond the switch: open the entry's
 * location or its program's folder, run it or end it, and add an entry.
 *
 * Same contract as the toggle: an existing entry is named by id only and
 * looked up again on the server, so the client can never hand over a path,
 * key or command line of its own for these to act on. */

const entries = [
  { id: 'registry:user:Run:Discord', source: 'registry', name: 'Discord' }
];
const getStartupEntries = vi.fn(async () => entries);
vi.mock('../services/startupItems.js', () => ({
  getStartupEntries: (...a) => getStartupEntries(...a),
  getStartupItems: async () => entries
}));

const openStartupLocation = vi.fn(async () => ({ ok: true }));
const openContainingFolder = vi.fn(async () => ({ ok: true }));
const runStartupProcess = vi.fn(async () => ({ ok: true }));
const addStartupEntry = vi.fn(async () => ({ ok: true }));
vi.mock('../services/startupActions.js', () => ({
  openStartupLocation: (...a) => openStartupLocation(...a),
  openContainingFolder: (...a) => openContainingFolder(...a),
  runStartupProcess: (...a) => runStartupProcess(...a),
  addStartupEntry: (...a) => addStartupEntry(...a)
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const post = (path, body) => server.call(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});

describe('POST /programs/startup/open', () => {
  it('opens the location or the folder of the entry it looked up again', async () => {
    const res = await post('/programs/startup/open', { id: 'registry:user:Run:Discord', target: 'location', path: 'C:\\evil' });
    expect(res.status).toBe(200);
    expect(openStartupLocation).toHaveBeenCalledWith(entries[0]);
    await post('/programs/startup/open', { id: 'registry:user:Run:Discord', target: 'folder' });
    expect(openContainingFolder).toHaveBeenCalledWith(entries[0]);
  });

  it('refuses an unknown target and a stale id', async () => {
    expect((await post('/programs/startup/open', { id: 'registry:user:Run:Discord', target: 'shell' })).status).toBe(400);
    expect((await post('/programs/startup/open', { id: 'gone', target: 'location' })).status).toBe(404);
    expect(openStartupLocation).not.toHaveBeenCalled();
  });
});

describe('POST /programs/startup/process', () => {
  it('runs or ends only "run" or "end", on the entry it looked up again', async () => {
    expect((await post('/programs/startup/process', { id: 'registry:user:Run:Discord', action: 'end' })).status).toBe(200);
    expect(runStartupProcess).toHaveBeenCalledWith(entries[0], 'end');
    expect((await post('/programs/startup/process', { id: 'registry:user:Run:Discord', action: 'format' })).status).toBe(400);
    expect((await post('/programs/startup/process', { id: 'gone', action: 'run' })).status).toBe(404);
  });
});

describe('POST /programs/startup/add', () => {
  it('passes only the four known fields through, as strings', async () => {
    const res = await post('/programs/startup/add', { name: 'Acme', command: 'C:\\a.exe', scope: 'user', kind: 'run', extra: 'x' });
    expect(res.status).toBe(200);
    expect(addStartupEntry).toHaveBeenCalledWith({ name: 'Acme', command: 'C:\\a.exe', scope: 'user', kind: 'run' });
  });

  it('refuses a body whose fields are not strings', async () => {
    expect((await post('/programs/startup/add', { name: 1, command: 'C:\\a.exe', scope: 'user', kind: 'run' })).status).toBe(400);
    expect(addStartupEntry).not.toHaveBeenCalled();
  });
});
