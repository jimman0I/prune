import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args) => spawnMock(...args) }));

let runUninstaller;
beforeEach(async () => {
  spawnMock.mockReset();
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
    child.stderr.emit('data', Buffer.from('a warning\n'));
    child.emit('exit', 1);
    await promise;
    expect(events[1]).toEqual(['exited', { code: 1, stderr: 'a warning' }]);
  });

  it('rejects if the child process fails to launch', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'bad command' }, () => {});
    child.emit('error', new Error('ENOENT'));
    await expect(promise).rejects.toThrow(/Failed to launch uninstaller/);
  });
});