// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';
import { measuredScan, runMeasuredPreview } from '../testSupport/deepCleanPreview.js';

/** The free-space wipe on the Deep Clean screen: never reached in bulk, never
 * remembered, asked about every time with real numbers, and allowed to be
 * the only thing a Clean does.
 *
 * The third and last screen in the app that can destroy something on
 * purpose, and the one whose "Confirm" is on the list of buttons nobody
 * should press on a working machine. Which is exactly why it needs a
 * test: the only safe way to press it is with the API mocked, and until
 * now nothing pressed it at all.
 *
 * Two properties, and neither is about layout. Clean cannot run without
 * a second, deliberate confirmation. And that confirmation states the
 * SIZE, not just the count -- "47 items" is a browser cache or most of a
 * game install, and those are not the same decision.
 */

// The clean itself streams now (see hooks/useDeepCleanExecute.js), the
// same shape the scan already does. Default delivers one 'rule' event
// carrying the WHOLE freedBytes total regardless of how many ids were
// passed -- these tests only ever assert on the final summary, and this
// keeps every "Freed 1 KB" assertion below true no matter how many rules
// a given test happens to select.
const streamDeepCleanExecute = vi.fn(async (ruleIds, onEvent) => {
  onEvent('start', { total: ruleIds.length });
  onEvent('rule', { id: ruleIds[0], name: ruleIds[0], freedBytes: 1024, skipped: [] });
  for (const id of ruleIds.slice(1)) onEvent('rule', { id, name: id, freedBytes: 0, skipped: [] });
});
const fetchDeepCleanRules = vi.fn();
const fetchWipeEstimate = vi.fn();
const streamDeepCleanScan = vi.fn();
// `fetchSettings`/`updateSettings` share one in-memory record instead of
// `updateSettings` echoing back only the partial it was handed.
// useSystemQueries.js's own `save` mutation treats its `onSuccess` payload
// as the FULL settings object and replaces the cache with it wholesale
// (see its comment: "the server returns the FULL settings object, not the
// partial that was sent"). An `updateSettings` that returned just the
// partial broke that contract silently as soon as two different partial
// saves landed in the same test -- e.g. Deep Clean's own selection-
// persistence effect saving `{ deepCleanSelection }` after the tree loads,
// then the rule-warning flow saving `{ acknowledgedCleanWarnings }` --
// because the second one's onSuccess replaced the cache with an object
// that no longer had the first one's field. Merging here is what the real
// backend already does.
let settingsRecord = null;
const fetchSettings = vi.fn(async () => settingsRecord);
const updateSettings = vi.fn(async (partial) => {
  settingsRecord = { ...settingsRecord, ...partial };
  return settingsRecord;
});

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  fetchWipeEstimate: (...a) => fetchWipeEstimate(...a),
  fetchWipeDrives: vi.fn(async () => ({ profileDrive: 'C:', drives: [] })),
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

const rules = [{
  category: 'Windows',
  items: [
    { id: 'temp', name: 'Temporary files', sizeBytes: null, fileCount: null },
    { id: 'system_empty_space', name: 'Free disk space', description: 'Overwrites the free space.', sizeBytes: null, fileCount: null, confirmEveryTime: true, recommended: false }
  ]
}];

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = {
    excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
    skipRecentHours: 24, acknowledgedCleanWarnings: []
  };
  // The array itself, not { categories }. fetchDeepCleanRules unwraps the
  // response before the hook ever sees it.
  fetchDeepCleanRules.mockResolvedValue(rules);
  // The scan is never started in these tests; the rule tree renders
  // without one, which is itself the behaviour that replaced a screen
  // that stayed blank until somebody waited half a minute for a scan.
  streamDeepCleanScan.mockImplementation(() => () => {});
});

const cleanButton = () => screen.getByRole('button', { name: 'Clean' });

// Clean stays disabled until a Preview has measured something, so anything
// that goes on to press it starts from a completed, measured scan.
const previewFirst = async (user) => {
  streamDeepCleanScan.mockImplementation(measuredScan(rules));
  await runMeasuredPreview(user, streamDeepCleanScan);
};


const GB = 1024 ** 3;
const estimate = { drive: 'C:', freeBytes: 40 * GB, totalBytes: 500 * GB, reserveBytes: 10 * GB, bytesToWrite: 30 * GB, bytesPerSecond: 100 * 1024 * 1024, seconds: 5400 };

const wipeCheckbox = () => screen.getByRole('checkbox', { name: /Free disk space/ });
const ticked = () => wipeCheckbox().getAttribute('aria-checked') === 'true';

