// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
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
const fetchSettings = vi.fn();
const updateSettings = vi.fn(async (p) => p);

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  executeDeepClean: (...a) => executeDeepClean(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
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
  fetchSettings.mockResolvedValue({
    excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
    skipRecentHours: 24, acknowledgedCleanWarnings: []
  });
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

describe('the warning in front of a rule that loses data', () => {
  // Each item carries its own `category`, the way the real /deep-clean/
  // rules payload does -- the group heading is not the only place it
  // lives, and the dialog title reads it off the item.
  const riskyRules = [{
    category: 'Brave',
    items: [
      {
        id: 'brave_cache', category: 'Brave', name: 'Cache',
        description: 'Regenerates on its own.', sizeBytes: null, fileCount: null
      },
      {
        id: 'brave_cookies', category: 'Brave', name: 'Cookies', risky: true,
        description: 'Signs you out of every site that remembered you.',
        sizeBytes: null, fileCount: null
      }
    ]
  }];

  const tick = async (user, label) => {
    await screen.findByText('Cookies');
    await user.click(screen.getByRole('checkbox', { name: label }));
  };

  it('asks before ticking one, naming the browser and the consequence', async () => {
    // The row already carries this sentence, but as eleven-point muted
    // text under a name, beside a badge that says only "Loses data".
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');

    // Scoped to the dialog, because the row underneath carries the same
    // sentence -- which is the point. The dialog repeats what the row
    // already says quietly, at the moment the choice is being made.
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Enable Brave — Cookies')).toBeTruthy();
    expect(dialog.getByText('Signs you out of every site that remembered you.')).toBeTruthy();
    expect(dialog.getByLabelText('Remember my choice for Brave — Cookies')).toBeTruthy();
  });

  it('does not tick the box while the question is still open', async () => {
    // The dialog is the question. A box that ticked itself first and
    // asked afterwards would have already given the answer.
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');

    expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('false');
    expect(cleanButton().disabled).toBe(true);
  });

  it('leaves it unticked on Cancel', async () => {
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('false');
  });

  it('ticks it on Enable anyway', async () => {
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');
    await user.click(screen.getByRole('button', { name: 'Enable anyway' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true'));
  });

  it('never asks when UNticking, which cannot lose anything', async () => {
    // A dialog in front of the safe direction is how people learn to
    // click through the one in front of the unsafe direction.
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');
    await user.click(screen.getByRole('button', { name: 'Enable anyway' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true'));

    await user.click(screen.getByRole('checkbox', { name: 'Cookies' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('false');
  });

  it('saves the acknowledgement only when the box was ticked', async () => {
    // A settings write per checkbox click that changed nothing would be a
    // disk write per checkbox click.
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');
    await user.click(screen.getByRole('button', { name: 'Enable anyway' }));
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('remembers one rule by id when asked, not the whole category', async () => {
    // Agreeing to lose cookies is not agreeing to lose browsing history.
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');
    await user.click(screen.getByLabelText('Remember my choice for Brave — Cookies'));
    await user.click(screen.getByRole('button', { name: 'Enable anyway' }));

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1));
    expect(updateSettings.mock.calls[0][0]).toEqual({ acknowledgedCleanWarnings: ['brave_cookies'] });
  });

  it('stops asking about a rule already acknowledged', async () => {
    fetchSettings.mockResolvedValue({
      excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
      skipRecentHours: 24, acknowledgedCleanWarnings: ['brave_cookies']
    });
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cookies');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true');
  });

  it('does not ask about an ordinary rule', async () => {
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await tick(user, 'Cache');

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Cache' }).getAttribute('aria-checked')).toBe('true');
  });
});

describe('what a finished scan does to the selection', () => {
  const riskyRules = [{
    category: 'Brave',
    items: [
      { id: 'brave_cache', category: 'Brave', name: 'Cache', description: 'Regenerates.', sizeBytes: null, fileCount: null },
      {
        id: 'brave_cookies', category: 'Brave', name: 'Cookies', risky: true,
        description: 'Signs you out of every site that remembered you.',
        sizeBytes: null, fileCount: null
      }
    ]
  }];

  it('keeps a risky rule the user enabled on purpose', async () => {
    // The regression this pins. DeepClean narrows the selection after
    // every Preview, and while that filter went through selectableIds --
    // which deliberately skips rules that lose data -- a rule the user
    // had just confirmed through the dialog was silently unticked the
    // moment the scan finished. An explicit choice, undone by a
    // background step, with nothing on screen to say so.
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    // The real signature: streamDeepCleanScan(onEvent, signal), with
    // onEvent(type, data) and types 'start' | 'rule' | 'error'. Each rule
    // carries its category, because mergeScannedRule groups by it.
    //
    // Getting this wrong is how the first version of this test passed
    // against the bug: a mock with invented handler names fired nothing,
    // scannedTree stayed null, and the effect returned early on an empty
    // id set without ever filtering anything.
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 2 });
      onEvent('rule', { id: 'brave_cache', category: 'Brave', name: 'Cache', sizeBytes: 10, present: true, accessible: true });
      onEvent('rule', { id: 'brave_cookies', category: 'Brave', name: 'Cookies', risky: true, sizeBytes: 20, present: true, accessible: true });
    });

    const user = userEvent.setup();
    renderScreen(<DeepClean />);
    await screen.findByText('Cookies');

    await user.click(screen.getByRole('checkbox', { name: 'Cookies' }));
    await user.click(screen.getByRole('button', { name: 'Enable anyway' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true'));

    await user.click(screen.getByRole('button', { name: 'Preview' }));

    // Still ticked. The scan measured it; the user chose it; neither of
    // those is a reason to drop it.
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Cookies' }).getAttribute('aria-checked')).toBe('true'));
  });
});
