// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Removing a dead startup entry.
 *
 * The switch disables; it has nothing to offer an entry whose target is
 * already gone, since there is no live capability left to turn back on.
 * Remove is the one control on this screen that calls into Quarantine
 * (see startupRemovalTarget.js), so it is mocked at that boundary and
 * everything above it -- the hook, the button, the toast -- runs real. */

const fetchStartupItems = vi.fn();
const removeQuarantined = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStartupItems: (...args) => fetchStartupItems(...args),
  fetchStartupIcons: async () => ({}),
  removeQuarantined: (...args) => removeQuarantined(...args)
}));

const StartupItems = (await import('./StartupItems.jsx')).default;
const ToastHost = (await import('./ToastHost.jsx')).default;

const entry = (over = {}) => ({
  id: 'e1',
  name: 'Old Updater',
  command: 'C:\\Program Files\\Old\\updater.exe',
  description: '',
  publisher: '',
  location: 'Run',
  rawScope: 'user',
  source: 'registry',
  registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  approvedName: 'Old Updater',
  enabled: true,
  running: false,
  exists: false,
  toggleNote: null,
  ...over
});

const renderWithToasts = () => renderScreen(<><StartupItems /><ToastHost /></>);

beforeEach(() => {
  vi.clearAllMocks();
  fetchStartupItems.mockResolvedValue([entry()]);
});

describe('removing a dead registry entry', () => {
  it('sends the key path and value name, then re-reads the real list', async () => {
    removeQuarantined.mockResolvedValue({ batchDir: 'D:\\Quarantine\\1-Old Updater' });
    const user = userEvent.setup();
    renderWithToasts();

    await screen.findByText('Old Updater');
    expect(fetchStartupItems).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(removeQuarantined).toHaveBeenCalledWith({
      programName: 'Old Updater',
      files: [],
      registryKeys: [{ path: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Old Updater' }],
      destination: 'quarantine'
    });

    // The row's own removal is optimistic about nothing -- it trusts the
    // real re-read, same as the toggle already does after a write.
    await waitFor(() => expect(fetchStartupItems.mock.calls.length).toBeGreaterThan(1));
  });

  it('removes a dead Startup-folder shortcut by its file path instead', async () => {
    removeQuarantined.mockResolvedValue({ batchDir: 'D:\\Quarantine\\2-Old' });
    fetchStartupItems.mockResolvedValue([entry({
      source: 'folder', registryKey: null, approvedName: 'Old.lnk',
      command: 'C:\\Users\\jim\\Startup\\Old.lnk'
    })]);
    const user = userEvent.setup();
    renderWithToasts();

    await screen.findByText('Old Updater');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(removeQuarantined).toHaveBeenCalledWith({
      programName: 'Old Updater',
      files: ['C:\\Users\\jim\\Startup\\Old.lnk'],
      registryKeys: [],
      destination: 'quarantine'
    });
  });

  it('shows the toast with Undo once it lands', async () => {
    removeQuarantined.mockResolvedValue({ batchDir: 'D:\\Quarantine\\1-Old Updater' });
    const user = userEvent.setup();
    renderWithToasts();

    await screen.findByText('Old Updater');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    expect(await screen.findByText('Removed Old Updater.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('never offers Remove on a live entry -- only disable makes sense there', async () => {
    fetchStartupItems.mockResolvedValue([entry({ exists: true })]);
    renderWithToasts();
    await screen.findByText('Old Updater');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('never offers Remove on a dead entry this app cannot write -- a scheduled task', async () => {
    fetchStartupItems.mockResolvedValue([entry({ source: 'task', registryKey: null })]);
    renderWithToasts();
    await screen.findByText('Old Updater');
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
  });

  it('disables the button while the removal is in flight', async () => {
    let resolveRemove;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemove = resolve; }));
    const user = userEvent.setup();
    renderWithToasts();

    await screen.findByText('Old Updater');
    await user.click(screen.getByRole('button', { name: 'Remove' }));

    const busy = screen.getByRole('button', { name: 'Removing…' });
    expect(busy.disabled).toBe(true);

    resolveRemove({ batchDir: 'D:\\Quarantine\\1-Old Updater' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy());
  });
});
