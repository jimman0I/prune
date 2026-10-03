// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { measuredScan } from '../testSupport/deepCleanPreview.js';
import { APP_VERSION } from '../lib/appVersion.js';
import { scanFingerprint, saveScanCache, loadScanCache, SCAN_CACHE_KEY } from '../lib/deepCleanScanCache.js';

/** Deep Clean scans once, remembers it, and then just cleans -- BleachBit's
 * way. These pin the behaviour a person would notice: opening the screen on a
 * remembered scan does not walk the disk, Clean works from it, a clean does
 * not trigger a rescan, and the rows stay honest afterwards. */

const streamDeepCleanExecute = vi.fn();
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
const executeDeepCleanElevated = vi.fn();
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
  executeDeepCleanElevated: (...a) => executeDeepCleanElevated(...a),
  fetchMftStatus: vi.fn(async () => ({ elevated: false })),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchCleanerCategoryIcons: vi.fn(async () => ({}))
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

const RULES = [{
  category: 'Windows',
  items: [
    { id: 'temp', name: 'Temporary files', category: 'Windows', paths: ['%TEMP%'], sizeBytes: null, fileCount: null, present: true, recommended: true },
    { id: 'thumbs', name: 'Thumbnail cache', category: 'Windows', paths: ['%THUMBS%'], sizeBytes: null, fileCount: null, present: true },
    { id: 'prefetch', name: 'Prefetch', category: 'Windows', paths: ['C:\\Windows\\Prefetch'], sizeBytes: null, fileCount: null, present: true }
  ]
}];

const baseSettings = () => ({
  excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
  skipRecentHours: 24, acknowledgedCleanWarnings: [], deepCleanSelection: ['temp']
});

/** What a complete earlier scan left behind, valid for the current settings. */
function seedCache({ rules = RULES, settings = settingsRecord, savedAt = Date.now() - 3 * 60 * 60 * 1000, measured } = {}) {
  const tree = [{
    category: 'Windows',
    items: [
      { id: 'temp', sizeBytes: 5 * 1024 * 1024, fileCount: 12, present: true, accessible: true, filesListed: true },
      { id: 'thumbs', sizeBytes: 2048, fileCount: 3, present: true, accessible: true },
      { id: 'prefetch', sizeBytes: 100, fileCount: 1, present: true, accessible: false },
      ...(measured ?? [])
    ]
  }];
  const fingerprint = scanFingerprint({ settings, rules, appVersion: APP_VERSION });
  expect(saveScanCache({ tree, fingerprint, savedAt })).toBe(true);
  return { fingerprint, savedAt };
}

const row = async (name) => (await screen.findByText(name)).closest('div');
const cleanButton = () => screen.getByRole('button', { name: 'Clean' });

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = baseSettings();
  fetchDeepCleanRules.mockResolvedValue(RULES);
  streamDeepCleanScan.mockImplementation(measuredScan(RULES, 4096));
  streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
    onEvent('start', { total: ids.length });
    for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', freedBytes: 5 * 1024 * 1024, skipped: [] });
  });
});

