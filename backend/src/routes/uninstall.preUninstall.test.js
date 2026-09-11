import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** POST /uninstall with the before-uninstall steps.
 *
 * The steps run inside the stream, after it opens: a registry backup takes
 * seconds and a restore point can take longer, and the user should see
 * that happening rather than a frozen dialog. When they say stop, the
 * uninstaller never starts, and the stream ends with an error event -- the
 * same way a failed uninstaller ends it, so every caller already knows
 * what that looks like.
 */

const programs = [{ id: 'Thing', name: 'Thing', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"' }];
vi.mock('../services/programs.js', () => ({ listInstalledPrograms: async () => programs }));

const runUninstaller = vi.fn(async (program, onEvent) => { onEvent('exited', { code: 0 }); return { code: 0 }; });
vi.mock('../services/uninstall.js', () => ({ runUninstaller: (...a) => runUninstaller(...a) }));

let settings = {};
vi.mock('../services/settings.js', () => ({
  getSettings: async () => settings,
  updateSettings: async (p) => ({ ...settings, ...p })
}));

const runPreUninstall = vi.fn();
vi.mock('../services/preUninstall.js', () => ({ runPreUninstall: (...a) => runPreUninstall(...a) }));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); settings = { registryBackupBeforeUninstall: true }; });

const start = async () => {
  const res = await fetch(`${server.base}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programId: 'Thing' })
  });
  return { res, text: await res.text() };
};

describe('before the uninstaller runs', () => {
  it('runs the steps with the program and the settings, then the uninstaller', async () => {
    runPreUninstall.mockImplementation(async ({ onEvent }) => {
      onEvent('registryBackup', { ok: true, dir: 'D:\\b', sizeBytes: 5 });
      return { proceed: true };
    });
    const { text } = await start();

    expect(runPreUninstall).toHaveBeenCalledWith(expect.objectContaining({ programName: 'Thing', settings }));
    expect(runUninstaller).toHaveBeenCalledTimes(1);
    // Streamed to the dialog, in order: the backup, then the uninstall.
    expect(text.indexOf('event: registryBackup')).toBeGreaterThan(-1);
    expect(text.indexOf('event: registryBackup')).toBeLessThan(text.indexOf('event: done'));
  });

  it('never starts the uninstaller when a step says stop, and ends the stream with the reason', async () => {
    runPreUninstall.mockResolvedValue({ proceed: false, reason: 'The registry backup failed, so the uninstall did not run: disk full' });
    const { res, text } = await start();

    expect(res.status).toBe(200);
    expect(runUninstaller).not.toHaveBeenCalled();
    expect(text).toMatch(/event: error/);
    expect(text).toMatch(/so the uninstall did not run: disk full/);
    expect(text).not.toMatch(/event: done/);
  });
});
