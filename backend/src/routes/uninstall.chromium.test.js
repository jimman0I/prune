import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { startTestServer } from '../testSupport/routeServer.js';

/** The uninstall route asks whether a Chromium browser is running before
 * it lets the command become silent.
 *
 * services/silentUninstall.js adds --force-uninstall only on an explicit
 * `running: false`. That rule is only as good as whatever supplies
 * `running`, and this is where it is supplied: the route checks the
 * browser's Application folder -- two levels above setup.exe, where the
 * browser actually runs from -- and passes the answer through unchanged,
 * INCLUDING null when the check could not tell.
 *
 * Nothing here runs a process query or an uninstaller. runningPrograms and
 * uninstall are both mocked; and the runningPrograms mock carries
 * getRunningPrograms as well as isRunningUnder, because vi.mock replaces
 * the whole module and the programs route imports the other one.
 */

const brave = {
  id: 'Brave', name: 'Brave',
  uninstallString: '"C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\152.1.94.121\\Installer\\setup.exe" --uninstall --system-level'
};
const edge = {
  id: 'Edge', name: 'Microsoft Edge',
  uninstallString: '"C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\152.0.4191.66\\Installer\\setup.exe" --uninstall --msedge --channel=stable --system-level --verbose-logging'
};
const plain = { id: 'Thing', name: 'Thing', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe" /S' };

vi.mock('../services/programs.js', () => ({
  listInstalledPrograms: vi.fn(async () => [brave, edge, plain])
}));

const runUninstaller = vi.fn(async (program, onEvent) => {
  onEvent('exited', { code: 0, stderr: null });
  return { code: 0 };
});
vi.mock('../services/uninstall.js', () => ({
  runUninstaller: (...a) => runUninstaller(...a)
}));

const isRunningUnder = vi.fn();
vi.mock('../services/runningPrograms.js', () => ({
  isRunningUnder: (...a) => isRunningUnder(...a),
  getRunningPrograms: vi.fn(async () => ({}))
}));

let server;
beforeAll(async () => { server = await startTestServer(); });
afterAll(async () => { await server.close(); });
beforeEach(() => { vi.clearAllMocks(); });

const start = async (programId) => {
  const res = await fetch(`${server.base}/uninstall`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ programId })
  });
  return { res, text: await res.text() };
};

describe('the running check in front of a Chromium browser', () => {
  it('looks in the Application folder, not the uninstaller\'s', async () => {
    /* The uninstaller lives in <Application>\<version>\Installer, which is
     * the one folder the browser never runs from. Checking there would
     * report a running browser as idle -- and idle is what earns the
     * --force-uninstall that kills it. */
    isRunningUnder.mockResolvedValue(false);
    await start('Brave');

    expect(isRunningUnder).toHaveBeenCalledWith('c:\\program files\\bravesoftware\\brave-browser\\application');
  });

  it('passes "not running" through, which is what allows a silent uninstall', async () => {
    isRunningUnder.mockResolvedValue(false);
    await start('Brave');

    expect(runUninstaller).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Brave', running: false }), expect.any(Function)
    );
  });

  it('passes "running" through, which keeps the browser\'s own dialog', async () => {
    isRunningUnder.mockResolvedValue(true);
    await start('Brave');

    expect(runUninstaller).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'Brave', running: true }), expect.any(Function)
    );
  });

  it('passes "could not tell" through as null, not as false', async () => {
    /* The route must not tidy a null into a false. That single coercion is
     * the difference between a dialog and a killed browser, and it is the
     * easiest thing in the world to write by accident: `!!running`. */
    isRunningUnder.mockResolvedValue(null);
    await start('Brave');

    const program = runUninstaller.mock.calls[0][0];
    expect(program.running).toBeNull();
  });

  it('does not pay for a process query on a program that is not Chromium', async () => {
    // The check costs about a second and a half. Only four entries on the
    // dev machine can use its answer.
    await start('Thing');

    expect(isRunningUnder).not.toHaveBeenCalled();
    expect(runUninstaller.mock.calls[0][0].running).toBeUndefined();
  });

  it('does not check Edge, which is never made silent', async () => {
    await start('Edge');
    expect(isRunningUnder).not.toHaveBeenCalled();
  });
});
