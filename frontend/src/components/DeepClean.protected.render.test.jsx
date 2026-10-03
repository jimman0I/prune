// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** A folder Windows refuses to LIST (accessible: false) means two different
 * things depending on who is asking. An unelevated Prune is told "run as
 * administrator", and offered the elevated clean. An elevated Prune is
 * already an administrator, so that offer is false and the button pointless:
 * the folder is protected (SYSTEM / TrustedInstaller, tamper protection) and
 * stays out of reach. The screen must say which, from the same elevation
 * status the Disk Map reads. */

const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
const executeDeepCleanElevated = vi.fn();
const fetchMftStatus = vi.fn();
const streamDeepCleanExecute = vi.fn();
const fetchSettings = vi.fn(async () => ({
  excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
  skipRecentHours: 24, acknowledgedCleanWarnings: []
}));

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  executeDeepCleanElevated: (...a) => executeDeepCleanElevated(...a),
  fetchMftStatus: (...a) => fetchMftStatus(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (p) => p),
  fetchCleanerCategoryIcons: vi.fn(async () => ({}))
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

const RULES = [{
  category: 'Windows',
  items: [
    { id: 'defender', category: 'Windows', name: 'Defender scan history', sizeBytes: 10, fileCount: 1, accessible: false, recommended: true },
    { id: 'prefetch', category: 'Windows', name: 'Prefetch', sizeBytes: 20, fileCount: 2, accessible: false },
    { id: 'temp', category: 'Windows', name: 'Temporary files', sizeBytes: 30, fileCount: 3, present: true, accessible: true, recommended: true }
  ]
}];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  fetchDeepCleanRules.mockResolvedValue(RULES);
  // A scan that finishes, reporting each rule as listed: the banner only
  // shows once no scan is running.
  streamDeepCleanScan.mockImplementation(async (onEvent) => {
    const items = RULES.flatMap((g) => g.items);
    onEvent('start', { total: items.length });
    for (const item of items) onEvent('rule', { present: true, ...item });
  });
  fetchMftStatus.mockResolvedValue({ elevated: false });
});

// The banner is hidden while a scan runs, so "no button" is only meaningful
// once the automatic scan has finished: Rescan replaces Stop in that spot.
const settled = () => screen.findByRole('button', { name: 'Rescan' });

const rowOf = async (name) => (await screen.findByText(name)).closest('div');

describe('Deep Clean when Prune is NOT elevated', () => {
  it('still says administrator access is needed, and offers the elevated clean', async () => {
    fetchMftStatus.mockResolvedValue({ elevated: false });
    renderScreen(<DeepClean />);
    await settled();

    expect(await screen.findByText('2 items need administrator access to measure and clean.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clean as administrator' })).toBeTruthy();
    expect(within(await rowOf('Prefetch')).getByText('needs admin')).toBeTruthy();
    expect(screen.queryByText(/protected by Windows/)).toBeNull();
  });

  it('keeps the old wording while the status cannot be read', async () => {
    fetchMftStatus.mockRejectedValue(new Error('down'));
    renderScreen(<DeepClean />);
    await settled();

    expect(await screen.findByText('2 items need administrator access to measure and clean.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clean as administrator' })).toBeTruthy();
  });

  it('runs the elevated clean on exactly those rules', async () => {
    const user = userEvent.setup();
    executeDeepCleanElevated.mockResolvedValue({ ok: false, cancelled: true });
    renderScreen(<DeepClean />);
    await settled();

    await user.click(await screen.findByRole('button', { name: 'Clean as administrator' }));
    expect(executeDeepCleanElevated).toHaveBeenCalledWith(['defender', 'prefetch']);
  });
});

describe('Deep Clean when Prune IS elevated', () => {
  beforeEach(() => fetchMftStatus.mockResolvedValue({ elevated: true }));

  it('says the folders are protected by Windows, with no administrator button', async () => {
    renderScreen(<DeepClean />);
    await settled();

    expect(await screen.findByText(
      "2 items are protected by Windows and can't be measured or cleaned, even as administrator."
    )).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Clean as administrator' })).toBeNull();
    expect(screen.queryByText(/need administrator access/)).toBeNull();
    expect(executeDeepCleanElevated).not.toHaveBeenCalled();
  });

  it('uses the singular for one protected item', async () => {
    fetchDeepCleanRules.mockResolvedValue([{ category: 'Windows', items: [RULES[0].items[1], RULES[0].items[2]] }]);
    renderScreen(<DeepClean />);
    await settled();

    expect(await screen.findByText(
      "1 item is protected by Windows and can't be measured or cleaned, even as administrator."
    )).toBeTruthy();
  });

  it('labels the row protected instead of "needs admin"', async () => {
    renderScreen(<DeepClean />);
    await settled();

    const row = await rowOf('Prefetch');
    await waitFor(() => expect(within(row).getByText('protected')).toBeTruthy());
    expect(within(row).queryByText('needs admin')).toBeNull();
  });

  it('shows no banner at all when nothing is protected', async () => {
    fetchDeepCleanRules.mockResolvedValue([{ category: 'Windows', items: [RULES[0].items[2]] }]);
    renderScreen(<DeepClean />);
    await settled();

    await screen.findByText('Temporary files');
    expect(screen.queryByText(/protected by Windows/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clean as administrator' })).toBeNull();
  });

  it('leaves protected rules out of Select everything', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await settled();
    await screen.findByText(/protected by Windows/);

    await user.click(screen.getByRole('button', { name: 'Select everything' }));
    await waitFor(() => expect(screen.getByText('1 selected')).toBeTruthy());
    expect(screen.getByRole('checkbox', { name: 'Temporary files' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Prefetch' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByRole('checkbox', { name: 'Defender scan history' }).getAttribute('aria-checked')).toBe('false');
  });
});
