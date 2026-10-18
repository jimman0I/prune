import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'node:events';

const spawnMock = vi.fn();
vi.mock('node:child_process', () => ({ spawn: (...args) => spawnMock(...args) }));

const runPowerShellTextMock = vi.fn();
vi.mock('./powershell.js', () => ({ runPowerShellText: (...args) => runPowerShellTextMock(...args) }));

let runUninstaller;
beforeEach(async () => {
  spawnMock.mockReset();
  runPowerShellTextMock.mockReset();
  runPowerShellTextMock.mockResolvedValue('');
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

/** spawn() happens synchronously inside runUninstaller()'s Promise
 * executor, but the listeners a test needs (`exit`, `error`, `stderr`)
 * are attached in the same synchronous pass -- waiting for spawn() to
 * have been called is still the simplest way to know the fake child is
 * wired up and ready to receive an emitted event. */
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
  //
  // The mechanism changed since: a single AllowSetForegroundWindow(-1)
  // granted BEFORE spawning lost its target in a since-reported second
  // case (SQLiteStudio's real wizard opened, just still behind Prune --
  // the one-shot grant had already been consumed by something else by
  // the time its window existed). This is started AFTER spawning instead,
  // fire-and-forget, so it can poll for the window actually appearing and
  // grant+consume the allowance in the same breath once it finds one.
  it('starts hunting for the uninstaller window once it has a PID to search for', async () => {
    const child = makeFakeChild();
    child.pid = 4242;
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, () => {});
    await waitForSpawn();
    child.emit('exit', 0);
    await promise;
    expect(runPowerShellTextMock).toHaveBeenCalledTimes(1);
    const script = runPowerShellTextMock.mock.calls[0][0];
    expect(script).toMatch(/AllowSetForegroundWindow/);
    expect(script).toMatch(/SetForegroundWindow/);
    expect(script).toMatch(/EnumWindows/);
    // The PID to search descendants of, baked into the script itself.
    expect(script).toMatch(/\$rootPid = 4242/);
    // Started AFTER spawn now, not before -- it is the window that has to
    // exist before anything can be found, not the other way around.
    const foregroundCallOrder = runPowerShellTextMock.mock.invocationCallOrder[0];
    const spawnCallOrder = spawnMock.mock.invocationCallOrder[0];
    expect(foregroundCallOrder).toBeGreaterThan(spawnCallOrder);
  });

  it('still runs the uninstaller even if the foreground hunt fails', async () => {
    runPowerShellTextMock.mockRejectedValue(new Error('PowerShell unavailable'));
    const child = makeFakeChild();
    child.pid = 4242;
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, () => {});
    await waitForSpawn();
    child.emit('exit', 0);
    const result = await promise;
    expect(result).toEqual({ code: 0 });
    expect(spawnMock).toHaveBeenCalled();
  });

  it('does not search at all when the spawned process has no PID', async () => {
    // Reachable: Node's own types mark ChildProcess.pid as possibly
    // undefined if spawning failed before a PID was assigned. Nothing to
    // search for without one, and the fake script interpolates it
    // directly into PowerShell source -- searching for "undefined" would
    // be a silent no-op at best.
    const child = makeFakeChild();
    child.pid = undefined;
    spawnMock.mockReturnValue(child);
    const promise = runUninstaller({ uninstallString: 'MsiExec.exe /X{GUID}' }, () => {});
    await waitForSpawn();
    child.emit('exit', 0);
    await promise;
    expect(runPowerShellTextMock).not.toHaveBeenCalled();
  });
});
describe('answering the wizard, and the running flag', () => {
  it('starts the wizard automation for an uninstaller Prune cannot make silent, when asked to', async () => {
    const child = makeFakeChild();
    child.pid = 4242;
    spawnMock.mockReturnValue(child);
    const startAutomation = vi.fn();
    const events = [];
    const promise = runUninstaller({ uninstallString: '"C:/nowhere/custom-uninstaller.exe"' }, (type, data) => events.push([type, data]), { answerWizards: true, startAutomation });
    await waitForSpawn();
    expect(startAutomation).toHaveBeenCalledWith(4242, expect.any(Function));
    // The foreground hunt is the automation's job now, not a second poller's.
    expect(runPowerShellTextMock).not.toHaveBeenCalled();
    startAutomation.mock.calls[0][1]({ state: 'answered', act: 'invoke', label: 'next', window: 'Setup' });
    expect(events).toContainEqual(['wizard', { state: 'answered', act: 'invoke', label: 'next', window: 'Setup' }]);
    child.emit('exit', 0);
    await promise;
  });

  it('leaves the wizard alone when not asked, or when the command is already silent', async () => {
    for (const [program, options] of [
      [{ uninstallString: '"C:/nowhere/custom-uninstaller.exe"' }, {}],
      [{ uninstallString: 'MsiExec.exe /X{GUID}' }, { answerWizards: true }],
      [{ uninstallString: '"C:/nowhere/u.exe"', quietUninstallString: '"C:/nowhere/u.exe" /quiet' }, { answerWizards: true }]
    ]) {
      spawnMock.mockReset();
      const child = makeFakeChild();
      child.pid = 7;
      spawnMock.mockReturnValue(child);
      const startAutomation = vi.fn();
      const promise = runUninstaller(program, () => {}, { ...options, startAutomation });
      await waitForSpawn();
      expect(startAutomation, JSON.stringify(program)).not.toHaveBeenCalled();
      child.emit('exit', 0);
      await promise;
    }
  });

  it('hands the route\'s "not running" to the resolver, which is what lets a closed browser uninstall silently', async () => {
    const { mkdtempSync, mkdirSync, writeFileSync, rmSync } = await import('node:fs');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');
    const root = mkdtempSync(join(tmpdir(), 'prune-chromium-'));
    try {
      const installer = join(root, 'Application', '1.0', 'Installer');
      mkdirSync(installer, { recursive: true });
      const setup = join(installer, 'setup.exe');
      writeFileSync(setup, 'MZ force-uninstall');
      const child = makeFakeChild();
      spawnMock.mockReturnValue(child);
      const events = [];
      const promise = runUninstaller({ uninstallString: `"${setup}" --uninstall --system-level`, running: false }, (type, data) => events.push([type, data]));
      await waitForSpawn();
      expect(events[0][1].command).toMatch(/--force-uninstall$/);
      child.emit('exit', 0);
      await promise;
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
