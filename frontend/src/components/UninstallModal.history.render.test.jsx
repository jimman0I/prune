// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const api = {
  streamUninstall: vi.fn(), scanForLeftovers: vi.fn(), scanForcedUninstall: vi.fn(), removeQuarantined: vi.fn(),
  appendHistoryEntry: vi.fn(), updateHistoryEntry: vi.fn(), fetchSettings: vi.fn()
};
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => api.streamUninstall(...a),
  scanForLeftovers: (...a) => api.scanForLeftovers(...a),
  scanForcedUninstall: (...a) => api.scanForcedUninstall(...a),
  removeQuarantined: (...a) => api.removeQuarantined(...a),
  appendHistoryEntry: (...a) => api.appendHistoryEntry(...a),
  updateHistoryEntry: (...a) => api.updateHistoryEntry(...a),
  fetchSettings: (...a) => api.fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p)
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;

const program = { id: 'thing', name: 'Thing', publisher: 'Acme', version: '1.2', sizeBytes: 4096, uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"' };
const found = {
  files: { ok: true, items: [{ path: 'C:\\ProgramData\\Thing', sizeBytes: 100, confidence: 'likely' }] },
  registryKeys: { ok: true, items: [{ path: 'HKCU\\Software\\Thing', confidence: 'certain' }] },
  scheduledTasks: { ok: true, items: [] }
};

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchSettings.mockResolvedValue({ preselectLeftovers: true });
  api.appendHistoryEntry.mockResolvedValue({ ok: true, id: 'hist1' });
  api.updateHistoryEntry.mockResolvedValue({ ok: true });
  api.scanForLeftovers.mockResolvedValue(found);
  api.scanForcedUninstall.mockResolvedValue(found);
  api.removeQuarantined.mockResolvedValue({
    destination: 'quarantine', batchDir: 'Q:\\batch', files: [{}], registryKeys: ['k'], totalSizeBytes: 100,
    restorePoint: { created: false, reason: 'turned off in Settings' }
  });
});

describe('what the history records for an uninstall', () => {
  it('writes the entry when the uninstaller finishes, with the safety nets it had', async () => {
    api.streamUninstall.mockImplementation(async (_id, onEvent) => {
      onEvent('restorePoint', { created: true });
      onEvent('registryBackup', { ok: true, dir: 'B:\\registry-backups\\1-Thing' });
    });
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await waitFor(() => expect(api.appendHistoryEntry).toHaveBeenCalledTimes(1));
    expect(api.appendHistoryEntry.mock.calls[0][0]).toMatchObject({
      kind: 'uninstall', programName: 'Thing', publisher: 'Acme', version: '1.2', sizeBytes: 4096,
      scanMode: 'moderate', restorePoint: { created: true }, registryBackup: 'B:\\registry-backups\\1-Thing', outcome: 'uninstalled'
    });
  });

  it('adds how many leftovers were found when the scan finishes, and what was removed when the review is done', async () => {
    api.streamUninstall.mockResolvedValue();
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));
    await waitFor(() => expect(api.updateHistoryEntry).toHaveBeenCalledWith('hist1', { leftoversFound: 2 }));

    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(api.updateHistoryEntry).toHaveBeenCalledTimes(2));
    expect(api.updateHistoryEntry.mock.calls[1]).toEqual(['hist1', expect.objectContaining({
      leftoversFound: 2, leftoversRemoved: 2, bytesFreed: 100, destination: 'quarantine', quarantineBatch: 'Q:\\batch',
      outcome: 'removed', restorePoint: { created: false, reason: 'turned off in Settings' }
    })]);
  });

  it('still uninstalls, and says nothing, when the history cannot be written', async () => {
    api.streamUninstall.mockResolvedValue();
    api.appendHistoryEntry.mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    expect(await screen.findByRole('button', { name: 'Scan for leftovers' })).toBeTruthy();
    expect(screen.queryByText(/disk full/)).toBeNull();
  });

  it('writes one entry of its own for a forced removal, when the removal is done', async () => {
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={{ ...program, health: { orphaned: true, reason: 'gone' } }} onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Search for leftovers' }));
    await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
    await waitFor(() => expect(api.appendHistoryEntry).toHaveBeenCalledTimes(1));
    expect(api.appendHistoryEntry.mock.calls[0][0]).toMatchObject({
      kind: 'forced', programName: 'Thing', scanMode: 'moderate', leftoversFound: 2, leftoversRemoved: 2, outcome: 'removed'
    });
    expect(api.updateHistoryEntry).not.toHaveBeenCalled();
  });
});
