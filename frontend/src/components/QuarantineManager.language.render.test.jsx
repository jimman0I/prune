// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Quarantine screen's own copy follows the chosen language -- the
 * property no English-only test can show, since English is also the
 * fallback those tests render under.
 *
 * `exact` is `false` exactly when `unknownSizeCount > 0` (see
 * useSystemQueries.js's useQuarantine()), which collapses what would
 * otherwise be an 8-way combination (exact × limit × unmeasured) down to
 * two independent axes: whether a size limit is set, and whether any
 * batch carries an unmeasured size. QuarantineManager.jsx picks between
 * `quarantine.summary.phrase` and `.withLimit` on the first axis and
 * passes `atLeast` (the boolean, not a separate sentence) for the second,
 * so only two catalog functions carry the header line's grammar instead
 * of four or eight sentence variants. */

const fetchQuarantineBatches = vi.fn();
const restoreQuarantineBatch = vi.fn(async () => ({ restored: true }));
const deleteQuarantineBatch = vi.fn(async () => ({ deleted: true }));
const emptyQuarantine = vi.fn(async () => ({ deletedCount: 2, freedBytes: 0 }));

vi.mock('../lib/api.js', () => ({
  fetchQuarantineBatches: (...a) => fetchQuarantineBatches(...a),
  restoreQuarantineBatch: (...a) => restoreQuarantineBatch(...a),
  deleteQuarantineBatch: (...a) => deleteQuarantineBatch(...a),
  emptyQuarantine: (...a) => emptyQuarantine(...a),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchSettings: vi.fn(async () => ({ language: 'el' })), updateSettings: vi.fn(),
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

const headerText = () => document.querySelector('h1 + p')?.textContent ?? '';
const firstArg = (mock) => mock.mock.calls[0]?.[0];

/** `settings.language` resolves through the same async query every other
 * persisted setting does, so the very first render is always English --
 * and "Thing" is a program name, not translated text, so waiting on it
 * alone proves nothing about which language actually rendered. The title
 * renders unconditionally (even during loading), so waiting for its Greek
 * text is what actually proves the language settled before a synchronous
 * headerText() read runs. */
const ready = () => screen.findByRole('heading', { name: 'Καραντίνα' });

describe('the quarantine screen, in Greek', () => {
  it('translates the title', async () => {
    renderScreen(<QuarantineManager />);
    expect(await screen.findByRole('heading', { name: 'Καραντίνα' })).toBeTruthy();
  });

  it('translates the loading text', async () => {
    // Never resolves -- the loading branch is what is under test.
    fetchQuarantineBatches.mockImplementation(() => new Promise(() => {}));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText('Φόρτωση καραντίνας…')).toBeTruthy();
  });

  it('translates the load-error message, with the raw error interpolated', async () => {
    fetchQuarantineBatches.mockRejectedValue(new Error('EACCES'));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText(/Αδυναμία φόρτωσης καραντίνας: EACCES/)).toBeTruthy();
  });

  it('translates the summary phrase and pluralizes the batch count', async () => {
    renderScreen(<QuarantineManager />);
    await ready();
    await screen.findByText('Thing');
    expect(headerText()).toContain('παρτίδα');
    expect(headerText()).toContain('σε κράτηση');
  });

  it('translates the with-limit phrase, and omits it when no limit is set', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload({ maxBytes: 5 * GIB }));
    renderScreen(<QuarantineManager />);
    await ready();
    await screen.findByText('Thing');
    expect(headerText()).toContain('από 5 GB');
  });

  it('says nothing about a limit, in Greek, when none is set', async () => {
    renderScreen(<QuarantineManager />);
    await ready();
    await screen.findByText('Thing');
    expect(headerText()).not.toContain('από');
  });

  it('translates "at least" and the unmeasured-count suffix', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload({ unknownSizeCount: 2, exact: false }));
    renderScreen(<QuarantineManager />);
    await ready();
    await screen.findByText('Thing');
    expect(headerText()).toContain('τουλάχιστον');
    expect(headerText()).toContain('2 χωρίς μέτρηση');
  });

  it('translates the over-cap warning', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload({ totalBytes: 60 * GIB, maxBytes: 5 * GIB }));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText(/Υπερβαίνει το όριο των 5 GB/)).toBeTruthy();
    expect(screen.getByText(/αντίγραφο ασφαλείας δεν αφαιρείται ποτέ/)).toBeTruthy();
  });

  it('translates the empty state and disables the translated Empty button', async () => {
    fetchQuarantineBatches.mockResolvedValue(payload({ batches: [], batchCount: 0, totalBytes: 0 }));
    renderScreen(<QuarantineManager />);
    expect(await screen.findByText('Τίποτα στην καραντίνα.')).toBeTruthy();
    expect(screen.getByText(/καταλήγει πρώτα εδώ/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Άδειασμα Καραντίνας' }).disabled).toBe(true);
  });

  it('gates a permanent delete behind the translated confirm prompt, and Cancel backs out', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Οριστική Διαγραφή' }));

    expect(deleteQuarantineBatch).not.toHaveBeenCalled();
    expect(screen.getByText('Οριστική διαγραφή;')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Ακύρωση' }));
    expect(deleteQuarantineBatch).not.toHaveBeenCalled();
    expect(screen.queryByText('Οριστική διαγραφή;')).toBeNull();
    expect(screen.getByRole('button', { name: 'Επαναφορά' })).toBeTruthy();
  });

  it('deletes only on the translated Confirm, sending the batch directory', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Οριστική Διαγραφή' }));
        await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    await user.click(screen.getByRole('button', { name: 'Διαγραφή παρτίδας' }));

    await waitFor(() => expect(deleteQuarantineBatch).toHaveBeenCalledTimes(1));
    expect(firstArg(deleteQuarantineBatch)).toBe('C:\\q\\1-Thing');
  });

  it('shows the translated Deleting… state while the delete is in flight', async () => {
    let resolveDelete;
    deleteQuarantineBatch.mockReturnValue(new Promise((resolve) => { resolveDelete = resolve; }));
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Οριστική Διαγραφή' }));
        await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    await user.click(screen.getByRole('button', { name: 'Διαγραφή παρτίδας' }));

    expect(await screen.findByRole('button', { name: 'Διαγραφή…' })).toBeTruthy();
    resolveDelete({ deleted: true });
  });

  it('gates Empty Quarantine the same way, with its own translated prompt', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Άδειασμα Καραντίνας' }));

    expect(emptyQuarantine).not.toHaveBeenCalled();
    expect(screen.getByText('Οριστική διαγραφή κάθε παρτίδας;')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Ακύρωση' }));
    expect(emptyQuarantine).not.toHaveBeenCalled();
  });

  it('shows the translated Emptying… state while the purge is in flight', async () => {
    let resolveEmpty;
    emptyQuarantine.mockReturnValue(new Promise((resolve) => { resolveEmpty = resolve; }));
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Άδειασμα Καραντίνας' }));
        await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    await user.click(screen.getByRole('button', { name: 'Διαγραφή όλων (1)' }));

    expect(await screen.findByRole('button', { name: 'Άδειασμα…' })).toBeTruthy();
    resolveEmpty({ deletedCount: 1, freedBytes: 0 });
  });

  it('restores under the translated button, sending the batch directory, no confirmation needed', async () => {
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Επαναφορά' }));
    await waitFor(() => expect(restoreQuarantineBatch).toHaveBeenCalledTimes(1));
    expect(firstArg(restoreQuarantineBatch)).toBe('C:\\q\\1-Thing');
  });

  it('shows the translated Restoring… state while the restore is in flight', async () => {
    let resolveRestore;
    restoreQuarantineBatch.mockReturnValue(new Promise((resolve) => { resolveRestore = resolve; }));
    const user = userEvent.setup();
    renderScreen(<QuarantineManager />);
    await user.click(await screen.findByRole('button', { name: 'Επαναφορά' }));

    expect(await screen.findByRole('button', { name: 'Επαναφορά…' })).toBeTruthy();
    resolveRestore({ restored: true });
  });
});
