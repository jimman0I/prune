// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** A batch uninstall following the same three settings the single-program
 * dialog does: where leftovers go, whether they start ticked, and whether
 * a leftover scan follows at all. The api module is mocked. */

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
  removeStoreApp: vi.fn(),
  scanForcedUninstall: vi.fn(),
  appendHistoryEntry: vi.fn(async () => {})
}));

const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

const thing = { id: 'thing', name: 'Thing', publisher: 'Acme', sizeBytes: 2048, uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"' };
const found = {
  files: { ok: true, items: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', sizeBytes: 2048 }] },
  registryKeys: { ok: true, items: [] },
  scheduledTasks: { ok: true, items: [] }
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  fetchSettings.mockResolvedValue({});
});

const run = async () => {
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={[thing]} onClose={() => {}} onFinished={() => {}} />);
  // Settings arrive first, the way they would in the app: the dialog is
  // opened from a screen that has long since loaded them.
  await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
  await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
  return user;
};

describe('a batch and the leftover settings', () => {
  it('sends the destination the review showed', async () => {
    fetchSettings.mockResolvedValue({ leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({ destination: 'permanent', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: [], failedFiles: [], totalSizeBytes: 2048 });
    const user = await run();

    await user.click(await screen.findByRole('button', { name: 'Delete permanently' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    expect(removeQuarantined.mock.calls[0][0].destination).toBe('permanent');
    expect(await screen.findByText(/deleted 1 leftover item permanently/i)).toBeTruthy();
  });

  it('skips the leftover scans when they are turned off, and says so', async () => {
    fetchSettings.mockResolvedValue({ scanLeftoversAfterUninstall: false });
    await run();

    expect(await screen.findByText(/leftover scan is turned off/i)).toBeTruthy();
    expect(scanForLeftovers).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  });

  it('starts with nothing ticked when the setting is off', async () => {
    fetchSettings.mockResolvedValue({ preselectLeftovers: false });
    await run();
    expect(await screen.findByText(/^0$/)).toBeTruthy();
  });
});
