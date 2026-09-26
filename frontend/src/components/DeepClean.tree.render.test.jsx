// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { measuredScan, runMeasuredPreview } from '../testSupport/deepCleanPreview.js';

/** Deep Clean as a whole, for what the tree's new interaction layer must
 * not break: the risky-rule question and the focus it hands back, and above
 * all that a filter is a view -- Clean still acts on the full selection,
 * not on what happens to be visible.
 *
 * jsdom cannot prove the pixel behaviour (a click landing on the row's
 * padding, focus rings); it can prove the wiring, which is where the
 * regressions here would come from. */

const streamDeepCleanExecute = vi.fn(async (ruleIds, onEvent) => {
  onEvent('start', { total: ruleIds.length });
  for (const id of ruleIds) onEvent('rule', { id, name: id, freedBytes: 10, skipped: [] });
});
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
let settingsRecord = null;
const fetchSettings = vi.fn(async () => settingsRecord);
const updateSettings = vi.fn(async (partial) => {
  settingsRecord = { ...settingsRecord, ...partial };
  return settingsRecord;
});

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchCleanerCategoryIcons: vi.fn(async () => ({})),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

const RULES = [
  {
    category: 'Brave',
    items: [
      { id: 'brave_cache', category: 'Brave', name: 'Cache', description: 'Regenerates on its own.', sizeBytes: null },
      {
        id: 'brave_cookies', category: 'Brave', name: 'Cookies', risky: true,
        description: 'Signs you out of every site that remembered you.', sizeBytes: null
      }
    ]
  },
  {
    category: 'Windows',
    items: [
      { id: 'temp', category: 'Windows', name: 'Temporary files', sizeBytes: null },
      { id: 'thumbs', category: 'Windows', name: 'Thumbnail cache', sizeBytes: null }
    ]
  }
];

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  settingsRecord = {
    excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
    skipRecentHours: 24, acknowledgedCleanWarnings: []
  };
  fetchDeepCleanRules.mockResolvedValue(RULES);
  streamDeepCleanScan.mockImplementation(() => () => {});
});

afterEach(() => window.localStorage.clear());

// Clean stays disabled until a Preview has measured something.
const previewFirst = async (user) => {
  streamDeepCleanScan.mockImplementation(measuredScan(RULES));
  await runMeasuredPreview(user, streamDeepCleanScan);
};

const box = (name) => screen.getByRole('checkbox', { name });
const ticked = (name) => box(name).getAttribute('aria-checked') === 'true';

describe('clicking a risky rule anywhere on its row', () => {
  it('opens the question, and Cancel hands focus back to that row\'s checkbox', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Cookies');

    // The "Loses data" badge, nowhere near the 14px box.
    await user.click(screen.getByText('Loses data'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(ticked('Cookies')).toBe(false);

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Not <body>: the reason the row focuses its own checkbox first.
    expect(document.activeElement).toBe(box('Cookies'));
    expect(ticked('Cookies')).toBe(false);
  });

  it('ticks it on Enable anyway and remembers the choice for that one rule', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Cookies');

    await user.click(screen.getByText('Cookies'));
    const dialog = within(screen.getByRole('dialog'));
    await user.click(dialog.getByLabelText('Remember my choice for Brave — Cookies'));
    await user.click(dialog.getByRole('button', { name: 'Enable anyway' }));

    await waitFor(() => expect(ticked('Cookies')).toBe(true));
    await waitFor(() => {
      const call = updateSettings.mock.calls.find((c) => 'acknowledgedCleanWarnings' in (c[0] ?? {}));
      expect(call?.[0]).toEqual({ acknowledgedCleanWarnings: ['brave_cookies'] });
    });
  });

  it('does not ask a second time once it is remembered', async () => {
    settingsRecord.acknowledgedCleanWarnings = ['brave_cookies'];
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Cookies');

    await user.click(screen.getByText('Cookies'));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() => expect(ticked('Cookies')).toBe(true));
  });

  it('ticks an ordinary rule straight away from a click on its name', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');

    await user.click(screen.getByText('Temporary files'));

    await waitFor(() => expect(ticked('Temporary files')).toBe(true));
    // One click, one toggle: the box inside the row must not double it.
    await user.click(box('Temporary files'));
    await waitFor(() => expect(ticked('Temporary files')).toBe(false));
  });
});

