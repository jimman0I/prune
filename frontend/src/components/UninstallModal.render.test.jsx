// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The single-program uninstall, and the settings that now shape it:
 * where leftovers go, whether they start ticked, and whether a leftover
 * scan follows at all. The api module is mocked; nothing is removed. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const removeQuarantined = vi.fn();
const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(),
  scanForcedUninstall: vi.fn(),
  appendHistoryEntry: vi.fn(async () => {})
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;

const program = { id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"' };
const found = {
  files: { ok: true, items: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', sizeBytes: 2048 }] },
  registryKeys: { ok: true, items: [{ path: 'HKCU\\Software\\Thing' }] },
  scheduledTasks: { ok: true, items: [] }
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048 });
  fetchSettings.mockResolvedValue({});
});

const uninstall = async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  renderScreen(<UninstallModal program={program} onClose={onClose} />);
  await user.click(screen.getByRole('button', { name: 'Start uninstall' }));
  return { user, onClose };
};

describe('where the leftovers go', () => {
  it('sends the destination from settings, the one the review showed', async () => {
    fetchSettings.mockResolvedValue({ leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({ destination: 'permanent', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: [], failedFiles: [], totalSizeBytes: 2048 });
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    expect(removeQuarantined.mock.calls[0][0].destination).toBe('permanent');
    expect(await screen.findByText(/deleted 1 item permanently/i)).toBeTruthy();
  });

  it('uses Quarantine when settings cannot be read', async () => {
    // The safe default for the one fact that decides whether a removal can
    // be undone. Never a guess in the other direction.
    fetchSettings.mockRejectedValue(new Error('backend down'));
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    expect(removeQuarantined.mock.calls[0][0].destination).toBe('quarantine');
  });

  it('says the Recycle Bin when that is where they went', async () => {
    fetchSettings.mockResolvedValue({ leftoverDestination: 'recycle' });
    removeQuarantined.mockResolvedValue({ destination: 'recycle', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], failedFiles: [], totalSizeBytes: 2048 });
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    expect(await screen.findByText(/sent 1 item to the Recycle Bin/i)).toBeTruthy();
  });

  it('names what could not be removed', async () => {
    fetchSettings.mockResolvedValue({ leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({
      destination: 'permanent', files: [], registryKeys: [], totalSizeBytes: 0,
      failedFiles: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', reason: 'The file is in use.' }]
    });
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText(/couldn.t be removed/i)).toBeTruthy();
    expect(screen.getByText(/The file is in use/)).toBeTruthy();
  });
});

describe('what can be copied', () => {
  it('the uninstall command it is about to run', () => {
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    expect(isCopyable(screen.getByText(/uninst\.exe/))).toBe(true);
    expect(isCopyable(screen.getByRole('button', { name: 'Start uninstall' }))).toBe(false);
  });

  it('the reason an uninstall failed', async () => {
    streamUninstall.mockRejectedValue(new Error('The uninstaller exited with code 1603.'));
    await uninstall();

    expect(isCopyable(await screen.findByText(/exited with code 1603/))).toBe(true);
  });

  it('the reason a leftover search failed, for a program whose uninstaller is gone', async () => {
    // The forced path searches with scanForcedUninstall only. A queued
    // rejection on any other mock would outlive this test -- clearAllMocks
    // does not empty a mockRejectedValueOnce queue -- and fail the next.
    const { scanForcedUninstall } = await import('../lib/api.js');
    scanForcedUninstall.mockRejectedValueOnce(new Error('The registry could not be read.'));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={{ ...program, health: { orphaned: true } }} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Search for leftovers' }));
    expect(isCopyable(await screen.findByText(/Scan failed: The registry could not be read/))).toBe(true);
  });

  it('the reason a removal failed', async () => {
    removeQuarantined.mockRejectedValue(new Error('EACCES: permission denied'));
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    expect(isCopyable(await screen.findByText(/Removal failed: EACCES/))).toBe(true);
  });

  it('each item that could not be removed, and why', async () => {
    fetchSettings.mockResolvedValue({ leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({
      destination: 'permanent', files: [], registryKeys: [], totalSizeBytes: 0,
      failedFiles: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', reason: 'The file is in use.' }]
    });
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));
    expect(isCopyable(await screen.findByText(/The file is in use/))).toBe(true);
  });
});

describe('ticking leftovers', () => {
  it('starts with everything ticked, as it always has', async () => {
    const { user } = await uninstall();
    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    expect(await screen.findByText(/^2$/)).toBeTruthy();
  });

  it('starts with nothing ticked when the setting is off', async () => {
    fetchSettings.mockResolvedValue({ preselectLeftovers: false });
    const { user } = await uninstall();
    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    expect(await screen.findByText(/^0$/)).toBeTruthy();
  });
});

describe('the leftover scan', () => {
  it('is skipped when turned off, and the dialog says so', async () => {
    fetchSettings.mockResolvedValue({ scanLeftoversAfterUninstall: false });
    await uninstall();

    expect(await screen.findByText(/leftover scan is turned off/i)).toBeTruthy();
    expect(scanForLeftovers).not.toHaveBeenCalled();
  });

  it('never runs after an uninstall that failed', async () => {
    streamUninstall.mockRejectedValue(new Error('The registry backup failed, so the uninstall did not run: disk full'));
    await uninstall();

    expect(await screen.findByText(/so the uninstall did not run: disk full/)).toBeTruthy();
    expect(scanForLeftovers).not.toHaveBeenCalled();
  });

  it('lands on a manual readyToScan step after a real uninstall, without scanning yet -- Revo-style, no racing the still-finishing native uninstaller', async () => {
    await uninstall();

    expect(await screen.findByRole('button', { name: 'Scan' })).toBeTruthy();
    expect(scanForLeftovers).not.toHaveBeenCalled();
  });

  it('only scans once Scan is clicked on the readyToScan step, then proceeds through scanning to review', async () => {
    const { user } = await uninstall();

    const scanButton = await screen.findByRole('button', { name: 'Scan' });
    expect(scanForLeftovers).not.toHaveBeenCalled();
    await user.click(scanButton);

    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/^2$/)).toBeTruthy(); // review step, everything preselected
  });

  it('closes without ever scanning when Close is clicked on the readyToScan step', async () => {
    const { user, onClose } = await uninstall();

    await screen.findByRole('button', { name: 'Scan' });
    // Two "Close" buttons exist once the readyToScan step is up: the
    // dialog header's own, and the readyToScan step's cancel action --
    // both wired to onClose, but this test targets the new one, which
    // renders last in document order.
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[closeButtons.length - 1]);

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(scanForLeftovers).not.toHaveBeenCalled();
  });

  it('returns to readyToScan, not confirm, when the scan itself fails -- the real uninstall already ran', async () => {
    scanForLeftovers.mockRejectedValueOnce(new Error('The registry could not be read.'));
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    expect(await screen.findByText(/Scan failed: The registry could not be read/)).toBeTruthy();
    // Still on readyToScan (Scan button is back), not the normal-flow confirm view.
    expect(screen.getByRole('button', { name: 'Scan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start uninstall' })).toBeNull();
  });
});

