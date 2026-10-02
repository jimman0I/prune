// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { fetchUninstallHistory: vi.fn(), clearUninstallHistory: vi.fn(), fetchBackups: vi.fn(), fetchQuarantineBatches: vi.fn(), fetchSettings: vi.fn() };
vi.mock('../lib/api.js', () => ({
  fetchUninstallHistory: (...a) => api.fetchUninstallHistory(...a),
  clearUninstallHistory: (...a) => api.clearUninstallHistory(...a),
  fetchBackups: (...a) => api.fetchBackups(...a),
  restoreBackup: vi.fn(), deleteBackup: vi.fn(),
  fetchQuarantineBatches: (...a) => api.fetchQuarantineBatches(...a),
  restoreQuarantineBatch: vi.fn(), deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchSettings: (...a) => api.fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p)
}));

const QuarantineManager = (await import('./QuarantineManager.jsx')).default;

const rich = {
  id: 'a1', timestamp: 1_700_000_000_000, programName: 'Acme Studio', publisher: 'Acme Inc', version: '2.1', kind: 'uninstall',
  scanMode: 'advanced', leftoversFound: 7, leftoversRemoved: 5, bytesFreed: 3 * 1024 * 1024, destination: 'recycle',
  tasksRemoved: 1, outcome: 'removed', restorePoint: { created: false, reason: 'turned off in Settings' },
  registryBackup: 'C:\\Prune\\registry-backups\\1-Acme', quarantineBatch: 'C:\\Prune\\quarantine\\2-Acme'
};
const legacy = { id: 'legacy-0', timestamp: 1_600_000_000_000, programName: 'Old Program', publisher: 'Old Inc', sizeBytes: 4096 };

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.fetchQuarantineBatches.mockResolvedValue({ batches: [], totalBytes: 0, batchCount: 0, unknownSizeCount: 0, exact: true, maxBytes: null });
  api.fetchBackups.mockResolvedValue([]);
  api.fetchUninstallHistory.mockResolvedValue([rich, legacy]);
});

const openHistory = async () => {
  const user = userEvent.setup();
  renderScreen(<QuarantineManager initialTab="history" />);
  await screen.findByText('Acme Studio');
  return user;
};

describe('the History tab', () => {
  it('asks for every entry, not just the latest five', async () => {
    await openHistory();
    expect(api.fetchUninstallHistory).toHaveBeenCalledWith({ all: true });
    expect(screen.getByText('Uninstalls recorded: 2')).toBeTruthy();
  });

  it('lists the entries, newest first as given, with their outcome', async () => {
    await openHistory();
    const items = screen.getAllByRole('listitem');
    expect(within(items[0]).getByText('Acme Studio')).toBeTruthy();
    expect(within(items[0]).getByText('Leftovers removed')).toBeTruthy();
    expect(within(items[1]).getByText('Old Program')).toBeTruthy();
  });

  it('shows the whole story of an entry when it is selected', async () => {
    const user = await openHistory();
    expect(screen.getByText('Select an entry to see its details.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /Acme Studio/ }));
    const details = screen.getByRole('region', { name: 'Details' });
    for (const text of ['Acme Inc', '2.1', 'Advanced', 'Recycle Bin', '3 MB', 'Not created (turned off in Settings)', 'C:\\Prune\\registry-backups\\1-Acme', 'C:\\Prune\\quarantine\\2-Acme']) {
      expect(within(details).getByText(text), text).toBeTruthy();
    }
  });

  it('reads an entry from an older version, with a dash for what it never recorded', async () => {
    const user = await openHistory();
    await user.click(screen.getByRole('button', { name: /Old Program/ }));
    const details = screen.getByRole('region', { name: 'Details' });
    expect(within(details).getByText('Old Inc')).toBeTruthy();
    expect(within(details).getByText('4 KB')).toBeTruthy();
    expect(within(details).getAllByText('—').length).toBeGreaterThan(3);
  });

  it('asks before clearing, then clears and shows the empty state', async () => {
    api.clearUninstallHistory.mockResolvedValue({ ok: true, cleared: 2 });
    const user = await openHistory();
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    expect(api.clearUninstallHistory).not.toHaveBeenCalled();
    api.fetchUninstallHistory.mockResolvedValue([]);
    await user.click(screen.getByRole('button', { name: 'Delete all' }));
    await waitFor(() => expect(api.clearUninstallHistory).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('No uninstalls recorded yet')).toBeTruthy();
  });

  it('can be talked out of clearing', async () => {
    const user = await openHistory();
    await user.click(screen.getByRole('button', { name: 'Clear history' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(api.clearUninstallHistory).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Clear history' })).toBeTruthy();
  });

  it('says when the history could not be loaded', async () => {
    api.fetchUninstallHistory.mockRejectedValue(new Error('backend down'));
    renderScreen(<QuarantineManager initialTab="history" />);
    expect(await screen.findByText(/Couldn.t load the history: backend down/)).toBeTruthy();
  });
});
