// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Applications list, rendered.
 *
 * The largest component in the app at 613 lines, and the one that starts
 * uninstalls -- and until now it had no test of any kind. Its helper
 * libraries are well covered (sortPrograms, batchSelection,
 * recentPrograms all have their own suites); what was not covered is the
 * wiring, which is where the decisions that matter live.
 *
 * The emphasis here is on the properties that protect the user from
 * removing something they did not mean to. Nothing in this file presses a
 * real Uninstall: the modal that does that lives in App, and what is
 * asserted is which program the list HANDS to it.
 */

vi.mock('../lib/api.js', () => ({
  // Never called in these tests -- every render is given programs up
  // front. Present because the module is imported at load time.
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(async () => {}),
  openInstalledAppsSettings: vi.fn(async () => {})
}));

const ProgramList = (await import('./ProgramList.jsx')).default;

/* `uninstallString` is on the base fixture because a program without one
 * is batch-INELIGIBLE (see lib/batchSelection.js), and leaving it off made
 * every row unselectable -- which is how the first version of the
 * filtered-selection test passed while selecting nothing at all. The
 * fixtures that should be ineligible are made so by their own rules
 * instead: orphaned, store, extension. */
const program = (over = {}) => ({
  id: over.name || 'p',
  name: 'Thing',
  publisher: 'Acme',
  sizeBytes: 1024 * 1024,
  source: 'registry',
  uninstallString: 'C:\\Program Files\\Thing\\uninstall.exe',
  ...over
});

const PROGRAMS = [
  program({ id: 'steam', name: 'Steam', publisher: 'Valve', sizeBytes: 20e9 }),
  program({ id: 'brave', name: 'Brave', publisher: 'Brave Software', sizeBytes: 5e9 }),
  program({ id: 'ghost', name: 'Ghost Downloader', publisher: 'XiaoYouChR', sizeBytes: 1e9, unused: true }),
  program({ id: 'broken', name: 'Broken Thing', publisher: 'Nobody', sizeBytes: 2e9, health: { orphaned: true } }),
  program({ id: 'storeapp', name: 'Store App', publisher: 'Microsoft', sizeBytes: 3e9, source: 'store' })
];

const EXTENSIONS = [
  program({ id: 'ext1', name: 'uBlock Origin', publisher: 'Raymond Hill', source: 'extension' })
];

const render = (props = {}) => renderScreen(
  <ProgramList
    programs={PROGRAMS}
    extensions={EXTENSIONS}
    running={{}}
    icons={{}}
    onUninstall={props.onUninstall || (() => {})}
    onBatchUninstall={props.onBatchUninstall || (() => {})}
    {...props}
  />
);

beforeEach(() => { vi.clearAllMocks(); });

describe('the program list', () => {
  it('lists what it was given', async () => {
    render();
    expect(await screen.findByText('Steam')).toBeTruthy();
    expect(screen.getByText('Brave')).toBeTruthy();
  });

  it('searches the publisher as well as the name', async () => {
    // Typing a vendor is how people find "that Valve thing" whose name
    // they cannot remember, and it is easy to implement as name-only.
    const user = userEvent.setup();
    render();
    await screen.findByText('Steam');
    await user.type(screen.getByPlaceholderText(/search/i), 'valve');

    expect(screen.getByText('Steam')).toBeTruthy();
    expect(screen.queryByText('Brave')).toBeNull();
  });
});

describe('the filters', () => {
  const clickFilter = async (user, label) => {
    const button = screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith(label));
    await user.click(button);
  };

  it('shows only orphaned entries under Broken', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Steam');
    await clickFilter(user, 'Broken');

    expect(screen.getByText('Broken Thing')).toBeTruthy();
    expect(screen.queryByText('Steam')).toBeNull();
  });

  it('shows only Store apps under Store', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Steam');
    await clickFilter(user, 'Store');

    expect(screen.getByText('Store App')).toBeTruthy();
    expect(screen.queryByText('Steam')).toBeNull();
  });

  it('swaps in the extension list entirely under Extensions', async () => {
    // Extensions are a separate list, not a subset of the programs: an
    // extension is not an installed program, and mixing them would
    // dilute both the count and the total size.
    const user = userEvent.setup();
    render();
    await screen.findByText('Steam');
    await clickFilter(user, 'Extensions');

    expect(screen.getByText('uBlock Origin')).toBeTruthy();
    expect(screen.queryByText('Steam')).toBeNull();
  });
});

