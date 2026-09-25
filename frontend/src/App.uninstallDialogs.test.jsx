// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from './testSupport/renderScreen.jsx';

/** The three removal dialogs, mounted the way App mounts them.
 *
 * What is being protected here is one bug and its two follow-ups. Escape
 * closed an uninstall dialog while the uninstaller was still running: the
 * process carried on behind a screen that had stopped saying anything about
 * it. App never passed `dismissible` to any of the three overlays, so the
 * shell's guard for exactly this case was dead code.
 *
 * ProgramList is stubbed to three buttons that hand the dialogs a program;
 * everything from the overlay inward is real. The api module is mocked and
 * nothing is removed: what a test controls is when the mocked uninstaller
 * finishes.
 */

vi.mock('./components/ProgramList.jsx', () => ({
  default: ({ onUninstall, onBatchUninstall, onRemoveStoreApp }) => {
    const thing = { id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Thing\\uninst.exe"', sizeBytes: 1024 };
    const other = { id: 'other', name: 'Other', publisher: 'Acme', uninstallString: '"C:\\Other\\uninst.exe"', sizeBytes: 2048 };
    const calc = { id: 'store:calc', name: 'Calculator', publisher: 'Microsoft', source: 'store', packageFullName: 'Calc_1.0_x64__abc', sizeBytes: 4096 };
    return (
      <div>
        <button onClick={() => onUninstall(thing)}>open single</button>
        <button onClick={() => onBatchUninstall([thing, other])}>open batch</button>
        <button onClick={() => onRemoveStoreApp(calc)}>open store</button>
      </div>
    );
  }
}));
const stub = (name) => () => <div>{name} screen</div>;
vi.mock('./components/Dashboard.jsx', () => ({ default: stub('dashboard') }));
vi.mock('./components/DiskMap.jsx', () => ({ default: stub('diskmap') }));
vi.mock('./components/QuarantineManager.jsx', () => ({ default: stub('quarantine') }));
vi.mock('./components/StartupItems.jsx', () => ({ default: stub('startup') }));
vi.mock('./components/SettingsPage.jsx', () => ({ default: stub('settings') }));
vi.mock('./components/DeepClean.jsx', () => ({ default: stub('deepclean') }));
vi.mock('./components/Duplicates.jsx', () => ({ default: stub('duplicates') }));

const streamUninstall = vi.fn();
const removeStoreApp = vi.fn();
vi.mock('./lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  removeStoreApp: (...a) => removeStoreApp(...a),
  scanForLeftovers: vi.fn(async () => ({ files: { ok: true, items: [] }, registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] } })),
  scanForcedUninstall: vi.fn(async () => ({})),
  removeQuarantined: vi.fn(async () => ({ files: [], registryKeys: [] })),
  appendHistoryEntry: vi.fn(async () => ({})),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async () => ({})),
  fetchUpdateCheck: vi.fn(async () => ({ enabled: false, current: '0.0.0' })),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(async () => []),
  fetchStartupIcons: vi.fn(async () => ({})),
  fetchQuarantineBatches: vi.fn(async () => ({ batches: [] })),
  fetchProgramIcons: vi.fn(async () => ({})),
  fetchPackageIcons: vi.fn(async () => ({}))
}));

const refresh = vi.fn();
vi.mock('./hooks/usePrograms.js', () => ({
  useProgramData: () => ({
    programs: [], icons: {}, totalSize: 0, extensions: [], running: {},
    loading: false, error: null, refresh: (...a) => refresh(...a)
  })
}));

const App = (await import('./App.jsx')).default;

/** A promise the test settles by hand: the uninstaller "running". */
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
};

const mount = async () => {
  const utils = renderScreen(<App />);
  const invalidate = vi.spyOn(utils.client, 'invalidateQueries');
  // Ctrl+3: Applications, where the (stubbed) list lives.
  fireEvent.keyDown(document.body, { key: '3', ctrlKey: true });
  return { ...utils, invalidate, user: userEvent.setup() };
};

const escape = () => fireEvent.keyDown(document.body, { key: 'Escape' });
const dialog = () => screen.queryByRole('dialog');

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Escape while a removal is running', () => {
  it('does not close the single-program dialog, and does once the uninstaller has finished', async () => {
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    const { user } = await mount();

    await user.click(screen.getByRole('button', { name: 'open single' }));
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    expect(await screen.findByRole('progressbar')).toBeTruthy();

    escape();
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true);

    await act(async () => { run.resolve(); await run.promise; });
    // Finished: waiting on the person again, so Escape is allowed.
    await screen.findByRole('button', { name: 'Scan for leftovers' });
    escape();
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('does not close the batch dialog while the queue runs', async () => {
    const run = deferred();
    streamUninstall.mockReturnValue(run.promise);
    const { user } = await mount();

    await user.click(screen.getByRole('button', { name: 'open batch' }));
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await screen.findByText('uninstalling…');

    escape();
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Close' }).disabled).toBe(true);

    await act(async () => { run.resolve(); await run.promise; });
    await screen.findByRole('button', { name: 'Scan for leftovers' });
    escape();
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('does not close the Store dialog while the package is being removed', async () => {
    const run = deferred();
    removeStoreApp.mockReturnValue(run.promise);
    const { user } = await mount();

    await user.click(screen.getByRole('button', { name: 'open store' }));
    await user.click(screen.getByRole('button', { name: 'Remove app' }));
    await waitFor(() => expect(removeStoreApp).toHaveBeenCalledTimes(1));

    escape();
    expect(dialog()).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Cancel' }).disabled).toBe(true);

    await act(async () => { run.resolve({ ok: true }); await run.promise; });
    await screen.findByRole('button', { name: 'Close' });
    escape();
    await waitFor(() => expect(dialog()).toBeNull());
  });

  it('still closes a dialog that is only asking, as it always did', async () => {
    const { user } = await mount();
    await user.click(screen.getByRole('button', { name: 'open single' }));
    expect(dialog()).not.toBeNull();
    escape();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(streamUninstall).not.toHaveBeenCalled();
  });
});

describe('what closing a dialog does', () => {
  it.each([
    ['single', 'open single'],
    ['batch', 'open batch'],
    ['store', 'open store']
  ])('refreshes the program list and re-reads Quarantine after the %s dialog', async (_name, opener) => {
    const { user, invalidate } = await mount();
    await user.click(screen.getByRole('button', { name: opener }));
    refresh.mockClear();
    invalidate.mockClear();

    // The dialog's own close button, which every one of them has.
    await user.click(screen.getAllByRole('button', { name: /^(Close|Cancel)$/ })[0]);
    await waitFor(() => expect(dialog()).toBeNull());

    expect(refresh).toHaveBeenCalled();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['quarantine'] });
  });

  it('refreshes when Escape closes it too, not only its own buttons', async () => {
    const { user, invalidate } = await mount();
    await user.click(screen.getByRole('button', { name: 'open single' }));
    refresh.mockClear();
    invalidate.mockClear();

    escape();
    await waitFor(() => expect(dialog()).toBeNull());
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['quarantine'] });
  });
});
