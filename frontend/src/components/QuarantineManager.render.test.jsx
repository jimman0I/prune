// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The Quarantine screen, actually rendered.
 *
 * This is the app's undo, and this screen is the only place a backup can
 * be destroyed on purpose. The property worth a test is not that the
 * buttons exist -- it is that a single click on "Delete Permanently"
 * cannot delete anything. Every destructive action here is a two-step
 * inline gate, and nothing in the suite was holding that still.
 *
 * lib/api.js is mocked, so no request leaves the test and no real
 * quarantine on this machine is touched. That mock is also what makes it
 * safe to click the buttons a person must not click on a dev machine:
 * "Confirm" here calls a vi.fn(), which is the whole point -- asserting
 * it was NOT called is how the gate gets proven.
 */

const fetchQuarantineBatches = vi.fn();
const restoreQuarantineBatch = vi.fn(async () => ({ restored: true }));
const deleteQuarantineBatch = vi.fn(async () => ({ deleted: true }));
const emptyQuarantine = vi.fn(async () => ({ deletedCount: 2, freedBytes: 0 }));

vi.mock('../lib/api.js', () => ({
  fetchQuarantineBatches: (...a) => fetchQuarantineBatches(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  deleteQuarantineBatch: (...a) => deleteQuarantineBatch(...a),
  emptyQuarantine: (...a) => emptyQuarantine(...a),
  // Imported by the same module for other screens; unused here but the
  // mock replaces the whole module, so they have to exist.
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchSettings: vi.fn(), updateSettings: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const QuarantineManager = (await import('./QuarantineManager.jsx')).default;

const GIB = 1024 ** 3;
const batch = (programName, batchDir, totalSizeBytes) => ({
  programName,
  batchDir,
  createdAt: Date.UTC(2026, 8, 1),
  totalSizeBytes,
  files: [{ originalPath: `C:\\Program Files\\${programName}\\app.exe`, sizeBytes: totalSizeBytes }]
});

const payload = (over = {}) => ({
  batches: [batch('Thing', 'C:\\q\\1-Thing', GIB)],
  totalBytes: GIB,
  batchCount: 1,
  unknownSizeCount: 0,
  exact: true,
  maxBytes: null,
  ...over
});

beforeEach(() => {
  vi.clearAllMocks();
  fetchQuarantineBatches.mockResolvedValue(payload());
});

/** The header summary line as one string.
 *
 * It is assembled from several elements -- "<span>1</span> batch · <span>1
 * GB</span> held" -- so getByText with a regex spanning them finds
 * nothing. Worse, it finds nothing whether the text is right or wrong,
 * which makes a queryByText(...).toBeNull() assertion pass for the wrong
 * reason. Reading textContent is the only version of these checks that
 * can actually fail. */
const headerText = () => document.querySelector('h1 + p')?.textContent ?? '';

/** The first argument a mutation was called with.
 *
 * TanStack Query v5 hands mutationFn a second argument -- a context object
 * carrying the client and the mutation key -- so toHaveBeenCalledWith(arg)
 * never matches. The batch directory is what this screen is responsible
 * for getting right; the context is the library's business. */
const firstArg = (mock) => mock.mock.calls[0]?.[0];

describe('what can be copied', () => {
  it('the reason the quarantine could not be read', async () => {
    fetchQuarantineBatches.mockRejectedValue(new Error('EACCES'));
    renderScreen(<QuarantineManager />);
    expect(isCopyable(await screen.findByText(/Couldn't load quarantine: EACCES/))).toBe(true);
  });

  it('the reason a delete failed', async () => {
    const user = userEvent.setup();
    deleteQuarantineBatch.mockRejectedValueOnce(new Error('EBUSY'));
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Delete Permanently' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(isCopyable(await screen.findByText('EBUSY'))).toBe(true);
  });

  it('the original path of each file held, but not the program name', async () => {
    renderScreen(<QuarantineManager />);
    expect(isCopyable(await screen.findByText('C:\\Program Files\\Thing\\app.exe'))).toBe(true);
    expect(isCopyable(screen.getByText('Thing'))).toBe(false);
  });
});

describe('the Quarantine screen', () => {
  it('lists what is held', async () => {
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText('Thing')).toBeTruthy();
    expect(headerText()).toContain('1 batch');
    expect(headerText()).toContain('1 GB held');
  });

  it('says nothing is there, and cannot be emptied, when it is empty', async () => {
    // An empty state that offers to empty an empty folder is a button
    // that can only ever do nothing.
    fetchQuarantineBatches.mockResolvedValue(payload({ batches: [], batchCount: 0, totalBytes: 0 }));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText('Nothing in quarantine.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Empty Quarantine' }).disabled).toBe(true);
  });

  it('shows the load failure instead of an empty quarantine', async () => {
    // These look identical if an error renders as "nothing here", and
    // they could not mean more different things: one says your backups
    // are safe and unlisted, the other says you have none.
    fetchQuarantineBatches.mockRejectedValue(new Error('EACCES'));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText(/Couldn't load quarantine: EACCES/)).toBeTruthy();
    expect(screen.queryByText('Nothing in quarantine.')).toBeNull();
  });
});

describe('the gate in front of a permanent delete', () => {
  it('does NOT delete on the first click', async () => {
    // The property this whole file exists for. One click arms the
    // confirmation; it must not reach the API.
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Delete Permanently' }));

    expect(deleteQuarantineBatch).not.toHaveBeenCalled();
    expect(screen.getByText('Delete forever?')).toBeTruthy();
  });

  it('backs out on Cancel, having deleted nothing', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Delete Permanently' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(deleteQuarantineBatch).not.toHaveBeenCalled();
    expect(screen.queryByText('Delete forever?')).toBeNull();
    // And the row is back to its normal actions rather than stuck.
    expect(screen.getByRole('button', { name: 'Restore' })).toBeTruthy();
  });

  it('deletes the batch that was confirmed, and only on the second click', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Delete Permanently' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    await waitFor(() => expect(deleteQuarantineBatch).toHaveBeenCalledTimes(1));
    expect(firstArg(deleteQuarantineBatch)).toBe('C:\\q\\1-Thing');
  });

  it('gates Empty Quarantine the same way', async () => {
    // This one destroys every backup at once, so it gets the same two
    // steps rather than a native confirm() nobody reads.
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Empty Quarantine' }));

    expect(emptyQuarantine).not.toHaveBeenCalled();
    expect(screen.getByText('Permanently delete every batch?')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(emptyQuarantine).not.toHaveBeenCalled();
  });

  it('reports a failed delete rather than looking like it worked', async () => {
    const user = userEvent.setup();
    deleteQuarantineBatch.mockRejectedValueOnce(new Error('EBUSY'));
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Delete Permanently' }));
    await user.click(screen.getByRole('button', { name: 'Confirm' }));

    expect(await screen.findByText('EBUSY')).toBeTruthy();
    // The batch is still listed, because it is still there.
    expect(screen.getByText('Thing')).toBeTruthy();
  });
});

describe('restore', () => {
  it('sends the batch directory, and needs no confirmation', async () => {
    // Restoring puts files back where they came from. It is the one
    // action here that cannot lose anything, so it is one click.
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledTimes(1));
    expect(firstArg(restoreQuarantineBatch)).toBe('C:\\q\\1-Thing');
  });
});

describe('what the header says about the limit', () => {
  it('shows the cap beside the total when one is set', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload({ maxBytes: 5 * GIB }));
    renderScreen(<QuarantineManager />);
    await screen.findByText('Thing');
    expect(headerText()).toContain('1 GB held of 5 GB');
  });

  it('says nothing about a limit when none is set', async () => {
    renderScreen(<QuarantineManager />);
    await screen.findByText('Thing');
    expect(headerText()).toContain('1 GB held');
    expect(headerText()).not.toContain('of');
  });

  it('warns when the cap does not hold, and explains why it will not', async () => {
    // One batch larger than the whole budget. The newest is never dropped
    // to make room, so the number stays over the line and the screen has
    // to say so rather than let a limit quietly not apply.
    fetchQuarantineBatches.mockResolvedValue(payload({ totalBytes: 60 * GIB, maxBytes: 5 * GIB }));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText(/Over the 5 GB limit/)).toBeTruthy();
    expect(screen.getByText(/most recent backup is never removed/)).toBeTruthy();
  });

  it('says "at least" when a batch was never measured', async () => {
    // Rounding an unknown down to zero and printing the result as though
    // it were exact would understate the total while looking precise.
    fetchQuarantineBatches.mockResolvedValue(payload({ unknownSizeCount: 2, exact: false }));
    renderScreen(<QuarantineManager />);
    await screen.findByText('Thing');
    expect(headerText()).toContain('at least');
    expect(headerText()).toContain('2 unmeasured');
  });
});