describe('the "automatically delete all found leftovers" checkbox', () => {
  it('is unticked by default, and the flow still lands on review after Scan -- unchanged regression coverage', async () => {
    const { user } = await uninstall();

    await user.click(await screen.findByRole('button', { name: 'Scan' }));
    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    // The review screen renders (its own "Remove selected" action), and
    // removeQuarantined has NOT run yet -- it waits for that click, exactly
    // as before this checkbox existed.
    expect(await screen.findByRole('button', { name: 'Remove selected' })).toBeTruthy();
    expect(removeQuarantined).not.toHaveBeenCalled();
  });

  it('skips review entirely when ticked before Scan, removing everything the scan found through the same quarantine call', async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={onClose} />);
    // The checkbox lives on the confirm step, above "Start uninstall" --
    // it has to be ticked before that click, not after.
    await user.click(screen.getByRole('checkbox', { name: /Automatically remove everything the scan finds/i }));
    await user.click(screen.getByRole('button', { name: 'Start uninstall' }));
    await user.click(await screen.findByRole('button', { name: 'Scan' }));

    // Lands on 'done' without ever rendering the review step's own controls.
    expect(await screen.findByRole('button', { name: 'Done' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove selected' })).toBeNull();

    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    const call = removeQuarantined.mock.calls[0][0];
    // `found` has one file and one registry key -- both must be present,
    // proving the full set was sent, not a partial/empty one.
    expect(call.files).toEqual(['C:\\Users\\jim\\AppData\\Roaming\\Thing']);
    expect(call.registryKeys).toEqual(['HKCU\\Software\\Thing']);
    expect(call.programName).toBe('Thing');
  });

  it('falls back to review, with the error shown, when removeQuarantined itself throws during auto-remove', async () => {
    removeQuarantined.mockRejectedValue(new Error('EACCES: permission denied'));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await user.click(screen.getByRole('checkbox', { name: /Automatically remove everything the scan finds/i }));
    await user.click(screen.getByRole('button', { name: 'Start uninstall' }));
    await user.click(await screen.findByRole('button', { name: 'Scan' }));

    expect(await screen.findByText(/Removal failed: EACCES/)).toBeTruthy();
    // Landed on the manual review screen, not stuck or silently dropped.
    expect(await screen.findByRole('button', { name: 'Remove selected' })).toBeTruthy();
  });
});
