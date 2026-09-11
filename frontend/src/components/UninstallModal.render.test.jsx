// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

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

    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    expect(removeQuarantined.mock.calls[0][0].destination).toBe('quarantine');
  });

  it('says the Recycle Bin when that is where they went', async () => {
    fetchSettings.mockResolvedValue({ leftoverDestination: 'recycle' });
    removeQuarantined.mockResolvedValue({ destination: 'recycle', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], failedFiles: [], totalSizeBytes: 2048 });
    const { user } = await uninstall();

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

    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));
    expect(await screen.findByText(/couldn.t be removed/i)).toBeTruthy();
    expect(screen.getByText(/The file is in use/)).toBeTruthy();
  });
});

describe('ticking leftovers', () => {
  it('starts with everything ticked, as it always has', async () => {
    await uninstall();
    expect(await screen.findByText(/^2$/)).toBeTruthy();
  });

  it('starts with nothing ticked when the setting is off', async () => {
    fetchSettings.mockResolvedValue({ preselectLeftovers: false });
    await uninstall();
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
});
