import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createInstallMonitor, validateInstaller, MIN_AUTO_FINISH_MS } from './installMonitor.js';

/** The monitor's state machine, with every outside thing stood in for: no
 * installer runs, no snapshot is taken, nothing is written outside a temp
 * folder. What is under test is the order of events and what gets recorded. */

let dir;
let installer;
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'prune-monitor-'));
  installer = join(dir, 'AcmeSetup.exe');
  writeFileSync(installer, 'MZ');
});
afterEach(() => { rmSync(dir, { recursive: true, force: true }); });

const state = (extra = {}) => ({ uninstall: [], run: [], services: [], tasks: [], ...extra });

function harness(overrides = {}) {
  let exit;
  const launched = new Promise((resolve) => { exit = resolve; });
  let clock = 1000;
  const saved = [];
  const afterState = overrides.afterState || state({
    uninstall: [{ key: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\U\\Acme', psKey: 'HKLM:\\SOFTWARE\\U\\Acme', name: 'Acme', publisher: 'Acme Inc', version: '2.0', installLocation: 'D:\\Acme' }],
    run: [{ key: 'HKEY_CURRENT_USER\\Run', valueName: 'AcmeTray', data: 'D:\\Acme\\tray.exe' }],
    services: [{ name: 'AcmeSvc', pathName: 'D:\\Acme\\svc.exe' }],
    tasks: [{ name: 'AcmeTask', path: '\\Acme\\' }, { name: 'Defrag', path: '\\Microsoft\\Windows\\Defrag\\' }]
  });
  const deps = {
    captureSystemState: vi.fn()
      .mockResolvedValueOnce(state())
      .mockResolvedValueOnce(afterState),
    captureFiles: vi.fn(async () => ({ map: new Map(), truncated: false })),
    diffFiles: vi.fn(async () => ({
      added: [{ path: 'D:\\Acme', isDirectory: true, sizeBytes: 500 }], modified: 3, addedTruncated: false, truncated: false
    })),
    launch: vi.fn(() => ({ exited: launched })),
    saveTrace: vi.fn(async (trace) => { saved.push(trace); }),
    now: () => clock,
    settleMs: 0,
    ...overrides.deps
  };
  return { monitor: createInstallMonitor(deps), deps, saved, exit, advance: (ms) => { clock += ms; } };
}

const waitForState = async (monitor, wanted) => {
  for (let i = 0; i < 200; i += 1) {
    if (monitor.status().state === wanted) return monitor.status();
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`never reached ${wanted}; at ${monitor.status().state}`);
};

describe('validateInstaller', () => {
  it('accepts an existing .exe or .msi by absolute path', () => {
    expect(validateInstaller(installer)).toBeNull();
    const msi = join(dir, 'a.MSI');
    writeFileSync(msi, 'x');
    expect(validateInstaller(msi)).toBeNull();
  });

  it('refuses anything else', () => {
    for (const bad of [undefined, null, '', 'setup.exe', join(dir, 'missing.exe'), dir, join(dir, 'a.bat')]) {
      expect(validateInstaller(bad), String(bad)).toBeTruthy();
    }
    writeFileSync(join(dir, 'a.bat'), 'x');
    expect(validateInstaller(join(dir, 'a.bat'))).toBeTruthy();
  });
});

describe('a monitored install', () => {
  it('takes the before snapshot, then launches the installer, and waits for it', async () => {
    const { monitor, deps } = harness();
    expect(monitor.status().state).toBe('idle');
    await monitor.start({ installerPath: installer });
    expect(monitor.status().state).toBe('installing');
    expect(deps.captureSystemState).toHaveBeenCalledTimes(1);
    expect(deps.captureFiles).toHaveBeenCalledTimes(1);
    expect(deps.launch).toHaveBeenCalledWith(installer);
    // The snapshot is taken before the installer is started, not after.
    expect(deps.captureFiles.mock.invocationCallOrder[0]).toBeLessThan(deps.launch.mock.invocationCallOrder[0]);
  });

  it('finishes by itself when an installer that ran a while exits cleanly, and saves a trace linked to the new program', async () => {
    const { monitor, saved, exit, advance } = harness();
    await monitor.start({ installerPath: installer });
    advance(MIN_AUTO_FINISH_MS + 1);
    exit({ code: 0 });
    const done = await waitForState(monitor, 'done');

    expect(saved).toHaveLength(1);
    const trace = saved[0];
    expect(trace.program).toMatchObject({ name: 'Acme', publisher: 'Acme Inc', version: '2.0', registryKey: 'HKLM:\\SOFTWARE\\U\\Acme', installLocation: 'D:\\Acme' });
    expect(trace.installer).toBe(installer);
    expect(trace.files).toEqual([{ path: 'D:\\Acme', isDirectory: true, sizeBytes: 500 }]);
    expect(trace.modifiedFileCount).toBe(3);
    expect(trace.registry).toEqual([
      { path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\U\\Acme' },
      { path: 'HKEY_CURRENT_USER\\Run', valueName: 'AcmeTray' }
    ]);
    expect(trace.services).toEqual([{ name: 'AcmeSvc', pathName: 'D:\\Acme\\svc.exe' }]);
    // Windows' own tasks are never recorded.
    expect(trace.tasks).toEqual([{ name: 'AcmeTask', path: '\\Acme\\' }]);
    expect(done.trace).toMatchObject({ id: trace.id, programName: 'Acme' });
  });

  it('waits for the person when a launcher exits quickly, then finishes on "Done installing"', async () => {
    const { monitor, saved, exit, advance } = harness();
    await monitor.start({ installerPath: installer });
    advance(2000);
    exit({ code: 0 });
    await waitForState(monitor, 'exited');
    expect(saved).toHaveLength(0);

    await monitor.finish();
    await waitForState(monitor, 'done');
    expect(saved).toHaveLength(1);
  });

  it('can be finished while the installer is still running', async () => {
    const { monitor, saved } = harness();
    await monitor.start({ installerPath: installer });
    await monitor.finish();
    await waitForState(monitor, 'done');
    expect(saved).toHaveLength(1);
  });

  it('records nothing and says why when the installer could not be started', async () => {
    const { monitor, saved, exit } = harness();
    await monitor.start({ installerPath: installer });
    exit({ code: 3, error: 'The operation was canceled by the user.' });
    const status = await waitForState(monitor, 'failed');
    expect(status.error).toMatch(/canceled by the user/);
    expect(saved).toHaveLength(0);
  });

  it('records nothing when cancelled, and can start again', async () => {
    const { monitor, saved, deps } = harness();
    await monitor.start({ installerPath: installer });
    monitor.cancel();
    expect(monitor.status().state).toBe('idle');
    expect(saved).toHaveLength(0);
    deps.captureSystemState.mockResolvedValue(state());
    await monitor.start({ installerPath: installer });
    expect(monitor.status().state).toBe('installing');
  });

  it('keeps a trace with no program when the installer added no Add/Remove entry', async () => {
    const { monitor, saved } = harness({ afterState: state() });
    await monitor.start({ installerPath: installer });
    await monitor.finish();
    const done = await waitForState(monitor, 'done');
    expect(saved[0].program).toBeNull();
    expect(done.trace.programName).toBeNull();
  });

  it('marks the trace partial when a snapshot ran out of budget', async () => {
    const { monitor, saved } = harness({ deps: {
      diffFiles: vi.fn(async () => ({ added: [], modified: 0, addedTruncated: false, truncated: true }))
    } });
    await monitor.start({ installerPath: installer });
    await monitor.finish();
    await waitForState(monitor, 'done');
    expect(saved[0].partial).toBe(true);
  });

  it('allows one monitored install at a time', async () => {
    const { monitor } = harness();
    await monitor.start({ installerPath: installer });
    await expect(monitor.start({ installerPath: installer })).rejects.toThrow(/already/i);
  });

  it('refuses an installer that is not a file it can run, before snapshotting anything', async () => {
    const { monitor, deps } = harness();
    await expect(monitor.start({ installerPath: join(dir, 'nope.exe') })).rejects.toThrow();
    expect(deps.captureSystemState).not.toHaveBeenCalled();
    expect(monitor.status().state).toBe('idle');
  });

  it('reports a snapshot that fails and goes back to idle', async () => {
    const { monitor, deps } = harness();
    deps.captureSystemState.mockReset();
    deps.captureSystemState.mockRejectedValue(new Error('registry unreadable'));
    await expect(monitor.start({ installerPath: installer })).rejects.toThrow(/registry unreadable/);
    expect(monitor.status().state).toBe('idle');
    expect(deps.launch).not.toHaveBeenCalled();
  });

  it('reports an analysis that fails, without leaving a trace', async () => {
    const { monitor, saved } = harness({ deps: { diffFiles: vi.fn(async () => { throw new Error('disk gone'); }) } });
    await monitor.start({ installerPath: installer });
    await monitor.finish();
    const status = await waitForState(monitor, 'failed');
    expect(status.error).toMatch(/disk gone/);
    expect(saved).toHaveLength(0);
  });
});
