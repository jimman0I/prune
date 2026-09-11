// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The batch modal actually runs in the dependency order.
 *
 * lib/batchOrder.js decides the order and has its own tests. What those
 * cannot show is that the modal USES it -- a lib that is imported, called
 * for the confirm list, and then bypassed by a run loop still iterating
 * `programs` would pass every one of them. So this asserts on the order
 * the uninstaller is actually invoked in, which is the only order that
 * matters.
 *
 * Nothing here runs a real uninstaller: streamUninstall is mocked, and
 * what is asserted is the sequence of program ids it was handed.
 */

const streamUninstall = vi.fn();

vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: vi.fn(async () => ({ files: { items: [] }, registryKeys: { items: [] } })),
  appendHistoryEntry: vi.fn(async () => {}),
  removeQuarantined: vi.fn(async () => ({ files: [], registryKeys: [] })),
  scanForcedUninstall: vi.fn(),
  // The dialog reads settings now (where leftovers go, whether they
  // start ticked). Empty settings are the defaults it always had.
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn()
}));

const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

// Real entries from the dev machine. Steam is deliberately selected FIRST,
// which is the order that breaks: its uninstaller would remove steam.exe,
// the executable Marvel Rivals' own uninstall command runs.
const steam = {
  id: 'steam', name: 'Steam', publisher: 'Valve', sizeBytes: 1024, installLocation: null,
  uninstallString: 'C:\\Program Files (x86)\\Steam\\uninstall.exe'
};
const marvel = {
  id: 'mr', name: 'Marvel Rivals', publisher: 'NetEase Games', sizeBytes: 2048, installLocation: null,
  uninstallString: '"C:\\Program Files (x86)\\Steam\\steam.exe" steam://uninstall/2767030'
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockImplementation(async () => {});
});

describe('the order a batch actually runs in', () => {
  it('uninstalls the game before the launcher it uninstalls through', async () => {
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={[steam, marvel]} onClose={() => {}} onFinished={() => {}} />);

    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));

    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
    expect(streamUninstall.mock.calls.map((c) => c[0])).toEqual(['mr', 'steam']);
  });

  it('says why before you start, rather than reordering silently', async () => {
    /* A list that comes back in a different order from the one you ticked
     * looks like a bug unless it says why. The reason is shown against the
     * program that moved. */
    renderScreen(<BatchUninstallModal programs={[steam, marvel]} onClose={() => {}} onFinished={() => {}} />);

    const names = screen.getAllByText(/^(Steam|Marvel Rivals)$/).map((el) => el.textContent);
    expect(names).toEqual(['Marvel Rivals', 'Steam']);
    expect(screen.getByText(/before Steam/i)).toBeTruthy();
  });
});
