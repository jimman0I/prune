// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { measuredScan, runMeasuredPreview } from '../testSupport/deepCleanPreview.js';

/** Stop, mid-Clean, must not do what a completed Clean does.
 *
 * Found live: pressing Stop took the exact same success path as a
 * finished clean (useDeepCleanExecute's run() returns normally, with
 * `aborted: true`, rather than throwing on AbortError) -- so handleClean
 * unconditionally cleared `selected`, and the selection-persistence effect
 * then saved that empty Set to disk, overwriting the user's real choice
 * with nothing. Next launch seeded back to the defaults, not what they'd
 * actually picked.
 */

const streamDeepCleanScan = vi.fn();
const fetchDeepCleanRules = vi.fn();
// Never resolves on its own -- only rejects once the real AbortController
// (built inside useDeepCleanExecute's run()) fires, the same way a real
// fetch's AbortSignal would reject an in-flight request.
const streamDeepCleanExecute = vi.fn((ruleIds, onEvent, signal) => {
  onEvent('start', { total: ruleIds.length });
  return new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => {
      const err = new Error('The operation was aborted');
      err.name = 'AbortError';
      reject(err);
    });
  });
});

let settingsRecord = null;
const fetchSettings = vi.fn(async () => settingsRecord);
const updateSettings = vi.fn(async (partial) => {
  settingsRecord = { ...settingsRecord, ...partial };
  return settingsRecord;
});

// renderScreen() mounts ToastProvider but not ToastHost (see
// DeepClean.language.render.test.jsx's own comment on this) -- a real
// toast never reaches the DOM through it. Mocking the hook directly reads
// what handleClean actually decided to say, independent of whether
// anything renders it.
const warnSpy = vi.fn();
const successSpy = vi.fn();
vi.mock('../hooks/useToasts.jsx', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useToasts: () => ({ warn: warnSpy, success: successSpy, info: vi.fn(), error: vi.fn() })
  };
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
  fetchDeepCleanRules.mockResolvedValue(rules);
  streamDeepCleanScan.mockImplementation(() => () => {});
});

const cleanButton = () => screen.getByRole('button', { name: 'Clean' });

it('keeps the ticked selection, and what gets saved, after Stop mid-clean', async () => {
  streamDeepCleanScan.mockImplementation(measuredScan(rules));
  const user = userEvent.setup();
  renderScreen(<DeepClean />);

  await screen.findByText('Temporary files');
  await runMeasuredPreview(user, streamDeepCleanScan);
  const boxes = screen.getAllByRole('checkbox');
  await user.click(boxes[boxes.length - 1]);
  await waitFor(() => expect(cleanButton().disabled).toBe(false));

  // What the user actually picked, persisted the normal way (the
  // selection-save effect fires on every change) -- this is the baseline
  // Stop must not clobber.
  await waitFor(() => expect(settingsRecord.deepCleanSelection).toEqual(['thumbs']));

  await user.click(cleanButton());
  await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
  await user.click(await screen.findByRole('button', { name: 'Stop' }));

  // The checkbox is still ticked on screen -- Stop did not reset the UI
  // to its unselected defaults. These are role="checkbox" buttons
  // (aria-checked), not native <input type="checkbox">.
  await waitFor(() =>
    expect(boxes[boxes.length - 1].getAttribute('aria-checked')).toBe('true')
  );

  // And what's actually on disk after Stop is still the real pick, not
  // the `[]` an unconditional setSelected(new Set()) used to save over
  // it. (Mount itself saves `[]` once, before anything is ticked -- that
  // save is normal and not what this regression is about; the one that
  // matters is whatever is left after Stop.)
  expect(settingsRecord.deepCleanSelection).toEqual(['thumbs']);
});

it('reports "stopped", not "complete", in the result banner', async () => {
  streamDeepCleanScan.mockImplementation(measuredScan(rules));
  const user = userEvent.setup();
  renderScreen(<DeepClean />);

  await screen.findByText('Temporary files');
  await runMeasuredPreview(user, streamDeepCleanScan);
  const boxes = screen.getAllByRole('checkbox');
  await user.click(boxes[boxes.length - 1]);
  await waitFor(() => expect(cleanButton().disabled).toBe(false));

  await user.click(cleanButton());
  await user.click(screen.getByRole('button', { name: 'Move to Quarantine' }));
  await user.click(await screen.findByRole('button', { name: 'Stop' }));

  await waitFor(() => expect(warnSpy).toHaveBeenCalled());
  expect(warnSpy.mock.calls[0][0]).toMatch(/^Cleanup stopped\./);
  expect(successSpy).not.toHaveBeenCalled();
});