async function measured(user) {
  await screen.findByText('Free disk space');
  streamDeepCleanScan.mockImplementation(async (onEvent) => {
    onEvent('start', { total: 2 });
    onEvent('rule', { id: 'temp', category: 'Windows', name: 'Temporary files', sizeBytes: 1024, fileCount: 1, present: true, accessible: true });
    // A wipe measures as nothing to measure: sizeBytes stays null.
    onEvent('rule', { id: 'system_empty_space', category: 'Windows', name: 'Free disk space', sizeBytes: null, present: true, accessible: true, confirmEveryTime: true });
  });
  await runMeasuredPreview(user, streamDeepCleanScan);
}

describe('the free-space wipe rule', () => {
  beforeEach(() => {
    fetchWipeEstimate.mockResolvedValue(estimate);
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('start', { total: ids.length });
      onEvent('rule', { id: 'system_empty_space', name: 'Free disk space', freedBytes: 0, skipped: [], wiped: { bytesWritten: 30 * GB, aborted: false } });
    });
  });

  it('is marked as taking a long time, not as losing data', async () => {
    renderScreen(<DeepClean />);
    await screen.findByText('Free disk space');
    expect(screen.getByText('Takes a long time')).toBeTruthy();
    expect(screen.queryByText('Loses data')).toBeNull();
  });

  it('is not reached by Select everything', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    await user.click(screen.getByRole('button', { name: 'Select everything' }));
    expect(ticked()).toBe(false);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('asks first, with the drive, the amount and a time from the measured speed', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    await user.click(wipeCheckbox());

    const dialog = await screen.findByRole('dialog');
    expect(await within(dialog).findByText('Drive: C:')).toBeTruthy();
    expect(within(dialog).getByText('About 30 GB will be written.')).toBeTruthy();
    // 5400 s = 90 min = 1 h 30 min, at 100 MB/s
    expect(within(dialog).getByText(/Roughly 1 h 30 min, from a one-second write test at 100 MB\/s/)).toBeTruthy();
    expect(within(dialog).getByText(/10 GB always stays free/)).toBeTruthy();
    expect(within(dialog).getByText(/SSD with TRIM this does nothing useful and adds write wear/)).toBeTruthy();
    expect(within(dialog).queryByRole('checkbox')).toBeNull(); // nothing to remember
    expect(ticked()).toBe(false); // asking is not ticking
  });

  it('leaves it unticked on Cancel', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    await user.click(wipeCheckbox());
    await user.click(await screen.findByRole('button', { name: 'Cancel' }));
    expect(ticked()).toBe(false);
  });

  it('ticks it on confirm, and asks again next time even though it was confirmed', async () => {
    settingsRecord.acknowledgedCleanWarnings = ['system_empty_space'];
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    await user.click(wipeCheckbox());
    await user.click(await screen.findByRole('button', { name: 'Add to this clean' }));
    expect(ticked()).toBe(true);

    await user.click(wipeCheckbox()); // untick: no question
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(wipeCheckbox()); // tick again: asked again
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('says so when the drive could not be measured', async () => {
    fetchWipeEstimate.mockRejectedValue(new Error('no such drive'));
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    await user.click(wipeCheckbox());
    expect(await screen.findByText("Couldn't measure the drive: no such drive")).toBeTruthy();
  });

  it('never restores a saved tick on it, and never saves one', async () => {
    settingsRecord.deepCleanSelection = ['temp', 'system_empty_space'];
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    expect(ticked()).toBe(false);
    const saved = updateSettings.mock.calls.map((c) => c[0].deepCleanSelection).filter(Boolean);
    for (const list of saved) expect(list).not.toContain('system_empty_space');
  });

  it('can be the only thing a Clean does, and the confirm says it takes hours', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    // Nothing else ticked: only the wipe.
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(wipeCheckbox());
    await user.click(await screen.findByRole('button', { name: 'Add to this clean' }));
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    expect(screen.getByText(/Includes wiping free disk space, which can take hours\./)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));

    const banner = await screen.findByTestId('deep-clean-result');
    expect(banner.textContent).toBe('Wrote 30 GB of zeros over the free space, then deleted it. No space was freed.');
    expect(banner.textContent).not.toMatch(/Freed/);
  });

  it('shows how far the wipe has got while it writes', async () => {
    let emit;
    let finish;
    streamDeepCleanExecute.mockImplementation((ids, onEvent) => {
      emit = onEvent;
      onEvent('start', { total: 1 });
      return new Promise((resolve) => { finish = resolve; });
    });
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await measured(user);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    await user.click(wipeCheckbox());
    await user.click(await screen.findByRole('button', { name: 'Add to this clean' }));
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    await waitFor(() => expect(emit).toBeTruthy());

    act(() => { emit('progress', { id: 'system_empty_space', wipe: true, bytesWritten: 3 * GB, totalBytes: 30 * GB, elapsedMs: 1000 }); });
    expect((await screen.findByTestId('deep-clean-progress')).textContent).toBe('Writing zeros… 3 GB of 30 GB');
    await act(async () => { finish(); });
  });
});