describe('the category heading still leaves risky rules to their own question', () => {
  it('ticks the safe rules and asks about the risky one instead of ticking it', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Cookies');

    await user.click(box('Select everything under Brave'));

    await waitFor(() => expect(ticked('Cache')).toBe(true));
    expect(ticked('Cookies')).toBe(false);
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(box('Select everything under Brave').getAttribute('aria-checked')).toBe('mixed');
  });
});

describe('a filter never changes what Clean acts on', () => {
  const filterBox = () => screen.getByRole('textbox', { name: 'Filter cleaners…' });

  it('cleans the full selection, including rules the filter is hiding', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await previewFirst(user);

    await user.click(screen.getByRole('button', { name: 'Select everything' }));
    await waitFor(() => expect(ticked('Temporary files')).toBe(true));

    // Hide everything but one rule.
    await user.type(filterBox(), 'thumbnail');
    // By role: the scan log the Preview just wrote names every rule too.
    expect(screen.queryByRole('checkbox', { name: 'Temporary files' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Thumbnail cache' })).toBeTruthy();

    // The footer, the header and the count still describe the real selection.
    // (The Preview has measured them, so the summary now carries the size.)
    expect(screen.getByText(/^3 of 4 selected/)).toBeTruthy();
    expect(screen.getByText('3 selected')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Clean' }));
    expect(screen.getByText(/Move 3 items/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));

    await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
    const [ids] = streamDeepCleanExecute.mock.calls[0];
    expect([...ids].sort()).toEqual(['brave_cache', 'temp', 'thumbs']);
  });

  it('does not write the selection setting just because a filter was typed', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await user.click(screen.getByRole('button', { name: 'Select everything' }));
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    const before = updateSettings.mock.calls.length;

    await user.type(filterBox(), 'thumb');
    await user.clear(filterBox());

    expect(updateSettings.mock.calls.length).toBe(before);
  });

  it('keeps the remembered collapse out of the selection setting', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await waitFor(() => expect(updateSettings).toHaveBeenCalled());
    const before = updateSettings.mock.calls.length;

    await user.click(screen.getByRole('button', { expanded: true, name: /Windows/ }));

    expect(screen.queryByText('Temporary files')).toBeNull();
    expect(updateSettings.mock.calls.length).toBe(before);
    expect(window.localStorage.getItem('prune.deepCleanCollapsed')).toBe('["Windows"]');
  });
});

describe('the confirm step', () => {
  it('names the destination on the button, and the prompt is not the danger colour', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    await previewFirst(user);
    await user.click(screen.getByRole('checkbox', { name: 'Temporary files' }));
    await user.click(screen.getByRole('button', { name: 'Clean' }));

    expect(screen.getByRole('button', { name: 'Move to Quarantine' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Confirm' })).toBeNull();
    // Nothing is deleted outright -- it goes to Quarantine first -- so the
    // sentence is a question, not a warning.
    const prompt = screen.getByText(/to Quarantine\?/);
    expect(prompt.className).not.toMatch(/--danger/);
  });
});

describe('the scan log before anything has run', () => {
  it('says what to do next instead of repeating "nothing scanned"', async () => {
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');

    expect(screen.getByText('Press Preview to measure what can be cleaned.')).toBeTruthy();
  });

  it('has a fixed short height when stacked, so it cannot collapse at 900 px', async () => {
    // jsdom applies no CSS, so this pins the classes: a height while
    // stacked (below lg) and the old fill-the-column behaviour from lg up.
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');

    const log = screen.getByText('Scan output').closest('.glass-panel');
    expect(log.className).toMatch(/(?:^|\s)h-44(?:\s|$)/);
    expect(log.className).toMatch(/(?:^|\s)flex-none(?:\s|$)/);
    expect(log.className).toMatch(/lg:h-auto/);
    expect(log.className).toMatch(/lg:flex-1/);
  });
});

describe('the footer links', () => {
  it('give Select everything and Clear a 24px minimum height', async () => {
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');

    for (const name of ['Select everything', 'Clear']) {
      expect(screen.getByRole('button', { name }).className).toMatch(/min-h-\[24px\]/);
    }
  });
});
