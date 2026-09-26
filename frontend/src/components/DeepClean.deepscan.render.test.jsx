// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';
import { measuredScan, runMeasuredPreview } from '../testSupport/deepCleanPreview.js';

/** The profile-wide Deep scan rules on the Deep Clean screen: honest live
 * status while they search, and a partial figure labelled as partial.
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
    { id: 'thumbs', name: 'Thumbnail cache', sizeBytes: null, fileCount: null }
  ]
}, {
  category: 'Deep scan',
  items: [
    { id: 'deepscan_backup', name: 'Backup files', sizeBytes: null, fileCount: null, risky: true, recommended: false }
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


describe('a profile-wide search', () => {
  it('says what it is doing while it runs, with a live count, and clears it when the rule is measured', async () => {
    let emit;
    let finish;
    streamDeepCleanScan.mockImplementation((onEvent) => {
      emit = onEvent;
      onEvent('start', { total: 3 });
      return new Promise((resolve) => { finish = resolve; });
    });
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Backup files');
    await user.click(screen.getAllByRole('button', { name: 'Preview' })[0]);
    await waitFor(() => expect(emit).toBeTruthy());

    act(() => { emit('progress', { id: 'deepscan_backup', dirs: 40, entries: 12345, matches: 2 }); });
    const status = await screen.findByTestId('deep-clean-progress');
    expect(status.textContent).toBe(`Searching your profile… ${(12345).toLocaleString()} items checked`);

    act(() => { emit('rule', { id: 'deepscan_backup', category: 'Deep scan', name: 'Backup files', sizeBytes: 10, fileCount: 1, present: true, accessible: true }); });
    await waitFor(() => expect(screen.queryByTestId('deep-clean-progress')).toBeNull());
    await act(async () => { finish(); });
  });

  it('labels a partial measurement as at least, never as the total', async () => {
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 3 });
      onEvent('rule', { id: 'deepscan_backup', category: 'Deep scan', name: 'Backup files', sizeBytes: 2048, fileCount: 3, present: true, accessible: true, incomplete: 'time' });
    });
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Backup files');
    await user.click(screen.getAllByRole('button', { name: 'Preview' })[0]);
    expect(await screen.findByText('at least 2 KB')).toBeTruthy();
    expect(screen.getAllByText('2 KB, partial').length).toBeGreaterThan(0);
  });
});
