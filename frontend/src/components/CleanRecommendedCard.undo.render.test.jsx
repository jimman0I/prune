// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { APP_VERSION } from '../lib/appVersion.js';
import { scanFingerprint, saveScanCache, loadScanCache } from '../lib/deepCleanScanCache.js';
import ToastHost from './ToastHost.jsx';

/** Undo on the toast after the Dashboard's Clean recommended moved files to
 * Quarantine: the batches come back, and the card's picture of the scan (shared
 * with Deep Clean) returns to how it read before. */

const streamDeepCleanExecute = vi.fn();
const fetchDeepCleanRules = vi.fn();
const restoreQuarantineBatch = vi.fn();
let settingsRecord = null;
vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: vi.fn(),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (partial) => ({ ...settingsRecord, ...partial }))
}));

const CleanRecommendedCard = (await import('./CleanRecommendedCard.jsx')).default;

const MB = 1024 * 1024;
const RULES = [{
  category: 'Windows',
  items: [
    { id: 'temp', name: 'Temporary files', category: 'Windows', paths: ['%TEMP%'], sizeBytes: null, present: true, recommended: true },
    { id: 'logs', name: 'Log files', category: 'Windows', paths: ['%LOGS%'], sizeBytes: null, present: true, recommended: true }
  ]
}];

function seedCache() {
  const tree = [{
    category: 'Windows',
    items: [
      { id: 'temp', sizeBytes: 5 * MB, fileCount: 2, present: true, accessible: true },
      { id: 'logs', sizeBytes: 3 * MB, fileCount: 2, present: true, accessible: true }
    ]
  }];
  const fingerprint = scanFingerprint({ settings: settingsRecord, rules: RULES, appVersion: APP_VERSION });
  expect(saveScanCache({ tree, fingerprint, savedAt: Date.now() - 60 * 60 * 1000 })).toBe(true);
}

const render = () => renderScreen(<><CleanRecommendedCard armDelayMs={0} /><ToastHost /></>);

async function clean(user, confirm = 'Move to Quarantine') {
  await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
  await user.click(screen.getByRole('button', { name: confirm }));
  await screen.findByTestId('clean-recommended-result');
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  settingsRecord = { excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24 };
  fetchDeepCleanRules.mockResolvedValue(RULES);
  restoreQuarantineBatch.mockResolvedValue({});
  streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
    onEvent('start', { total: ids.length });
    for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', movedBytes: id === 'temp' ? 5 * MB : 3 * MB, quarantineBatch: `C:\\q\\${id}`, skipped: [] });
  });
});

describe('Undo after Clean recommended', () => {
  it('is on the toast, and restores the batches', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    seedCache();
    render();
    await clean(user);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledTimes(2));
    expect(restoreQuarantineBatch.mock.calls.map((c) => c[0]).sort()).toEqual(['C:\\q\\logs', 'C:\\q\\temp']);
    expect(await screen.findByText('Restored from Quarantine.')).toBeTruthy();
  });

  it('puts the remembered scan, and the card, back to how they read before', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    seedCache();
    render();
    await clean(user);
    expect(loadScanCache().rules.temp.sizeBytes).toBe(0);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(loadScanCache().rules.temp.sizeBytes).toBe(5 * MB));
    expect(loadScanCache().rules.logs.sizeBytes).toBe(3 * MB);

    // Done returns the card to rest, and it can clean again.
    await user.click(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByText('Can be cleaned: 8 MB')).toBeTruthy();
  });

  it('is not offered after Delete now', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    settingsRecord = { ...settingsRecord, deepCleanRemoval: 'delete' };
    seedCache();
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('start', { total: ids.length });
      for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', freedBytes: 4 * MB, skipped: [] });
    });
    render();
    await clean(user, 'Delete');
    expect(await screen.findByText(/Cleanup complete/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
