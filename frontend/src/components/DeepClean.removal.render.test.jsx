// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';
import { measuredScan, runMeasuredPreview } from '../testSupport/deepCleanPreview.js';

/** How Deep Clean says what it did, and what it is about to do.
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


describe('honest result wording and the removal mode', () => {
  // clearAllMocks keeps a previous test's mockImplementation, so each test
  // starts from the same plain "freed 1 KB" stream.
  beforeEach(() => { streamDeepCleanExecute.mockImplementation(streamOf({ freedBytes: 1024 })); });
  const selectSomething = async (user) => {
    await screen.findByText('Temporary files');
    await previewFirst(user);
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
  };
  function streamOf(rule) { return async (ruleIds, onEvent) => {
    onEvent('start', { total: ruleIds.length });
    onEvent('rule', { id: ruleIds[0], name: ruleIds[0], skipped: [], ...rule });
  }; }

  it('says Moved, not Freed, when a clean only moved files into Quarantine', async () => {
    streamDeepCleanExecute.mockImplementation(streamOf({ freedBytes: 0, movedBytes: 2048, quarantineBatch: 'b1' }));
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));

    const banner = await screen.findByTestId('deep-clean-result');
    expect(banner.textContent).toBe('Moved 2 KB to Quarantine. The space comes back when you empty it.');
    expect(banner.textContent).not.toMatch(/Freed/);
  });

  it('offers a way to Quarantine, and does not empty anything itself', async () => {
    streamDeepCleanExecute.mockImplementation(streamOf({ freedBytes: 0, movedBytes: 2048, quarantineBatch: 'b1' }));
    const onNavigate = vi.fn();
    const user = userEvent.setup();
    renderScreen(<DeepClean onNavigate={onNavigate} />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));

    await user.click(await screen.findByRole('button', { name: 'Open Quarantine' }));
    expect(onNavigate).toHaveBeenCalledWith('quarantine');
  });

  it('says Freed only for what was deleted, and reports both when a clean did both', async () => {
    streamDeepCleanExecute.mockImplementation(streamOf({ freedBytes: 1024, movedBytes: 2048, quarantineBatch: 'b1' }));
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));

    const banner = await screen.findByTestId('deep-clean-result');
    expect(banner.textContent).toBe('Freed 1 KB. Moved 2 KB to Quarantine. The space comes back when you empty it.');
  });

  it('keeps the locked-file clause', async () => {
    streamDeepCleanExecute.mockImplementation(streamOf({ freedBytes: 0, movedBytes: 2048, quarantineBatch: 'b1', skipped: [{ path: 'C:\a.tmp', reason: 'locked' }] }));
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    expect((await screen.findByTestId('deep-clean-result')).textContent).toMatch(/skipped 1 locked file$/);
  });

  it('says it moves to Quarantine by default, next to Clean', async () => {
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    expect(screen.getByTestId('deep-clean-mode').textContent).toBe('Moves to Quarantine.');
  });

  describe("in 'Delete now' mode", () => {
    beforeEach(() => { settingsRecord.deepCleanRemoval = 'delete'; });

    it('says so next to Clean and in the subtitle', async () => {
      renderScreen(<DeepClean />);
      await screen.findByText('Temporary files');
      expect(screen.getByTestId('deep-clean-mode').textContent).toBe('Deletes immediately.');
      expect(screen.getByText(/Clean deletes what you tick immediately/)).toBeTruthy();
    });

    it("asks 'Delete N items? This can't be undone.' with a danger Delete button", async () => {
      const user = userEvent.setup();
      renderScreen(<DeepClean />);
      await selectSomething(user);
      await user.click(cleanButton());

      expect(screen.getByText(/Delete 1 item \(1 KB\)\? This can't be undone\./)).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'Move to Quarantine' })).toBeNull();
      const confirm = screen.getByRole('button', { name: 'Delete' });
      expect(confirm.className).toMatch(/btn-danger/);
      expect(confirm.className).not.toMatch(/btn-primary/);
    });

    it('reports real freed bytes as Freed and offers no Quarantine button', async () => {
      const user = userEvent.setup();
      renderScreen(<DeepClean />);
      await selectSomething(user);
      await user.click(cleanButton());
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect((await screen.findByTestId('deep-clean-result')).textContent).toBe('Freed 1 KB');
      expect(screen.queryByRole('button', { name: 'Open Quarantine' })).toBeNull();
    });

    it('sends the per-run toggle\'s choice, which starts matching the Settings default', async () => {
      // settings.deepCleanRemoval is 'delete' in this describe block, so the
      // confirm bar's own toggle opens already on Delete now -- and the
      // backend is told so explicitly (see lib/cleanOutcome.js), not left to
      // infer it from Settings, since the person could change it right here.
      const user = userEvent.setup();
      renderScreen(<DeepClean />);
      await selectSomething(user);
      await user.click(cleanButton());
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
      expect(streamDeepCleanExecute.mock.calls[0][3]).toBe('delete');
    });

    it('backing Delete now out to Quarantine for one run sends that choice, and the safe prompt', async () => {
      const user = userEvent.setup();
      renderScreen(<DeepClean />);
      await selectSomething(user);
      await user.click(cleanButton());
      // The toggle itself: "Quarantine" beside the already-selected "Delete now".
      await user.click(screen.getByRole('radio', { name: 'Quarantine' }));
      expect(screen.getByText(/Move 1 item \(1 KB\) to Quarantine\?/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
      await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
      expect(streamDeepCleanExecute.mock.calls[0][3]).toBe('quarantine');
    });
  });

  it('turning Delete now on for one run, with Quarantine as the Settings default, sends that choice', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    // Default settings in this file are Quarantine: the toggle opens there.
    expect(screen.getByRole('radio', { name: 'Quarantine' }).getAttribute('aria-checked')).toBe('true');
    await user.click(screen.getByRole('radio', { name: 'Delete now' }));
    expect(screen.getByText(/Delete 1 item \(1 KB\)\? This can't be undone\./)).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Delete' });
    expect(confirm.className).toMatch(/btn-danger/);
    await user.click(confirm);
    await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
    expect(streamDeepCleanExecute.mock.calls[0][3]).toBe('delete');
  });

  it('leaving the toggle alone on the Quarantine default sends no override at all', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
    expect(streamDeepCleanExecute.mock.calls[0][3]).toBeUndefined();
  });

  it('the toggle is gone once cleaning starts -- the choice that mattered already happened', async () => {
    const user = userEvent.setup();
    let resolveStream;
    streamDeepCleanExecute.mockImplementation(() => new Promise((resolve) => { resolveStream = resolve; }));
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
    await waitFor(() => expect(screen.queryByRole('radiogroup')).toBeNull());
    await act(async () => { resolveStream(); await Promise.resolve(); });
  });

  it('says Recycle Bin, not Quarantine, when Auto-Quarantine is off', async () => {
    settingsRecord.autoQuarantine = false;
    streamDeepCleanExecute.mockImplementation(streamOf({ freedBytes: 0, movedBytes: 2048, recycled: true }));
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    expect(screen.getByTestId('deep-clean-mode').textContent).toBe('Moves to the Recycle Bin.');
    await user.click(cleanButton());
    expect(screen.getByText(/Move 1 item \(1 KB\) to the Recycle Bin\?/)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Move to Recycle Bin' }));

    expect((await screen.findByTestId('deep-clean-result')).textContent)
      .toBe('Moved 2 KB to the Recycle Bin. The space comes back when you empty it.');
  });
});
