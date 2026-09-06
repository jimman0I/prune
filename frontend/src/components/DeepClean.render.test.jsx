// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Deep Clean screen, rendered.
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

const executeDeepClean = vi.fn(async () => ({ removed: 2, freedBytes: 1024, locked: [] }));
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  executeDeepClean: (...a) => executeDeepClean(...a),
  fetchSettings: vi.fn(async () => ({
    excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24
  })),
  updateSettings: vi.fn(async (p) => p),
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
  // The array itself, not { categories }. fetchDeepCleanRules unwraps the
  // response before the hook ever sees it.
  fetchDeepCleanRules.mockResolvedValue(rules);
  // The scan is never started in these tests; the rule tree renders
  // without one, which is itself the behaviour that replaced a screen
  // that stayed blank until somebody waited half a minute for a scan.
  streamDeepCleanScan.mockImplementation(() => () => {});
});

const cleanButton = () => screen.getByRole('button', { name: 'Clean' });

describe('the Deep Clean screen', () => {
  it('shows the rules before any scan has run', async () => {
    // The screen used to be empty until a scan finished. The tree is the
    // answer to "what does this even clean", and that question should not
    // cost nineteen seconds.
    renderScreen(<DeepClean />);
    expect(await screen.findByText('Temporary files')).toBeTruthy();
    expect(screen.getByText('Thumbnail cache')).toBeTruthy();
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('cannot clean with nothing selected', async () => {
    // Nothing is selected by default, deliberately -- a select-all
    // default on a screen with 74 rules would make the safe path the
    // one requiring the most work.
    renderScreen(<DeepClean />);
    await screen.findByText('Temporary files');
    expect(cleanButton().disabled).toBe(true);
  });
});

describe('the gate in front of a clean', () => {
  const selectSomething = async (user) => {
    await screen.findByText('Temporary files');
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
  };

  it('does NOT clean on the first click', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);

    await user.click(cleanButton());
    expect(executeDeepClean).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeTruthy();
  });

  it('says how much, not just how many, before it will run', async () => {
    // "Move 47 items to Quarantine?" is not a decision anyone can make.
    // And when nothing has been measured it says so, rather than omitting
    // the number and letting the reader assume it is small.
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());

    expect(screen.getByText(/to Quarantine\?/)).toBeTruthy();
    expect(screen.getByText('size not measured')).toBeTruthy();
  });

  it('backs out on Cancel, having cleaned nothing', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(executeDeepClean).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Clean' })).toBeTruthy();
  });

  it('cleans only what was selected, and only on the second click', async () => {
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await selectSomething(user);
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(executeDeepClean).toHaveBeenCalledTimes(1));
    const [ids] = executeDeepClean.mock.calls[0];
    expect(Array.isArray(ids)).toBe(true);
    expect(ids.length).toBeGreaterThan(0);
  });
});
