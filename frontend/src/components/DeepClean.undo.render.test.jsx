// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { APP_VERSION } from '../lib/appVersion.js';
import { scanFingerprint, saveScanCache, loadScanCache } from '../lib/deepCleanScanCache.js';
import ToastHost from './ToastHost.jsx';

/** Deep Clean in Quarantine mode: the toast after a clean has Undo, which
 * restores the batches and puts the rows (and the remembered scan) back to how
 * they read before. Not offered after Delete now. */

const streamDeepCleanExecute = vi.fn();
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
const restoreQuarantineBatch = vi.fn();
let settingsRecord = null;
vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  executeDeepCleanElevated: vi.fn(),
  fetchMftStatus: vi.fn(async () => ({ elevated: false })),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (partial) => ({ ...settingsRecord, ...partial })),
  fetchCleanerCategoryIcons: vi.fn(async () => ({}))
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

const MB = 1024 * 1024;
const RULES = [{
  category: 'Windows',
  items: [
    { id: 'temp', name: 'Temporary files', category: 'Windows', paths: ['%TEMP%'], sizeBytes: null, present: true, recommended: true },
    { id: 'thumbs', name: 'Thumbnail cache', category: 'Windows', paths: ['%THUMBS%'], sizeBytes: null, present: true }
  ]
}];

const baseSettings = () => ({
  excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24,
  acknowledgedCleanWarnings: [], deepCleanSelection: ['temp', 'thumbs']
});

function seedCache() {
  const tree = [{
    category: 'Windows',
    items: [
      { id: 'temp', sizeBytes: 5 * MB, fileCount: 12, present: true, accessible: true },
      { id: 'thumbs', sizeBytes: 2 * MB, fileCount: 3, present: true, accessible: true }
    ]
  }];
  const fingerprint = scanFingerprint({ settings: settingsRecord, rules: RULES, appVersion: APP_VERSION });
  expect(saveScanCache({ tree, fingerprint, savedAt: Date.now() - 60 * 60 * 1000 })).toBe(true);
}

const render = () => renderScreen(<><DeepClean /><ToastHost /></>);
const cleanButton = () => screen.getByRole('button', { name: 'Clean' });
const row = async (name) => (await screen.findByText(name)).closest('div');

async function clean(user, confirmName = 'Move to Quarantine') {
  await waitFor(() => expect(cleanButton().disabled).toBe(false));
  await user.click(cleanButton());
  await user.click(await screen.findByRole('button', { name: confirmName }));
  await screen.findByTestId('deep-clean-result');
}

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  settingsRecord = baseSettings();
  fetchDeepCleanRules.mockResolvedValue(RULES);
  restoreQuarantineBatch.mockResolvedValue({});
  streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
    onEvent('start', { total: ids.length });
    for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', movedBytes: id === 'temp' ? 5 * MB : 2 * MB, quarantineBatch: `C:\\q\\${id}`, skipped: [] });
  });
});

describe('Undo after a Deep Clean that moved files to Quarantine', () => {
  it('is on the toast, with the result', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await clean(user);
    expect(await screen.findByRole('button', { name: 'Undo' })).toBeTruthy();
  });

  it('restores every batch the clean made', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await clean(user);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledTimes(2));
    expect(restoreQuarantineBatch.mock.calls.map((c) => c[0]).sort()).toEqual(['C:\\q\\temp', 'C:\\q\\thumbs']);
    expect(await screen.findByText('Restored from Quarantine.')).toBeTruthy();
  });

  it('puts the rows, and the remembered scan, back to how they read before the clean', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await clean(user);
    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('0 B')).toBeTruthy());
    expect(loadScanCache().rules.temp.sizeBytes).toBe(0);

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('5 MB')).toBeTruthy());
    expect(within(await row('Thumbnail cache')).getByText('2 MB')).toBeTruthy();
    expect(loadScanCache().rules.temp.sizeBytes).toBe(5 * MB);
    expect(loadScanCache().rules.thumbs.sizeBytes).toBe(2 * MB);
  });

  it('leaves the rows alone for a batch that could not come back', async () => {
    const user = userEvent.setup();
    seedCache();
    restoreQuarantineBatch.mockImplementation(async (dir) => {
      if (dir.endsWith('temp')) throw new Error('ENOENT: no such file or directory');
      return {};
    });
    render();
    await clean(user);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Put back 1 of 2. The rest are no longer in Quarantine.')).toBeTruthy();
    await waitFor(() => expect(within(screen.getByText('Thumbnail cache').closest('div')).getByText('2 MB')).toBeTruthy());
    expect(within(screen.getByText('Temporary files').closest('div')).getByText('0 B')).toBeTruthy();
  });

  it('does not overwrite a fresher scan with the picture from before the clean', async () => {
    const user = userEvent.setup();
    seedCache();
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 2 });
      onEvent('rule', { id: 'temp', category: 'Windows', sizeBytes: 111, fileCount: 1, present: true, accessible: true });
      onEvent('rule', { id: 'thumbs', category: 'Windows', sizeBytes: 222, fileCount: 1, present: true, accessible: true });
    });
    render();
    await clean(user);
    // A rescan finishes before Undo is pressed.
    await user.click(await screen.findByRole('button', { name: 'Rescan' }));
    await waitFor(() => expect(loadScanCache().rules.temp.sizeBytes).toBe(111));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await screen.findByText('Restored from Quarantine.');
    expect(loadScanCache().rules.temp.sizeBytes).toBe(111);
  });
});

describe('after Delete now', () => {
  it('offers no Undo: that mode keeps nothing', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), deepCleanRemoval: 'delete' };
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('start', { total: ids.length });
      for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', freedBytes: 5 * MB, skipped: [] });
    });
    seedCache();
    render();
    await clean(user, 'Delete');
    expect(await screen.findByText(/Cleanup complete/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });

  it('offers none where a rule made a backup batch either', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), deepCleanRemoval: 'delete' };
    seedCache();
    render();
    await clean(user, 'Delete');
    expect(screen.queryByRole('button', { name: 'Undo' })).toBeNull();
  });
});
