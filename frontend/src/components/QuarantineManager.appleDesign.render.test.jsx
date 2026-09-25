// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor, act, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Quarantine after the Apple design pass: an arm delay on the two permanent
 * deletes, buttons that say what they delete, files collapsed to five, and a
 * line saying a restore worked. The api module is mocked; nothing is deleted. */

const fetchQuarantineBatches = vi.fn();
const restoreQuarantineBatch = vi.fn(async () => ({ restored: true }));
const deleteQuarantineBatch = vi.fn(async () => ({ deleted: true }));
const emptyQuarantine = vi.fn(async () => ({ deletedCount: 2, freedBytes: 0 }));

vi.mock('../lib/api.js', () => ({
  fetchQuarantineBatches: (...a) => fetchQuarantineBatches(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  deleteQuarantineBatch: (...a) => deleteQuarantineBatch(...a),
  emptyQuarantine: (...a) => emptyQuarantine(...a),
  fetchSettings: vi.fn(async () => ({})), updateSettings: vi.fn()
}));

const QuarantineManager = (await import('./QuarantineManager.jsx')).default;

const file = (i) => ({ originalPath: `C:\\Temp\\file-${i}.tmp`, sizeBytes: 100 });
const batch = (programName, batchDir, fileCount = 1) => ({
  programName, batchDir, createdAt: Date.UTC(2026, 8, 1), totalSizeBytes: 1024,
  files: Array.from({ length: fileCount }, (_, i) => file(i + 1))
});
const payload = (batches) => ({
  batches, totalBytes: 1024 * batches.length, batchCount: batches.length,
  unknownSizeCount: 0, exact: true, maxBytes: null
});
const firstArg = (fn) => fn.mock.calls[0][0];

beforeEach(() => {
  vi.clearAllMocks();
  fetchQuarantineBatches.mockResolvedValue(payload([batch('Thing', 'C:\\q\\1-Thing')]));
});
afterEach(() => { vi.useRealTimers(); });

describe('the arm delay on a permanent delete', () => {
  it('ignores a click at 100 ms and accepts one at 600 ms', async () => {
    renderScreen(<QuarantineManager />);
    const ask = await screen.findByRole('button', { name: 'Delete permanently' });

    vi.useFakeTimers();
    fireEvent.click(ask);
    const confirm = screen.getByRole('button', { name: 'Delete batch' });
    expect(confirm.getAttribute('aria-disabled')).toBe('true');

    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(confirm);
    // Let a mutation that WAS started reach the api before asserting it was not.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(deleteQuarantineBatch).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(500); });
    expect(confirm.getAttribute('aria-disabled')).toBeNull();
    fireEvent.click(confirm);
    vi.useRealTimers();
    await waitFor(() => expect(deleteQuarantineBatch).toHaveBeenCalledTimes(1));
    expect(firstArg(deleteQuarantineBatch)).toBe('C:\\q\\1-Thing');
  });

  it('a double-click on Delete permanently cannot reach the confirm', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.dblClick(await screen.findByRole('button', { name: 'Delete permanently' }));
    expect(deleteQuarantineBatch).not.toHaveBeenCalled();
  });

  it('Empty Quarantine says how many it deletes, and has the same delay', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload([batch('One', 'C:\\q\\1'), batch('Two', 'C:\\q\\2')]));
    renderScreen(<QuarantineManager />);
    const ask = await screen.findByRole('button', { name: 'Empty Quarantine' });

    vi.useFakeTimers();
    fireEvent.click(ask);
    const confirm = screen.getByRole('button', { name: 'Delete all 2' });
    act(() => { vi.advanceTimersByTime(100); });
    fireEvent.click(confirm);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(emptyQuarantine).not.toHaveBeenCalled();

    act(() => { vi.advanceTimersByTime(500); });
    fireEvent.click(confirm);
    vi.useRealTimers();
    await waitFor(() => expect(emptyQuarantine).toHaveBeenCalledTimes(1));
  });

  it('moving the confirm to another batch restarts the clock', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload([batch('One', 'C:\\q\\1'), batch('Two', 'C:\\q\\2')]));
    renderScreen(<QuarantineManager />);
    const asks = await screen.findAllByRole('button', { name: 'Delete permanently' });

    vi.useFakeTimers();
    fireEvent.click(asks[0]);
    act(() => { vi.advanceTimersByTime(600); });
    fireEvent.click(screen.getAllByRole('button', { name: 'Delete permanently' })[0]); // the other batch's
    const confirm = screen.getByRole('button', { name: 'Delete batch' });
    fireEvent.click(confirm);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(deleteQuarantineBatch).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});

describe('files per batch', () => {
  it('shows five, then all on request, and folds back', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload([batch('Big', 'C:\\q\\big', 12)]));
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await screen.findByText('Big');

    expect(screen.getAllByText(/file-\d+\.tmp/)).toHaveLength(5);
    const more = screen.getByRole('button', { name: 'Show all 12 files' });
    expect(more.getAttribute('aria-expanded')).toBe('false');
    await user.click(more);
    expect(screen.getAllByText(/file-\d+\.tmp/)).toHaveLength(12);
    await user.click(screen.getByRole('button', { name: 'Show fewer files' }));
    expect(screen.getAllByText(/file-\d+\.tmp/)).toHaveLength(5);
  });

  it('offers no toggle for five or fewer', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload([batch('Small', 'C:\\q\\s', 5)]));
    renderScreen(<QuarantineManager />);
    await screen.findByText('Small');
    expect(screen.queryByRole('button', { name: /Show all/ })).toBeNull();
    expect(screen.getAllByText(/file-\d+\.tmp/)).toHaveLength(5);
  });
});

describe('restore feedback', () => {
  it('says what was restored', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    const line = await screen.findByRole('status');
    expect(line.textContent).toBe('Restored Thing.');
  });

  it('says nothing when the restore failed, and shows the error instead', async () => {
    restoreQuarantineBatch.mockRejectedValueOnce(new Error('EPERM'));
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Restore' }));
    expect(await screen.findByText('EPERM')).toBeTruthy();
    expect(screen.queryByText(/^Restored/)).toBeNull();
  });
});