describe('opening Deep Clean on a remembered scan', () => {
  it('shows the remembered sizes at once and does not scan', async () => {
    seedCache();
    renderScreen(<DeepClean />);

    expect(await within(await row('Temporary files')).findByText('5 MB')).toBeTruthy();
    expect(within(await row('Thumbnail cache')).getByText('2 KB')).toBeTruthy();
    // Settle: give an unwanted automatic scan every chance to start.
    await screen.findByRole('button', { name: 'Rescan' });
    await new Promise((r) => setTimeout(r, 50));
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('says when it was measured, beside Rescan, and that the scan is the last one', async () => {
    seedCache({ savedAt: Date.now() - 3 * 60 * 60 * 1000 });
    renderScreen(<DeepClean />);

    expect((await screen.findByTestId('deep-clean-last-measured')).textContent).toBe('Last measured: 3 hours ago');
    expect(screen.getByText('Showing the last scan. Rescan to measure again.')).toBeTruthy();
    // Not the old "Press Preview" empty state, and not a Preview-first hint.
    expect(screen.queryByText('Press Preview to measure what can be cleaned.')).toBeNull();
    expect(document.getElementById('deep-clean-preview-first')).toBeNull();
    expect(screen.getByRole('button', { name: 'Rescan' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Preview' })).toBeNull();
  });

  it('writes the age in the chosen language', async () => {
    settingsRecord = { ...baseSettings(), language: 'de' };
    seedCache({ settings: settingsRecord, savedAt: Date.now() - 3 * 60 * 60 * 1000 });
    renderScreen(<DeepClean />);

    const label = await screen.findByTestId('deep-clean-last-measured');
    expect(label.textContent).toBe(`Zuletzt gemessen: ${new Intl.RelativeTimeFormat('de', { numeric: 'auto' }).format(-3, 'hour')}`);
  });

  it('keeps the lock, not-installed and size states of the rows it shows', async () => {
    seedCache();
    renderScreen(<DeepClean />);

    const prefetch = await row('Prefetch');
    expect(within(prefetch).getByText('needs admin')).toBeTruthy();
    expect(await screen.findByText('1 item needs administrator access to measure and clean.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clean as administrator' })).toBeTruthy();
  });

  it('keeps the saved ticks', async () => {
    seedCache();
    renderScreen(<DeepClean />);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Temporary files' }).getAttribute('aria-checked')).toBe('true'));
    expect(screen.getByRole('checkbox', { name: 'Thumbnail cache' }).getAttribute('aria-checked')).toBe('false');
  });
});

describe('when there is nothing usable to open on', () => {
  it('scans on its own with no remembered scan', async () => {
    renderScreen(<DeepClean />);
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
  });

  it('scans on its own when the remembered scan is stale', async () => {
    seedCache({ settings: { ...settingsRecord, excludeFolders: ['D:\\Old'] } });
    renderScreen(<DeepClean />);
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
    // And it did not show the old numbers while it did.
    expect(screen.queryByText('5 MB')).toBeNull();
  });

  it('scans when the rule set has changed since', async () => {
    seedCache({ rules: [{ category: 'Windows', items: [RULES[0].items[0]] }] });
    renderScreen(<DeepClean />);
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
  });

  it('scans when the remembered value is corrupt, and replaces it', async () => {
    window.localStorage.setItem(SCAN_CACHE_KEY, '{"version":1,"savedAt":"x"');
    renderScreen(<DeepClean />);
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadScanCache()).not.toBeNull());
  });

  it('still scans and works when storage is unavailable', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    try {
      renderScreen(<DeepClean />);
      await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
      expect(await screen.findByRole('button', { name: 'Rescan' })).toBeTruthy();
    } finally {
      getItem.mockRestore();
      setItem.mockRestore();
    }
  });

  it('remembers a scan that completes, with the time it finished', async () => {
    renderScreen(<DeepClean />);
    await screen.findByRole('button', { name: 'Rescan' });
    await waitFor(() => expect(loadScanCache()?.rules.temp?.sizeBytes).toBe(4096));
    expect((await screen.findByTestId('deep-clean-last-measured')).textContent).toBe('Last measured: just now');
  });

  it('does not remember a scan that was cut short', async () => {
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 3 });
      onEvent('rule', { id: 'temp', category: 'Windows', sizeBytes: 10, fileCount: 1, present: true, accessible: true });
    });
    renderScreen(<DeepClean />);
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalled());
    await screen.findByRole('button', { name: 'Rescan' });
    expect(loadScanCache()).toBeNull();
  });
});

describe('cleaning from a remembered scan', () => {
  it('enables Clean and cleans without scanning', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);

    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(await screen.findByRole('button', { name: 'Move to Quarantine' }));

    await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
    expect(streamDeepCleanExecute.mock.calls[0][0]).toEqual(['temp']);
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('says in the confirmation that the sizes are from the last scan', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);

    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    expect((await screen.findByTestId('deep-clean-cache-note')).textContent)
      .toBe('Sizes are from the last scan. Each item is checked again as it is cleaned.');
  });

  it('does not say so after a fresh scan', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByRole('button', { name: 'Rescan' });
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await screen.findByRole('button', { name: 'Move to Quarantine' });
    expect(screen.queryByTestId('deep-clean-cache-note')).toBeNull();
  });

  it('still needs something ticked, and something measured', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(cleanButton().disabled).toBe(true);

    // Ticking a rule the remembered scan measured is enough.
    await user.click(screen.getByRole('checkbox', { name: 'Thumbnail cache' }));
    expect(cleanButton().disabled).toBe(false);
  });
});

