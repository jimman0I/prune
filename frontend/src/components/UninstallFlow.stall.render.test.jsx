// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act, fireEvent } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The safety valve on a hung vendor uninstaller.
 *
 * Escape and Close are locked while a removal runs, so that a dialog cannot
 * vanish from in front of a process that is still going. But an uninstaller
 * waiting on a prompt nobody can see would then trap the person in the dialog.
 * After 30 s the single-program dialog says so and lets go, for the
 * uninstaller step only; the batch dialog never lets go (its loop would carry
 * on invisibly) and instead puts Stop in front and says where the vendor's
 * window may be. The api is mocked and nothing is removed. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const removeQuarantined = vi.fn();
const appendHistoryEntry = vi.fn(async () => {});
const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(),
  scanForcedUninstall: vi.fn(),
  removeStoreApp: vi.fn()
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;
const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

const mk = (id, name) => ({ id, name, publisher: 'Acme', sizeBytes: 1, uninstallString: `"C:\\${name}\\u.exe"` });
const thing = mk('thing', 'Thing');
const deferred = () => {
  let resolve;
  const promise = new Promise((res) => { resolve = res; });
  return { promise, resolve };
};
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const advance = (ms) => act(() => { vi.advanceTimersByTime(ms); });

const STILL_SINGLE = 'Still waiting for the uninstaller. You can close this window; the uninstaller keeps running, and Prune will not scan for leftovers.';

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockReset();
  scanForLeftovers.mockResolvedValue({ files: { ok: true, items: [{ path: 'C:\\x', sizeBytes: 1 }] }, registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] } });
  removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [], registryKeys: [], totalSizeBytes: 0 });
  fetchSettings.mockResolvedValue({});
});
afterEach(() => { vi.useRealTimers(); });

const closeButton = () => screen.getAllByRole('button', { name: 'Close' })[0];

