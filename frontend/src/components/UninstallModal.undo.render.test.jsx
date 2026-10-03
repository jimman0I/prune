// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** Uninstall leftovers moved to Quarantine: the toast that says so has Undo, and
 * only then -- not for the Recycle Bin, not for Delete permanently. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const removeQuarantined = vi.fn();
const restoreQuarantineBatch = vi.fn();
const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
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
const quarantined = {
  destination: 'quarantine', batchDir: 'C:\\q\\1-Thing',
  files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue(quarantined);
  restoreQuarantineBatch.mockResolvedValue({});
  fetchSettings.mockResolvedValue({ preselectLeftovers: true });
});

async function removeLeftovers(button = 'Remove selected') {
  const user = userEvent.setup();
  renderScreen(<><UninstallModal program={program} onClose={() => {}} /><ToastHost /></>);
  await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
  await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));
  await user.click(await screen.findByRole('button', { name: button }));
  await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
  return user;
}

describe('Undo after leftovers go to Quarantine', () => {
  it('is on the toast, naming the program', async () => {
    await removeLeftovers();
    expect(await screen.findByText('Leftovers of Thing moved to Quarantine.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('brings the batch back through the Quarantine API', async () => {
    const user = await removeLeftovers();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(restoreQuarantineBatch).toHaveBeenCalledWith('C:\\q\\1-Thing');
    expect(await screen.findByText('Restored from Quarantine.')).toBeTruthy();
  });

  it('says so when the batch has since been emptied', async () => {
    restoreQuarantineBatch.mockRejectedValue(new Error("ENOENT: no such file or directory, open 'manifest.json'"));
    const user = await removeLeftovers();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText("This is no longer in Quarantine, so it can't be restored.")).toBeTruthy();
  });

  it('is not offered when the leftovers were deleted permanently', async () => {
    fetchSettings.mockResolvedValue({ preselectLeftovers: true, leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({ destination: 'permanent', batchDir: null, files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: [], totalSizeBytes: 2048 });
    await removeLeftovers('Delete permanently');
    await screen.findByText(/deleted 1 item permanently/i);
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('is not offered when nothing carries a batch to bring back', async () => {
    removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 1 }], registryKeys: [], totalSizeBytes: 1 });
    await removeLeftovers();
    await new Promise((r) => setTimeout(r, 30));
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
