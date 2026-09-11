// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Store apps in a batch uninstall.
 *
 * They were excluded from the batch entirely -- "removed through Windows,
 * not an uninstaller" -- which stopped being true when 2.3.0 added Store
 * removal in-app. They now join the batch, but they are not the same act
 * as the rest of it, and this file is mostly about the three ways they
 * differ:
 *
 *   1. They go through removeStoreApp (Remove-AppxPackage), never through
 *      the uninstall stream, which runs a registered command a Store app
 *      does not have.
 *   2. They are not followed by a leftover scan. That scan searches by
 *      name AND publisher, and most Store apps on the dev machine share one
 *      publisher -- Microsoft. A publisher search for it would offer to
 *      quarantine a large part of Windows.
 *   3. They cannot be restored. Everything else a batch removes goes
 *      through Quarantine; this does not, and the confirm step says so
 *      before anything runs.
 *
 * Nothing here removes anything: the api module is mocked, and what is
 * asserted is which call each program was handed to.
 */

const streamUninstall = vi.fn();
const removeStoreApp = vi.fn();
const scanForLeftovers = vi.fn(async () => ({ files: { items: [] }, registryKeys: { items: [] } }));
const appendHistoryEntry = vi.fn(async () => {});

vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  removeStoreApp: (...a) => removeStoreApp(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  removeQuarantined: vi.fn(async () => ({ files: [], registryKeys: [] })),
  scanForcedUninstall: vi.fn(),
  // The dialog reads settings now (where leftovers go, whether they
  // start ticked). Empty settings are the defaults it always had.
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

const calculator = {
  id: 'store:Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe',
  name: 'Calculator', publisher: 'Microsoft Corporation', sizeBytes: 1024,
  source: 'store', nonRemovable: false,
  packageFullName: 'Microsoft.WindowsCalculator_11.2210.0.0_x64__8wekyb3d8bbwe'
};
const thing = {
  id: 'thing', name: 'Thing', publisher: 'Acme', sizeBytes: 2048,
  uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"', installLocation: null
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockImplementation(async () => {});
  removeStoreApp.mockImplementation(async () => ({ ok: true }));
});

const startBatch = async (programs) => {
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={programs} onClose={() => {}} onFinished={() => {}} />);
  await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
};

describe('a Store app in a batch', () => {
  it('is removed through the Store remover, by its package name', async () => {
    await startBatch([calculator, thing]);

    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(1));
    expect(removeStoreApp).toHaveBeenCalledWith(calculator.packageFullName);
    // And never through the uninstall stream, which would run a registered
    // command a Store app does not have.
    expect(streamUninstall.mock.calls.map((c) => c[0])).toEqual(['thing']);
  });

  it('is not followed by a leftover scan', async () => {
    /* The registry program still is -- that is what the scan is for. The
     * Store app is not, because the scan matches on publisher, and on the
     * dev machine most Store apps are Microsoft's. */
    await startBatch([calculator, thing]);

    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    const scannedPublishers = scanForLeftovers.mock.calls.map((c) => c[1]);
    expect(scannedPublishers).toEqual(['Acme']);
  });

  it('is logged to history like any other removal', async () => {
    // The dashboard's record of what past removals freed. A Store removal
    // that went unrecorded would make that record quietly wrong.
    await startBatch([calculator]);

    await waitFor(() => expect(appendHistoryEntry).toHaveBeenCalledTimes(1));
    expect(appendHistoryEntry).toHaveBeenCalledWith({
      programName: 'Calculator', publisher: 'Microsoft Corporation', sizeBytes: 1024
    });
  });

  it('does not stop the rest of the batch when Windows refuses it', async () => {
    removeStoreApp.mockRejectedValue(new Error('The package is currently in use.'));
    await startBatch([calculator, thing]);

    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(1));
    expect(streamUninstall.mock.calls[0][0]).toBe('thing');
    // A refused removal is not a removal, and must not be logged as one.
    expect(appendHistoryEntry.mock.calls.map((c) => c[0].programName)).toEqual(['Thing']);
  });
});

