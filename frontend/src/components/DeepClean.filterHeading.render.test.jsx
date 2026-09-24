// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Ticking a category heading while the filter is active, and the stacked
 * layout's minimum tree height. The filter is view-only: the heading acts
 * on what is visible and nothing hidden. */

const fetchDeepCleanRules = vi.fn();
let settingsRecord = null;

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: vi.fn(() => () => {}),
  streamDeepCleanExecute: vi.fn(),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (partial) => {
    settingsRecord = { ...settingsRecord, ...partial };
    return settingsRecord;
  }),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

const TWO_BROWSERS = [
  {
    category: 'Chrome',
    items: [
      { id: 'chrome_cache', category: 'Chrome', name: 'Cache', description: 'x', sizeBytes: null },
      { id: 'chrome_cookies', category: 'Chrome', name: 'Cookies', risky: true, description: 'y', sizeBytes: null }
    ]
  },
  {
    category: 'Brave',
    items: [
      { id: 'brave_cache', category: 'Brave', name: 'Cache', description: 'x', sizeBytes: null },
      { id: 'brave_cookies', category: 'Brave', name: 'Cookies', risky: true, description: 'y', sizeBytes: null }
    ]
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  settingsRecord = { excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24, acknowledgedCleanWarnings: [] };
  fetchDeepCleanRules.mockResolvedValue(TWO_BROWSERS);
});

describe('ticking a heading while a filter is active', () => {
  it('ticks and asks about only the visible rules, never hidden ones', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findAllByText('Cookies');
    const filter = screen.getByRole('textbox', { name: 'Filter cleaners…' });

    await user.type(filter, 'cookie');
    await user.click(screen.getByRole('checkbox', { name: 'Select everything under Chrome' }));

    // One question, about Chrome's cookies only: not Chrome's hidden cache,
    // not Brave's cookies.
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Enable Chrome — Cookies')).toBeTruthy();
    await user.click(dialog.getByRole('button', { name: 'Enable anyway' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // Clear the filter and see what actually got ticked (Chrome, then Brave).
    await user.clear(filter);
    const state = (name) => screen.getAllByRole('checkbox', { name }).map((c) => c.getAttribute('aria-checked'));
    expect(state('Cookies')).toEqual(['true', 'false']);
    expect(state('Cache')).toEqual(['false', 'false']);
  });

  it('clears only the visible rules when the heading is unticked', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findAllByText('Cookies');
    // Tick everything safe first, unfiltered.
    await user.click(screen.getByRole('checkbox', { name: 'Select everything under Chrome' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Enable anyway' }));

    const filter = screen.getByRole('textbox', { name: 'Filter cleaners…' });
    await user.type(filter, 'cookie');
    await user.click(screen.getByRole('checkbox', { name: 'Select everything under Chrome' }));
    await user.clear(filter);

    const chrome = screen.getAllByRole('checkbox', { name: 'Cache' })[0];
    expect(chrome.getAttribute('aria-checked')).toBe('true');
    expect(screen.getAllByRole('checkbox', { name: 'Cookies' })[0].getAttribute('aria-checked')).toBe('false');
  });
});

describe('the stacked layout', () => {
  it('keeps a minimum tree height below lg so the log and filter bar cannot squeeze it away', async () => {
    renderScreen(<DeepClean />);
    await screen.findAllByText('Cookies');
    const column = screen.getByTestId('deep-clean-tree-column');
    expect(column.className).toMatch(/min-h-\[240px\]/);
    expect(column.className).toMatch(/lg:min-h-0/);
  });
});
