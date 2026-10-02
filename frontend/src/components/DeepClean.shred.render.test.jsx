// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** "Shred files..." on the Deep Clean screen: always one click away, never
 * a rule in the list (it acts on what the person picks, not on a preset),
 * and never doing anything until its own dialog has been confirmed. */

const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
const streamShred = vi.fn();
let settingsRecord;

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: vi.fn(),
  streamShred: (...a) => streamShred(...a),
  previewShred: vi.fn(),
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

describe('the Shred files button', () => {
  it('opens the shred dialog, and Cancel closes it without shredding anything', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    expect(screen.queryByRole('dialog')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Shred files…' }));
    expect(screen.getByRole('dialog', { name: 'Shred files and folders' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(streamShred).not.toHaveBeenCalled();
  });

  it('is not a rule in the list, so it can never be ticked into a Clean', async () => {
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    expect(screen.queryByRole('checkbox', { name: /shred/i })).toBeNull();
  });
});
