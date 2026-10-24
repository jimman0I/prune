// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** "Junk files" on the Deep Clean screen: a tool beside Shred files, never a
 * rule in the list, opening its own dialog -- and its link to the pattern
 * list goes to Settings -> Cleanup. */

const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
const streamJunkScan = vi.fn();
let settingsRecord;

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: vi.fn(),
  streamShred: vi.fn(),
  previewShred: vi.fn(),
  fetchJunkPatterns: vi.fn(async () => ({ patterns: [{ pattern: '*.tmp', enabled: true, preselected: true }] })),
  streamJunkScan: (...a) => streamJunkScan(...a),
  removeJunkFiles: vi.fn(),
  revealInExplorer: vi.fn(),
  pickPath: vi.fn(),
  fetchDrives: vi.fn(async () => ({ drives: [{ letter: 'C', label: 'Windows', totalBytes: 100, freeBytes: 50, system: true }], systemDrive: 'C' })),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (p) => ({ ...settingsRecord, ...p })),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchWipeEstimate: vi.fn(),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = { excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24, acknowledgedCleanWarnings: [] };
  fetchDeepCleanRules.mockResolvedValue([{ category: 'Windows', items: [{ id: 'temp', name: 'Temporary files', sizeBytes: null, fileCount: null }] }]);
  streamDeepCleanScan.mockImplementation(() => () => {});
});

describe('the Junk files button', () => {
  it('opens the Junk files dialog without scanning anything, and Close closes it', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await user.click(screen.getByRole('button', { name: 'Junk files' }));
    expect(await screen.findByRole('dialog', { name: 'Junk files' })).toBeTruthy();
    expect(streamJunkScan).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('sends "Edit patterns" to Settings -> Cleanup, closing the dialog', async () => {
    const user = userEvent.setup();
    const onOpenSettings = vi.fn();
    renderScreen(<DeepClean onOpenSettings={onOpenSettings} />);
    await screen.findByText('Temporary files');
    await user.click(screen.getByRole('button', { name: 'Junk files' }));
    await user.click(await screen.findByRole('button', { name: 'Edit patterns' }));
    expect(onOpenSettings).toHaveBeenCalledWith('cleanup');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('is not a rule in the list, so it can never be ticked into a Clean', async () => {
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    expect(screen.queryByRole('checkbox', { name: /junk/i })).toBeNull();
  });
});