describe('handing a program to the uninstaller', () => {
  it('passes the program whose row was clicked, and only that one', async () => {
    // The whole list is one component and every row has its own button;
    // handing over the wrong object is the failure this exists to catch.
    const onUninstall = vi.fn();
    const user = userEvent.setup();
    render({ onUninstall });
    await screen.findByText('Brave');

    const braveRow = screen.getByText('Brave').closest('div[class*="grid"]');
    await user.click(within(braveRow).getByRole('button', { name: /uninstall/i }));

    expect(onUninstall).toHaveBeenCalledTimes(1);
    expect(onUninstall.mock.calls[0][0].id).toBe('brave');
  });

  it('offers Force remove, not Uninstall, for an entry whose uninstaller is gone', async () => {
    // A different word for a genuinely different act: there is no
    // uninstaller left to run, so Prune removes the leftovers itself.
    render();
    await screen.findByText('Broken Thing');
    const row = screen.getByText('Broken Thing').closest('div[class*="grid"]');

    expect(within(row).getByRole('button', { name: /force remove/i })).toBeTruthy();
  });

  it('does not offer to uninstall a Store app itself', async () => {
    // Removing one is Remove-AppxPackage, which Prune does not do. The
    // row opens Windows' own page instead of pretending to handle it.
    render();
    await screen.findByText('Store App');
    const row = screen.getByText('Store App').closest('div[class*="grid"]');

    expect(within(row).queryByRole('button', { name: /^uninstall$/i })).toBeNull();
    // Matched on the accessible name, which is the aria-label rather than
    // the visible "In Windows" -- the label spells out what the button
    // does because two words on a row cannot.
    expect(within(row).getByRole('button', { name: /open windows settings to remove/i })).toBeTruthy();
  });

  it('does not offer to uninstall a browser extension', async () => {
    const user = userEvent.setup();
    render();
    await screen.findByText('Steam');
    await user.click(screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith('Extensions')));

    const row = screen.getByText('uBlock Origin').closest('div[class*="grid"]');
    expect(within(row).queryByRole('button', { name: /uninstall/i })).toBeNull();
  });
});

describe('a selection that has been filtered away', () => {
  it('is not carried into a batch uninstall', async () => {
    /* The property this file exists for.
     *
     * Tick a row, then change the filter so it is no longer on screen. A
     * selection is a statement about what is in front of you, and this is
     * the one place in the app where getting that wrong uninstalls
     * something nobody asked to remove.
     *
     * Every assertion here is unconditional, which it was not at first:
     * the original version only checked the batch button IF one was
     * present, so it passed happily against a deliberately broken
     * selection. Mutation testing caught that -- pointing the selection at
     * the unfiltered list left all ten tests green.
     */
    const onBatchUninstall = vi.fn();
    const user = userEvent.setup();
    render({ onBatchUninstall });
    await screen.findByText('Steam');

    const steamRow = screen.getByText('Steam').closest('div[class*="grid"]');
    await user.click(within(steamRow).getByRole('checkbox'));

    // The selection really happened -- without this the rest proves
    // nothing, because "no batch button" is also what an empty selection
    // looks like.
    const batchButton = () => screen.queryAllByRole('button')
      .find((b) => /^Uninstall \d+ program/.test(b.textContent.trim()));
    expect(batchButton(), 'batch bar should appear once a row is ticked').toBeTruthy();
    expect(batchButton().textContent).toMatch(/Uninstall 1 program/);

    // Now show only Broken, where Steam does not appear.
    await user.click(screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith('Broken')));
    expect(screen.queryByText('Steam')).toBeNull();

    // The bar must be gone: nothing selected is visible any more.
    expect(batchButton(), 'batch bar should not survive its rows being filtered away').toBeFalsy();
  });

  it('still batches what IS visible', async () => {
    // The other half, so the guarantee above cannot be met by simply
    // never batching anything.
    const onBatchUninstall = vi.fn();
    const user = userEvent.setup();
    render({ onBatchUninstall });
    await screen.findByText('Steam');

    const steamRow = screen.getByText('Steam').closest('div[class*="grid"]');
    await user.click(within(steamRow).getByRole('checkbox'));
    await user.click(screen.getAllByRole('button')
      .find((b) => /^Uninstall \d+ program/.test(b.textContent.trim())));

    expect(onBatchUninstall).toHaveBeenCalledTimes(1);
    expect(onBatchUninstall.mock.calls[0][0].map((p) => p.id)).toEqual(['steam']);
  });
});