describe('after a clean', () => {
  const clean = async (user) => {
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(await screen.findByRole('button', { name: 'Move to Quarantine' }));
    await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalled());
    await screen.findByTestId('deep-clean-result');
  };

  it('does not scan again', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);
    await clean(user);
    await new Promise((r) => setTimeout(r, 50));
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
    // The result banner is still there: nothing came to clear it.
    expect(screen.getByTestId('deep-clean-result').textContent).toMatch(/Freed 5 MB/);
  });

  it('does not scan again after a clean that followed a fresh scan either', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByRole('button', { name: 'Rescan' });
    expect(streamDeepCleanScan).toHaveBeenCalledTimes(1);
    await clean(user);
    await new Promise((r) => setTimeout(r, 50));
    expect(streamDeepCleanScan).toHaveBeenCalledTimes(1);
  });

  it('shows a fully cleaned rule as 0 B, leaves the others alone, and remembers that', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);
    await clean(user);

    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('0 B')).toBeTruthy());
    expect(within(await row('Thumbnail cache')).getByText('2 KB')).toBeTruthy();
    const stored = loadScanCache();
    expect(stored.rules.temp.sizeBytes).toBe(0);
    expect(stored.rules.thumbs.sizeBytes).toBe(2048);
  });

  it('does not tick the default rules again on the rows it just emptied', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);
    await clean(user);
    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('0 B')).toBeTruthy());
    expect(screen.getByText('0 selected')).toBeTruthy();
  });

  it('keeps what is left on a rule that had locked files', async () => {
    const user = userEvent.setup();
    seedCache();
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('start', { total: ids.length });
      onEvent('rule', { id: 'temp', name: 'temp', freedBytes: 4 * 1024 * 1024, skipped: [{ path: 'x', reason: 'locked or inaccessible' }] });
    });
    renderScreen(<DeepClean />);
    await clean(user);

    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('1 MB')).toBeTruthy());
    expect(loadScanCache().rules.temp.sizeBytes).toBe(1024 * 1024);
  });

  it('says "cleaned -- rescan to measure" where what is left cannot be known', async () => {
    const user = userEvent.setup();
    // The rule edits a database in place: its size afterwards is not its size before minus anything.
    const rules = [{ category: 'Windows', items: [
      { ...RULES[0].items[0], paths: undefined, actions: [{ type: 'chrome.history', path: 'x' }] },
      RULES[0].items[1], RULES[0].items[2]
    ] }];
    fetchDeepCleanRules.mockResolvedValue(rules);
    seedCache({ rules });
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('start', { total: ids.length });
      onEvent('rule', { id: 'temp', name: 'temp', freedBytes: 1000, skipped: [], vacuumed: true });
    });
    renderScreen(<DeepClean />);
    await clean(user);

    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('Cleaned — rescan to measure')).toBeTruthy());
    expect(loadScanCache().rules.temp.rescanNeeded).toBe(true);
  });

  it('settles the rules that finished when the clean is stopped', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), deepCleanSelection: ['temp', 'thumbs'] };
    seedCache({ settings: settingsRecord });
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent, signal) => {
      onEvent('start', { total: ids.length });
      onEvent('rule', { id: 'temp', name: 'temp', freedBytes: 5 * 1024 * 1024, skipped: [] });
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    });
    renderScreen(<DeepClean />);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(await screen.findByRole('button', { name: 'Move to Quarantine' }));
    await user.click(await screen.findByRole('button', { name: 'Stop' }));

    await waitFor(() => expect(within(screen.getByText('Temporary files').closest('div')).getByText('0 B')).toBeTruthy());
    // The one that never ran is untouched.
    expect(within(await row('Thumbnail cache')).getByText('2 KB')).toBeTruthy();
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });
});

