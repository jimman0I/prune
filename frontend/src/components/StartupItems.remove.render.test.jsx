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

describe('Remove N disabled', () => {
  // Two switched-off entries the screen can delete, one it cannot (a task),
  // and one that is on. Every one of them is on disk.
  const offRun = entry({ id: 'd1', name: 'Tray Helper', approvedName: 'Tray Helper', enabled: false, exists: true });
  const offLnk = entry({
    id: 'd2', name: 'Notes', source: 'folder', registryKey: null, approvedName: 'Notes.lnk',
    command: 'C:\\Users\\jim\\Startup\\Notes.lnk', enabled: false, exists: true
  });
  const offTask = entry({ id: 'd3', name: 'Nightly Sync', source: 'task', registryKey: null, enabled: false, exists: true });
  const onRun = entry({ id: 'd4', name: 'Audio', approvedName: 'Audio', enabled: true, exists: true });

  it('removes every switched-off Run value and shortcut as ONE batch, then offers Undo', async () => {
    removeQuarantined.mockResolvedValue({ batchDir: 'D:\\Quarantine\\3-Disabled startup entries' });
    fetchStartupItems.mockResolvedValue([offRun, offLnk, offTask, onRun]);
    const user = userEvent.setup();
    renderWithToasts();

    await user.click(await screen.findByRole('button', { name: 'Remove 2 disabled' }));

    expect(removeQuarantined).toHaveBeenCalledTimes(1);
    expect(removeQuarantined).toHaveBeenCalledWith({
      programName: 'Disabled startup entries',
      files: ['C:\\Users\\jim\\Startup\\Notes.lnk'],
      registryKeys: [{ path: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Tray Helper' }],
      destination: 'quarantine'
    });
    expect(await screen.findByText('Removed 2 disabled entries.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeTruthy();
    await waitFor(() => expect(fetchStartupItems.mock.calls.length).toBeGreaterThan(1));
  });

  it('is not offered when nothing removable is switched off', async () => {
    fetchStartupItems.mockResolvedValue([offTask, onRun]);
    renderWithToasts();
    await screen.findByText('Audio');
    expect(screen.queryByRole('button', { name: /disabled/ })).toBeNull();
  });

  it('greys both bulk removals while either is running -- a dead, switched-off entry is in both', async () => {
    let resolveRemove;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemove = resolve; }));
    fetchStartupItems.mockResolvedValue([offRun, entry({ id: 'd5', name: 'Gone', approvedName: 'Gone', exists: false })]);
    const user = userEvent.setup();
    renderWithToasts();

    await user.click(await screen.findByRole('button', { name: 'Remove 1 disabled' }));
    expect(screen.getByRole('button', { name: 'Removing…' }).disabled).toBe(true);
    expect(screen.getByRole('button', { name: 'Remove 1 invalid' }).disabled).toBe(true);

    resolveRemove({ batchDir: 'D:\\Quarantine\\4-Disabled startup entries' });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Remove 1 invalid' }).disabled).toBe(false));
  });
});
