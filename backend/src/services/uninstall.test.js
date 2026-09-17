import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args) => spawnMock(...args) }));

const runPowerShellJsonMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellJson: (...args) => runPowerShellJsonMock(...args) }));

let runUninstaller;
beforeEach(async () => {
  spawnMock.mockReset();
  runPowerShellJsonMock.mockReset();
  runPowerShellJsonMock.mockResolvedValue(null);
  ({ runUninstaller } = await import('./uninstall.js'));
});

/* withSilentFlag's tests moved to silentUninstall.test.js along with the
 * function itself, which grew from "append /qn to MsiExec strings" into
 * something that reads the vendor's own quiet command out of the registry
 * and identifies NSIS uninstallers by their contents. */

function makeFakeChild() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

/** runUninstaller now awaits allowChildWindowToForeground() before ever
 * calling spawn(), so spawn() no longer happens synchronously within the
 * call to runUninstaller() -- a test emitting an event on the fake child
 * must wait for spawn() to have actually been called (and thus for the
 * 'exit'/'error' listeners to actually be attached) first, or the event
 * fires into an empty EventEmitter and the returned promise never
 * settles. */
async function waitForSpawn() {
  await vi.waitFor(() => {
    if (spawnMock.mock.calls.length === 0) throw new Error('spawn not called yet');
  });
}

describe('runUninstaller', () => {
  it('rejects immediately when there is no uninstall string', async () => {
    await expect(runUninstaller({ uninstallString: null }, () => {})).rejects.toThrow(/no registered uninstall command/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('emits "running" with the resolved command, then "exited" with the exit code', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const events = [];
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, (type, data) => events.push([type, data]));
    await waitForSpawn();
    child.emit('exit', 0);
    const result = await promise;
    expect(result).toEqual({ code: 0 });
    // /norestart as well as /qn: an MSI that decides it wants a reboot
    // would otherwise prompt for one, or take it, in the middle of a batch.
    expect(events[0]).toEqual(['running', { command: 'MsiExec.exe /X{GUID} /qn /norestart' }]);
    expect(events[1]).toEqual(['exited', { code: 0, stderr: null }]);
  });

  it('captures stderr text and includes it in the exited event', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const events = [];
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, (type, data) => events.push([type, data]));
    await waitForSpawn();
    child.stderr.emit('data', Buffer.from('a warning\n'));
    child.emit('exit', 1);
    await promise;
    expect(events[1]).toEqual(['exited', { code: 1, stderr: 'a warning' }]);
  });

  it('rejects if the child process fails to launch', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'bad command' }, () => {});
    await waitForSpawn();
    child.emit('error', new Error('ENOENT'));
    await expect(promise).rejects.toThrow(/Failed to launch uninstaller/);
  });

  // Real bug, reported directly: VALORANT's own uninstall confirmation
  // dialog (RiotClientServices.exe) genuinely opens, but Windows' own
  // focus-stealing prevention refuses to bring a background-spawned
  // process's window to the front -- confirmed empirically on this
  // project's own dev machine with the exact spawn shape this file uses.
  // AllowSetForegroundWindow(-1) (ASFW_ANY), called before spawning,
  // grants whichever process next asks for the foreground the right to
  // actually get it.
  it('grants foreground rights before spawning the uninstaller', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, () => {});
    await waitForSpawn();
    child.emit('exit', 0);
    await promise;
    expect(runPowerShellJsonMock).toHaveBeenCalledTimes(1);
    expect(runPowerShellJsonMock.mock.calls[0][0]).toMatch(/AllowSetForegroundWindow/);
    // Called BEFORE spawn, not after -- the grant has to be in place
    // before the child process (or its own child) ever creates a window.
    const foregroundCallOrder = runPowerShellJsonMock.mock.invocationCallOrder[0];
    const spawnCallOrder = spawnMock.mock.invocationCallOrder[0];
    expect(foregroundCallOrder).toBeLessThan(spawnCallOrder);
  });

  it('still runs the uninstaller even if granting foreground rights fails', async () => {
    runPowerShellJsonMock.mockRejectedValue(new Error('PowerShell unavailable'));
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, () => {});
    await waitForSpawn();
    child.emit('exit', 0);
    const result = await promise;
    expect(result).toEqual({ code: 0 });
    expect(spawnMock).toHaveBeenCalled();
  });
});