describe('Clean as administrator from a remembered scan', () => {
  it('settles the protected rules without a scan and drops the banner', async () => {
    const user = userEvent.setup();
    seedCache();
    executeDeepCleanElevated.mockResolvedValue({
      ok: true,
      data: { freedBytes: 100, movedBytes: 0, results: [{ id: 'prefetch', freedBytes: 100, skipped: [] }] }
    });
    renderScreen(<DeepClean />);

    await user.click(await screen.findByRole('button', { name: 'Clean as administrator' }));
    expect(executeDeepCleanElevated).toHaveBeenCalledWith(['prefetch']);
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Clean as administrator' })).toBeNull());
    expect(within(await row('Prefetch')).getByText('Cleaned — rescan to measure')).toBeTruthy();
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('leaves them protected when nothing could be removed', async () => {
    const user = userEvent.setup();
    seedCache();
    executeDeepCleanElevated.mockResolvedValue({
      ok: true,
      data: { freedBytes: 0, movedBytes: 0, results: [{ id: 'prefetch', freedBytes: 0, skipped: [{ path: 'p', reason: 'locked or inaccessible' }] }] }
    });
    renderScreen(<DeepClean />);

    await user.click(await screen.findByRole('button', { name: 'Clean as administrator' }));
    await waitFor(() => expect(executeDeepCleanElevated).toHaveBeenCalled());
    expect(within(await row('Prefetch')).getByText('needs admin')).toBeTruthy();
  });
});

describe('the biggest-files list on remembered rows', () => {
  it('says it needs a rescan, and offers one', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);

    await user.click(await screen.findByRole('button', { name: 'Show files in Temporary files' }));
    const note = await screen.findByTestId('rule-files-need-rescan');
    expect(note.textContent).toBe('The list of largest files needs a fresh scan.');

    await user.click(within(note.parentElement).getByRole('button', { name: 'Rescan' }));
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
  });

  it('offers no list for a rule that never had one', async () => {
    seedCache();
    renderScreen(<DeepClean />);
    await screen.findByText('Thumbnail cache');
    expect(screen.queryByRole('button', { name: 'Show files in Thumbnail cache' })).toBeNull();
  });

  it('shows the real list once a fresh scan has it', async () => {
    const user = userEvent.setup();
    seedCache();
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 3 });
      onEvent('rule', { id: 'temp', category: 'Windows', sizeBytes: 5000, fileCount: 2, present: true, accessible: true, filesListed: true, files: [{ path: 'C:\\Temp\\a.tmp', sizeBytes: 4000 }] });
      onEvent('rule', { id: 'thumbs', category: 'Windows', sizeBytes: 10, fileCount: 1, present: true, accessible: true });
      onEvent('rule', { id: 'prefetch', category: 'Windows', sizeBytes: 10, fileCount: 1, present: true, accessible: true });
    });
    renderScreen(<DeepClean />);

    await user.click(await screen.findByRole('button', { name: 'Rescan' }));
    await user.click(await screen.findByRole('button', { name: 'Show files in Temporary files' }));
    expect(await screen.findByText('C:\\Temp\\a.tmp')).toBeTruthy();
    expect(screen.queryByTestId('rule-files-need-rescan')).toBeNull();
  });
});

describe('Rescan', () => {
  it('walks the disk again and refreshes what is remembered', async () => {
    const user = userEvent.setup();
    seedCache({ savedAt: Date.now() - 3 * 60 * 60 * 1000 });
    renderScreen(<DeepClean />);
    await within(await row('Temporary files')).findByText('5 MB');
    expect(streamDeepCleanScan).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Rescan' }));
    await waitFor(() => expect(streamDeepCleanScan).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(loadScanCache().rules.temp.sizeBytes).toBe(4096));
    expect(loadScanCache().savedAt).toBeGreaterThan(Date.now() - 60 * 1000);
    await waitFor(() => expect(screen.getByTestId('deep-clean-last-measured').textContent).toBe('Last measured: just now'));
    expect(within(await row('Temporary files')).queryByText('5 MB')).toBeNull();
  });

  it('drops the from-the-last-scan note once everything is fresh', async () => {
    const user = userEvent.setup();
    seedCache();
    renderScreen(<DeepClean />);
    await screen.findByText('Showing the last scan. Rescan to measure again.');

    await user.click(screen.getByRole('button', { name: 'Rescan' }));
    await waitFor(() => expect(screen.queryByText('Showing the last scan. Rescan to measure again.')).toBeNull());
  });
});