describe('single-program dialog: the uninstaller step', () => {
  const start = async (props = {}) => {
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    const onBusyChange = vi.fn();
    const onClose = vi.fn();
    const utils = renderScreen(<UninstallModal program={thing} onClose={onClose} onBusyChange={onBusyChange} {...props} />);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await flush();
    return { run, onBusyChange, onClose, ...utils };
  };

  it('nothing at 29 s; the line, and Close, at 31 s', async () => {
    const { onBusyChange } = await start();
    await advance(29000);
    expect(screen.queryByText(STILL_SINGLE)).toBeNull();
    expect(closeButton().disabled).toBe(true);
    expect(onBusyChange).toHaveBeenLastCalledWith(true);

    await advance(2000);
    expect(screen.getByText(STILL_SINGLE)).toBeTruthy();
    expect(closeButton().disabled).toBe(false);
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('closing then never scans or removes anything, even after the uninstaller exits', async () => {
    const { run, unmount } = await start();
    await advance(31000);
    unmount(); // what App does when Close or Escape is used
    await act(async () => { run.resolve(); await run.promise; });
    await advance(120000);
    await flush();
    expect(scanForLeftovers).not.toHaveBeenCalled();
    expect(removeQuarantined).not.toHaveBeenCalled();
  });

  it('if it is left open and the uninstaller does exit, the dialog carries on to the scan gate as ever', async () => {
    const { run, onBusyChange } = await start();
    await advance(31000);
    await act(async () => { run.resolve(); await run.promise; });
    await flush();
    expect(screen.getByRole('button', { name: 'Scan for leftovers' })).toBeTruthy();
    expect(screen.queryByText(STILL_SINGLE)).toBeNull();
    expect(scanForLeftovers).not.toHaveBeenCalled(); // still waits for the click
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it('the scan and the removal stay locked however long they take', async () => {
    const { run } = await start();
    await act(async () => { run.resolve(); await run.promise; });
    await flush();
    const scan = deferred();
    scanForLeftovers.mockReturnValue(scan.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Scan for leftovers' }));
    await flush();
    await advance(120000);
    expect(closeButton().disabled).toBe(true);
    expect(screen.queryByText(STILL_SINGLE)).toBeNull();

    // ...and the removal.
    scan.resolve({ files: { ok: true, items: [{ path: 'C:\\x', sizeBytes: 1 }] }, registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] } });
    await flush();
    const removal = deferred();
    removeQuarantined.mockReturnValue(removal.promise);
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected' }));
    await flush();
    await advance(120000);
    expect(closeButton().disabled).toBe(true);
  });
});

describe('batch dialog', () => {
  const startBatch = async () => {
    const first = deferred();
    const second = deferred();
    streamUninstall.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const onClose = vi.fn();
    renderScreen(<BatchUninstallModal programs={[thing, mk('b', 'Bee')]} onClose={onClose} />);
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await flush();
    return { first, second, onClose };
  };
  const STILL_BATCH = 'Still waiting on this uninstaller. Its own window may be behind Prune. Choose Stop after this one to skip the remaining programs once it finishes.';

  it('at 29 s nothing; at 31 s the line and a prominent Stop, and Close stays locked', async () => {
    await startBatch();
    await advance(29000);
    expect(screen.queryByText(/Still waiting on this uninstaller/)).toBeNull();
    const stop = () => screen.getByRole('button', { name: 'Stop after this one' });
    expect(stop().hasAttribute('data-stop-prominent')).toBe(false);
    expect(stop().className).toContain('btn-ghost');

    await advance(2000);
    expect(screen.getByText(STILL_BATCH)).toBeTruthy();
    expect(stop().hasAttribute('data-stop-prominent')).toBe(true);
    expect(stop().className).toContain('btn-primary');
    // Never closable mid-run: the loop would go on uninstalling with no window.
    expect(closeButton().disabled).toBe(true);
  });

  it('each program gets its own 30 s', async () => {
    const { first } = await startBatch();
    await advance(31000);
    expect(screen.getByText(/Still waiting on this uninstaller/)).toBeTruthy();
    await act(async () => { first.resolve(); await first.promise; });
    await flush();
    // The second program has just started.
    expect(screen.queryByText(/Still waiting on this uninstaller/)).toBeNull();
    await advance(29000);
    expect(screen.queryByText(/Still waiting on this uninstaller/)).toBeNull();
    await advance(2000);
    expect(screen.getByText(/Still waiting on this uninstaller/)).toBeTruthy();
  });

  it('on the last program there is nothing left to skip, so the line does not promise it', async () => {
    const { first } = await startBatch();
    await act(async () => { first.resolve(); await first.promise; });
    await flush();
    await advance(31000);
    expect(screen.getByText('Still waiting on this uninstaller. Its own window may be behind Prune.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Stop after this one' })).toBeNull();
  });
});

describe('in Greek', () => {
  it('translates both lines', async () => {
    fetchSettings.mockResolvedValue({ language: 'el' });
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    renderScreen(<UninstallModal program={thing} onClose={vi.fn()} />);
    const startBtn = await screen.findByRole('button', { name: 'Έναρξη απεγκατάστασης' });
    vi.useFakeTimers();
    fireEvent.click(startBtn);
    await flush();
    await advance(31000);
    expect(screen.getByText(/Αναμονή για το πρόγραμμα απεγκατάστασης\./)).toBeTruthy();
  });

  it('translates the batch line', async () => {
    fetchSettings.mockResolvedValue({ language: 'el' });
    streamUninstall.mockReturnValue(new Promise(() => {}));
    renderScreen(<BatchUninstallModal programs={[thing, mk('b', 'Bee')]} onClose={vi.fn()} />);
    const startBtn = await screen.findByRole('button', { name: 'Έναρξη απεγκατάστασης' });
    vi.useFakeTimers();
    fireEvent.click(startBtn);
    await flush();
    await advance(31000);
    expect(screen.getByText(/Αναμονή για αυτό το πρόγραμμα απεγκατάστασης\./)).toBeTruthy();
  });
});
