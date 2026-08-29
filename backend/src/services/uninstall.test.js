import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args) => spawnMock(...args) }));

let runUninstaller, withSilentFlag;
beforeEach(async () => {
  spawnMock.mockReset();
  ({ runUninstaller, withSilentFlag } = await import('./uninstall.js'));
});

describe('withSilentFlag', () => {
  it('appends /qn to a bare MsiExec uninstall string', () => {
    expect(withSilentFlag('MsiExec.exe /X{GUID}')).toBe('MsiExec.exe /X{GUID} /qn');
  });

  it('leaves an MsiExec string alone if it already has a quiet flag', () => {
    expect(withSilentFlag('MsiExec.exe /X{GUID} /qb')).toBe('MsiExec.exe /X{GUID} /qb');
  });

  it('leaves a non-MSI uninstaller string unchanged', () => {
    expect(withSilentFlag('"C:\\Program Files\\App\\uninst.exe" /S')).toBe('"C:\\Program Files\\App\\uninst.exe" /S');
  });
});

function makeFakeChild() {
  const child = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
}

describe('runUninstaller', () => {
  it('rejects immediately when there is no uninstall string', async () => {
    await expect(runUninstaller(null, () => {})).rejects.toThrow(/no registered uninstall command/);
    expect(spawnMock).not.toHaveBeenCalled();
  });

  it('emits "running" with the resolved command, then "exited" with the exit code', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const events = [];
    const promise = runUninstaller('MsiExec.exe /X{GUID}', (type, data) => events.push([type, data]));
    child.emit('exit', 0);
    const result = await promise;
    expect(result).toEqual({ code: 0 });
    expect(events[0]).toEqual(['running', { command: 'MsiExec.exe /X{GUID} /qn' }]);
    expect(events[1]).toEqual(['exited', { code: 0, stderr: null }]);
  });

  it('captures stderr text and includes it in the exited event', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const events = [];
    const promise = runUninstaller('MsiExec.exe /X{GUID}', (type, data) => events.push([type, data]));
    child.stderr.emit('data', Buffer.from('a warning\n'));
    child.emit('exit', 1);
    await promise;
    expect(events[1]).toEqual(['exited', { code: 1, stderr: 'a warning' }]);
  });

  it('rejects if the child process fails to launch', async () => {
    const child = makeFakeChild();
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller('bad command', () => {});
    child.emit('error', new Error('ENOENT'));
    await expect(promise).rejects.toThrow(/Failed to launch uninstaller/);
  });
});