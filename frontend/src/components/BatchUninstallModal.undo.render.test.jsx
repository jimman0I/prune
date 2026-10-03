// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** Leftovers of a batch uninstall moved to Quarantine: Undo on the toast. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const removeQuarantined = vi.fn();
const restoreQuarantineBatch = vi.fn();
vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  removeStoreApp: vi.fn(),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  appendHistoryEntry: vi.fn(async () => {}),
  removeQuarantined: (...a) => removeQuarantined(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  scanForcedUninstall: vi.fn(),
  fetchSettings: vi.fn(async () => ({ preselectLeftovers: true })),
  updateSettings: vi.fn()
}));

const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

const programs = [
  { id: 'a', name: 'Thing One', publisher: 'Acme', sizeBytes: 1024 },
  { id: 'b', name: 'Thing Two', publisher: 'Acme', sizeBytes: 2048 }
];
const found = { files: { ok: true, items: [{ path: 'C:\\Thing', sizeBytes: 512 }] }, registryKeys: { ok: true, items: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue({
    destination: 'quarantine', batchDir: 'C:\\q\\1-batch',
    files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512
  });
  restoreQuarantineBatch.mockResolvedValue({});
});

async function run() {
  const user = userEvent.setup();
  renderScreen(<><BatchUninstallModal programs={programs} onClose={() => {}} onFinished={() => {}} /><ToastHost /></>);
  await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
  await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
  await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));
  await user.click(await screen.findByRole('button', { name: 'Remove selected' }));
  await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
  return user;
}

describe('Undo after a batch uninstall moved leftovers to Quarantine', () => {
  it('is on the toast', async () => {
    await run();
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy();
    expect(screen.getByText(/Leftovers of .* moved to Quarantine\./)).toBeTruthy();
  });

  it('restores the batch', async () => {
    const user = await run();
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(restoreQuarantineBatch).toHaveBeenCalledWith('C:\\q\\1-batch');
    expect(await screen.findByText('Restored from Quarantine.')).toBeTruthy();
  });
});
