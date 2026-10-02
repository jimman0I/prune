// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { measuredScan, runMeasuredPreview } from '../testSupport/deepCleanPreview.js';

/** A clean that scheduled locked files for deletion at restart says so, as
 * its own sentence -- not "freed" (they are still on the disk) and not
 * "skipped (locked)" (they will go). And when scheduling needed
 * administrator rights, it says that instead of leaving it a mystery. */

const streamDeepCleanExecute = vi.fn();
const streamDeepCleanScan = vi.fn();
const fetchDeepCleanRules = vi.fn();
let settingsRecord;

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (p) => ({ ...settingsRecord, ...p })),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchWipeEstimate: vi.fn(), fetchWipeDrives: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

const rules = [{ category: 'Windows', items: [{ id: 'temp', name: 'Temporary files', description: 'x', sizeBytes: null, fileCount: null, recommended: true }] }];

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = { excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24, acknowledgedCleanWarnings: [], deepCleanRemoval: 'delete' };
  fetchDeepCleanRules.mockResolvedValue(rules);
  streamDeepCleanScan.mockImplementation(measuredScan(rules));
});

async function cleanWith(ruleEvent) {
  streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
    onEvent('start', { total: 1 });
    onEvent('rule', { id: 'temp', name: 'Temporary files', skipped: [], ...ruleEvent });
  });
  const user = userEvent.setup();
  renderScreen(<DeepClean />);
  await screen.findByText('Temporary files');
  await runMeasuredPreview(user, streamDeepCleanScan);
  await user.click(screen.getByRole('button', { name: 'Clean' }));
  await user.click(await screen.findByRole('button', { name: 'Delete' }));
  return screen.findByTestId('deep-clean-result');
}

describe('the Delete confirmation names the biggest items', () => {
  it('lists the largest files of the ticked rules, and only in Delete now mode', async () => {
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 1 });
      onEvent('rule', {
        id: 'temp', category: 'Windows', name: 'Temporary files', sizeBytes: 5 * 1024 * 1024, fileCount: 3, present: true, accessible: true,
        filesListed: true,
        files: [
          { path: 'C:\\Temp\\installer.cab', sizeBytes: 4 * 1024 * 1024 },
          { path: 'C:\\Temp\\dump.dmp', sizeBytes: 900 * 1024 },
          { path: 'C:\\Temp\\a.tmp', sizeBytes: 100 * 1024 },
          { path: 'C:\\Temp\\tiny.tmp', sizeBytes: 10 }
        ]
      });
    });
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await runMeasuredPreview(user, streamDeepCleanScan);
    await user.click(screen.getByRole('button', { name: 'Clean' }));
    expect(await screen.findByText(/Largest: installer\.cab \(4 MB\), dump\.dmp \(900 KB\), a\.tmp \(100 KB\)/)).toBeTruthy();
    expect(screen.queryByText(/tiny\.tmp/)).toBeNull();
  });

  it('says nothing about files in Quarantine mode, where nothing is lost', async () => {
    settingsRecord = { ...settingsRecord, deepCleanRemoval: 'quarantine' };
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 1 });
      onEvent('rule', {
        id: 'temp', category: 'Windows', name: 'Temporary files', sizeBytes: 2048, fileCount: 1, present: true, accessible: true,
        filesListed: true, files: [{ path: 'C:\\Temp\\installer.cab', sizeBytes: 2048 }]
      });
    });
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await runMeasuredPreview(user, streamDeepCleanScan);
    await user.click(screen.getByRole('button', { name: 'Clean' }));
    await screen.findByRole('button', { name: 'Move to Quarantine' });
    expect(screen.queryByText(/Largest:/)).toBeNull();
  });
});

describe('locked files scheduled for restart', () => {
  it('says how many will be deleted at the next restart', async () => {
    const banner = await cleanWith({ freedBytes: 2048, scheduledForRestart: 3 });
    expect(banner.textContent).toContain('Freed 2 KB');
    expect(banner.textContent).toContain('Locked files to be deleted at the next restart: 3.');
    expect(banner.textContent).not.toMatch(/skipped/i);
  });

  it('adds nothing when none were scheduled', async () => {
    const banner = await cleanWith({ freedBytes: 2048 });
    expect(banner.textContent).not.toMatch(/restart/i);
  });

  it('warns that scheduling needs administrator when it was refused for that', async () => {
    await cleanWith({
      freedBytes: 0,
      skipped: [{ path: 'C:\\x\\a.tmp', reason: 'locked, and could not be scheduled for deletion at restart (needs administrator)' }]
    });
    expect(await screen.findByText(/needs administrator rights/)).toBeTruthy();
  });
});
