// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = { fetchBackups: vi.fn(), restoreBackup: vi.fn(), deleteBackup: vi.fn(), fetchQuarantineBatches: vi.fn(), fetchSettings: vi.fn() };
vi.mock('../lib/api.js', () => ({
  fetchBackups: (...a) => api.fetchBackups(...a),
  restoreBackup: (...a) => api.restoreBackup(...a),
  deleteBackup: (...a) => api.deleteBackup(...a),
  fetchQuarantineBatches: (...a) => api.fetchQuarantineBatches(...a),
  restoreQuarantineBatch: vi.fn(), deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchSettings: (...a) => api.fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p)
}));

const QuarantineManager = (await import('./QuarantineManager.jsx')).default;

const registry = { id: 'registry:1000-Acme', kind: 'registry', programName: 'Acme', createdAt: 1_700_000_000_000, sizeBytes: 150 * 1024 * 1024, itemCount: 2, items: ['1-HKLM_SOFTWARE.reg'] };
const task = { id: 'task:3000-Acme', kind: 'scheduled-task', programName: 'Acme', createdAt: 1_700_000_100_000, sizeBytes: 2048, itemCount: 1, items: ['\\Acme\\AcmeUpdater'] };

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({});
  api.fetchQuarantineBatches.mockResolvedValue({ batches: [], totalBytes: 0, batchCount: 0, unknownSizeCount: 0, exact: true, maxBytes: null });
  api.fetchBackups.mockResolvedValue([task, registry]);
});

const openBackups = async () => {
  const user = userEvent.setup();
  renderScreen(<QuarantineManager />);
  await user.click(screen.getByRole('tab', { name: 'Backups' }));
  return user;
};

describe('the Backups tab', () => {
  it('sits beside Quarantine, which stays the first tab', async () => {
    renderScreen(<QuarantineManager />);
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((t) => t.textContent)).toEqual(['Quarantine', 'Backups']);
    expect(tabs[0].getAttribute('aria-selected')).toBe('true');
  });

  it('can be opened directly from another screen', async () => {
    renderScreen(<QuarantineManager initialTab="backups" />);
    expect(await screen.findByText('Registry export')).toBeTruthy();
  });

  it('moves between the tabs with the arrow keys', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    screen.getByRole('tab', { name: 'Quarantine' }).focus();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByRole('tab', { name: 'Backups' }).getAttribute('aria-selected')).toBe('true');
  });

  it('lists each backup with its kind, date, size and item count', async () => {
    await openBackups();
    const items = await screen.findAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]).getByText('Scheduled tasks')).toBeTruthy();
    expect(within(items[0]).getByText('\\Acme\\AcmeUpdater')).toBeTruthy();
    expect(within(items[1]).getByText('Registry export')).toBeTruthy();
    expect(within(items[1]).getByText(/150 MB/)).toBeTruthy();
    expect(within(items[1]).getByText(/Items: 2/)).toBeTruthy();
  });

  it('says what restoring a registry export does before doing it, then restores', async () => {
    api.restoreBackup.mockResolvedValue({ kind: 'registry', restored: 2, failed: [], elevated: false });
    const user = await openBackups();
    const card = (await screen.findAllByRole('listitem'))[1];
    await user.click(within(card).getByRole('button', { name: 'Restore' }));
    expect(api.restoreBackup).not.toHaveBeenCalled();
    expect(within(card).getByText(/It merges|merges/)).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Restore now' }));
    await waitFor(() => expect(api.restoreBackup.mock.calls[0][0]).toBe('registry:1000-Acme'));
    expect(await screen.findByText('Items restored from the backup of Acme: 2.')).toBeTruthy();
  });

  it('names what could not be restored', async () => {
    api.restoreBackup.mockResolvedValue({
      kind: 'registry', restored: 1, elevated: true,
      failed: [{ file: '1-HKLM_SOFTWARE.reg', reason: 'Restoring it needs administrator approval, which was declined.', cancelled: true }]
    });
    const user = await openBackups();
    const card = (await screen.findAllByRole('listitem'))[1];
    await user.click(within(card).getByRole('button', { name: 'Restore' }));
    await user.click(within(card).getByRole('button', { name: 'Restore now' }));
    expect(await screen.findByText('Not restored: 1')).toBeTruthy();
    expect(screen.getByText(/1-HKLM_SOFTWARE\.reg — Restoring it needs administrator approval/)).toBeTruthy();
  });

  it('asks before deleting a backup for good, and can be talked out of it', async () => {
    api.deleteBackup.mockResolvedValue({ deleted: true, freedBytes: 5 });
    const user = await openBackups();
    const card = (await screen.findAllByRole('listitem'))[0];
    await user.click(within(card).getByRole('button', { name: 'Delete' }));
    expect(screen.getByText(/Delete this backup for good/)).toBeTruthy();
    await user.click(within(card).getByRole('button', { name: 'Cancel' }));
    expect(api.deleteBackup).not.toHaveBeenCalled();
    await user.click(within(card).getByRole('button', { name: 'Delete' }));
    await user.click(within(card).getByRole('button', { name: 'Delete backup' }));
    await waitFor(() => expect(api.deleteBackup.mock.calls[0][0]).toBe('task:3000-Acme'));
  });

  it('says what an empty list means', async () => {
    api.fetchBackups.mockResolvedValue([]);
    await openBackups();
    expect(await screen.findByText('No backups yet')).toBeTruthy();
  });

  it('says when the list could not be loaded', async () => {
    api.fetchBackups.mockRejectedValue(new Error('backend down'));
    await openBackups();
    expect(await screen.findByText(/Couldn.t load the backups: backend down/)).toBeTruthy();
  });
});