describe('the confirm step', () => {
  it('says the Store removals cannot be undone, before anything runs', () => {
    /* Everything else in this dialog is backed by Quarantine, and its own
     * text says Prune shows you everything before removing any of it. A
     * Store removal breaks that promise, so the dialog has to say so here
     * -- where the decision is made -- not in a changelog. */
    renderScreen(<BatchUninstallModal programs={[calculator, thing]} onClose={() => {}} onFinished={() => {}} />);

    expect(screen.getByText(/cannot be restored from Quarantine/i)).toBeTruthy();
    expect(removeStoreApp).not.toHaveBeenCalled();
  });

  it('does not show that warning for a batch with no Store apps', () => {
    renderScreen(<BatchUninstallModal programs={[thing]} onClose={() => {}} onFinished={() => {}} />);
    expect(screen.queryByText(/cannot be restored from Quarantine/i)).toBeNull();
  });
});

describe('what the confirm step says will happen', () => {
  /* Its opening lines describe the registry path -- an uninstaller runs,
   * then a leftover scan -- and they were written before Store apps could
   * join a batch. For a Store app neither happens, so a batch of only
   * Store apps was promised two things it would not do. */
  it('does not promise an uninstaller or a leftover scan for a Store-only batch', () => {
    renderScreen(<BatchUninstallModal programs={[calculator]} onClose={() => {}} onFinished={() => {}} />);

    expect(screen.queryByText(/uninstaller runs/i)).toBeNull();
    expect(screen.queryByText(/scans for what/i)).toBeNull();
    expect(screen.queryByText(/own windows/i)).toBeNull();
    expect(screen.getByText(/removed through Windows/i)).toBeTruthy();
    expect(screen.getByText(/no leftover scan/i)).toBeTruthy();
  });

  it('says which programs are scanned in a mixed batch', () => {
    renderScreen(<BatchUninstallModal programs={[calculator, thing]} onClose={() => {}} onFinished={() => {}} />);

    expect(screen.getByText(/scans for what/i)).toBeTruthy();
    expect(screen.getByText(/Store apps are removed through Windows/i)).toBeTruthy();
    // The registry program can still open its own wizard.
    expect(screen.getByText(/own windows/i)).toBeTruthy();
  });

  it('keeps the uninstaller wording, and nothing about Store apps, when there are none', () => {
    renderScreen(<BatchUninstallModal programs={[thing]} onClose={() => {}} onFinished={() => {}} />);

    expect(screen.getByText(/scans for what/i)).toBeTruthy();
    expect(screen.getByText(/own windows/i)).toBeTruthy();
    expect(screen.queryByText(/removed through Windows/i)).toBeNull();
  });
});

describe('the review after a batch that scanned nothing', () => {
  /* "No leftovers found -- clean uninstall" is LeftoverReview's answer to
   * an empty scan result. When no scan ran at all, that result is empty
   * for a different reason, and the sentence claims a check that never
   * happened: after a Store-only batch, and after a batch where every
   * uninstall failed and nothing was removed. */
  const run = async (programs) => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={onClose} onFinished={onFinished} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    return { user, onClose, onFinished };
  };

  it('does not call a Store-only batch a clean uninstall', async () => {
    const { user, onClose, onFinished } = await run([calculator]);

    await screen.findByText(/Uninstalled 1 of 1/);
    expect(screen.queryByText(/No leftovers found/i)).toBeNull();
    expect(screen.getByText(/no leftover scan/i)).toBeTruthy();

    // Still a way out, and it finishes the batch the same way.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call a batch where every uninstall failed a clean uninstall', async () => {
    streamUninstall.mockRejectedValue(new Error('The uninstaller exited with code 1603.'));
    await run([thing]);

    await screen.findByText(/couldn't be uninstalled/i);
    expect(screen.queryByText(/No leftovers found/i)).toBeNull();
    // Nothing was removed, so there is nothing to say about a scan either.
    expect(screen.queryByText(/leftover scan/i)).toBeNull();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('still reports a clean uninstall when a scan ran and found nothing', async () => {
    // The case the sentence is FOR. Guarding the two above must not lose it.
    await run([thing]);

    expect(await screen.findByText(/No leftovers found/i)).toBeTruthy();
  });
});
