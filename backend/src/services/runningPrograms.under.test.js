import { describe, it, expect, beforeEach, vi } from 'vitest';

const runPowerShellJson = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...a) => runPowerShellJson(...a) }));

const { isRunningUnder } = await import('./runningPrograms.js');

/** Whether anything is running from inside one folder -- the check that
 * decides whether a Chromium browser may be force-uninstalled.
 *
 * Three answers, not two, and the third is the reason this exists instead
 * of reusing getRunningPrograms. That one returns {} when the process
 * query fails, which is indistinguishable from "nothing is running" -- and
 * wired to --force-uninstall, a failed query would read as "the browser is
 * idle" and kill one that is not. So a failure here is null, and the caller
 * treats null as running.
 */

const APP = 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application';

beforeEach(() => { runPowerShellJson.mockReset(); });

describe('isRunningUnder', () => {
  it('says true when a process runs from inside the folder', async () => {
    runPowerShellJson.mockResolvedValue([
      { name: 'explorer', path: 'C:\\Windows\\explorer.exe' },
      { name: 'brave', path: `${APP}\\brave.exe` }
    ]);
    expect(await isRunningUnder(APP)).toBe(true);
  });

  it('counts helper processes deeper in the folder too', async () => {
    // Chromium's crash reporter and utilities run from the version folder,
    // one level below Application. The browser can be "closed" with these
    // still alive, and force-uninstall would kill them as well.
    runPowerShellJson.mockResolvedValue([
      { name: 'brave_crashpad_handler', path: `${APP}\\152.1.94.121\\brave_crashpad_handler.exe` }
    ]);
    expect(await isRunningUnder(APP)).toBe(true);
  });

  it('says false when nothing runs from inside it', async () => {
    runPowerShellJson.mockResolvedValue([
      { name: 'explorer', path: 'C:\\Windows\\explorer.exe' },
      { name: 'code', path: 'C:\\Program Files\\Microsoft VS Code\\Code.exe' }
    ]);
    expect(await isRunningUnder(APP)).toBe(false);
  });

  it('is not fooled by a sibling folder that shares a prefix', async () => {
    runPowerShellJson.mockResolvedValue([
      { name: 'other', path: 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application2\\x.exe' }
    ]);
    expect(await isRunningUnder(APP)).toBe(false);
  });

  it('ignores case and separator style', async () => {
    runPowerShellJson.mockResolvedValue([
      { name: 'brave', path: 'c:/program files/bravesoftware/brave-browser/application/brave.exe' }
    ]);
    expect(await isRunningUnder(APP.toUpperCase())).toBe(true);
  });

  it('says null -- not false -- when the process query fails', async () => {
    /* The case that decides everything. A false here would let
     * --force-uninstall close a browser the check simply failed to see. */
    runPowerShellJson.mockRejectedValue(new Error('powershell.exe exited with 1'));
    expect(await isRunningUnder(APP)).toBeNull();
  });

  it('says null when the query comes back empty', async () => {
    // A live machine always has processes -- the PowerShell answering this
    // is one. An empty list means the query did not work, not that
    // nothing is running.
    runPowerShellJson.mockResolvedValue([]);
    expect(await isRunningUnder(APP)).toBeNull();
    runPowerShellJson.mockResolvedValue(null);
    expect(await isRunningUnder(APP)).toBeNull();
  });

  it('says null for no folder at all', async () => {
    expect(await isRunningUnder('')).toBeNull();
    expect(await isRunningUnder(null)).toBeNull();
    expect(runPowerShellJson).not.toHaveBeenCalled();
  });
});
