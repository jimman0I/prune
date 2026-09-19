// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The batch uninstall dialog's own copy follows the chosen language --
 * including the LeftoverReview screen it embeds in its 'review' phase. */

const streamUninstall = vi.fn();
const removeStoreApp = vi.fn();
const scanForLeftovers = vi.fn();
const appendHistoryEntry = vi.fn(async () => {});
const removeQuarantined = vi.fn();
const fetchSettings = vi.fn();

vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  removeStoreApp: (...a) => removeStoreApp(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  scanForcedUninstall: vi.fn(),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn()
}));

const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

const programs = [
  { id: 'a', name: 'Thing One', publisher: 'Acme', sizeBytes: 1024 },
  { id: 'b', name: 'Thing Two', publisher: 'Acme', sizeBytes: 2048 }
];

const found = { files: { ok: true, items: [{ path: 'C:\\Thing', sizeBytes: 512 }] }, registryKeys: { ok: true, items: [] } };

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  removeStoreApp.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512 });
  fetchSettings.mockResolvedValue({ language: 'el' });
});

/** Same Greek-anchor pattern as every other language test file: the
 * dialog's own title renders unconditionally once settings resolve, and
 * proves the language settled before any synchronous read runs. */
const ready = () => screen.findByRole('heading', { name: /Απεγκατάσταση 2 προγραμμάτων/ });

const run = async () => {
  const onClose = vi.fn();
  const onFinished = vi.fn();
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={programs} onClose={onClose} onFinished={onFinished} />);
  await ready();
  await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
  await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
  // `programs` are both real, non-Store, and always succeed here, so the
  // readyToScan gate appears for this helper's callers -- except when a
  // caller has turned scanLeftoversAfterUninstall off first, which skips
  // the gate by design (nothing to scan means nothing to confirm), so this
  // tolerates either outcome the same way BatchUninstallModal.settings.test.jsx's
  // own run() helper does.
  const scanButton = await screen.findByRole('button', { name: 'Σάρωση για κατάλοιπα' }).catch(() => null);
  if (scanButton) await user.click(scanButton);
  return { user, onClose, onFinished };
};

describe('the batch uninstall dialog, in Greek', () => {
  it('translates the title, close button and the mixed intro (no Store apps)', async () => {
    renderScreen(<BatchUninstallModal programs={programs} onClose={vi.fn()} onFinished={vi.fn()} />);
    await ready();
    expect(screen.getByRole('button', { name: 'Κλείσιμο' })).toBeTruthy();
    expect(screen.getByText(/Ο δικός του απεγκαταστάτης κάθε προγράμματος εκτελείται με τη σειρά/)).toBeTruthy();
    expect(screen.queryByText(/Οι εφαρμογές Store αφαιρούνται μέσω των Windows αντ' αυτού/)).toBeNull();
    expect(screen.getByText(/Ένα τη φορά, επειδή τα Windows επιτρέπουν μόνο μία εγκατάσταση/)).toBeTruthy();
  });

  it('translates the registry-only intro when the batch is entirely Store apps', async () => {
    renderScreen(<BatchUninstallModal programs={[{ id: 's', name: 'Store Thing', source: 'store', sizeBytes: 100 }]} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 1 προγραμμάτων/ });
    expect(screen.getByText(/Κάθε εφαρμογή αφαιρείται μέσω των Windows με τη σειρά/)).toBeTruthy();
  });

  it('translates the Store-app addendum inside the mixed intro when the batch has both kinds', async () => {
    renderScreen(<BatchUninstallModal programs={[...programs, { id: 's', name: 'Store Thing', source: 'store', sizeBytes: 100 }]} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 3 προγραμμάτων/ });
    expect(screen.getByText(/Οι εφαρμογές Store αφαιρούνται μέσω των Windows αντ' αυτού/)).toBeTruthy();
  });

  it('translates the singular Store-app warning', async () => {
    renderScreen(<BatchUninstallModal programs={[...programs, { id: 's', name: 'Store Thing', source: 'store', sizeBytes: 100 }]} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 3 προγραμμάτων/ });
    expect(screen.getByText(/Η εφαρμογή Store σε αυτήν την παρτίδα δεν μπορεί να επαναφερθεί από την Καραντίνα/)).toBeTruthy();
  });

  it('translates the plural Store-app warning', async () => {
    renderScreen(<BatchUninstallModal programs={[{ id: 's1', name: 'A', source: 'store', sizeBytes: 1 }, { id: 's2', name: 'B', source: 'store', sizeBytes: 1 }]} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 2 προγραμμάτων/ });
    expect(screen.getByText(/Οι 2 εφαρμογές Store σε αυτήν την παρτίδα δεν μπορούν να επαναφερθούν από την Καραντίνα/)).toBeTruthy();
  });

  it('translates the reported size, unknown-size suffix and start button', async () => {
    const unknownSize = [...programs, { id: 'c', name: 'Thing Three', publisher: 'Acme' }];
    renderScreen(<BatchUninstallModal programs={unknownSize} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 3 προγραμμάτων/ });
    expect(screen.getByText(/αναφέρθηκαν/)).toBeTruthy();
    expect(screen.getByText(/με άγνωστο μέγεθος/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' })).toBeTruthy();
  });

  it('translates the "runs before" note for a dependent program', async () => {
    // Marvel Rivals' own uninstall command is steam.exe, so it must run
    // before Steam -- the one relationship batchOrder.js actually detects.
    const steam = { id: 'steam', name: 'Steam', publisher: 'Valve', sizeBytes: 1024, uninstallString: 'C:\\Steam\\uninstall.exe' };
    const marvel = { id: 'mr', name: 'Marvel Rivals', publisher: 'NetEase Games', sizeBytes: 2048, uninstallString: '"C:\\Steam\\steam.exe" steam://uninstall/2767030' };
    renderScreen(<BatchUninstallModal programs={[steam, marvel]} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 2 προγραμμάτων/ });
    expect(screen.getByText(/εκτελείται πριν από το Steam/)).toBeTruthy();
  });

  it('translates the readyToScan gate: body and Scan button, and the scanning-phase line', async () => {
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={vi.fn()} onFinished={vi.fn()} />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));

    expect(screen.getByText(/εκκινητές παιχνιδιών/)).toBeTruthy();
    // A resolved mock would let the scan finish inside the same act() the
    // click already awaits, and the scanning-phase line would never be
    // observable -- held open deliberately, the same way this file's own
    // sibling in UninstallModal.language.render.test.jsx holds its
    // scanning-phase assertion open.
    let resolveScan;
    scanForLeftovers.mockReturnValue(new Promise((resolve) => { resolveScan = resolve; }));
    const scanButton = screen.getByRole('button', { name: 'Σάρωση για κατάλοιπα' });
    await user.click(scanButton);
    expect(await screen.findByText('Σάρωση καταλοίπων…')).toBeTruthy();
    resolveScan(found);
  });

  it('translates the running-phase status labels and the removing-phase line', async () => {
    let resolveFirst;
    streamUninstall.mockImplementation(() => new Promise((resolve) => { resolveFirst = resolve; }));
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={vi.fn()} onFinished={vi.fn()} />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    expect(await screen.findByText('απεγκατάσταση…')).toBeTruthy();
    expect(screen.getByText('αναμονή', { exact: false })).toBeTruthy();
    resolveFirst();
  });

  it('translates the "removed" and "failed" status labels once the queue moves past the first two programs', async () => {
    // p1 resolves immediately (done), p2 rejects immediately (failed), p3
    // never resolves -- pinning the queue mid-run with both labels visible
    // at once alongside p3's still-"waiting" status.
    const three = [...programs, { id: 'c', name: 'Thing Three', publisher: 'Acme', sizeBytes: 4096 }];
    streamUninstall
      .mockImplementationOnce(async () => {})
      .mockImplementationOnce(async () => { throw new Error('boom'); })
      .mockImplementationOnce(() => new Promise(() => {}));
    renderScreen(<BatchUninstallModal programs={three} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 3 προγραμμάτων/ });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    expect(await screen.findByText('αφαιρέθηκε')).toBeTruthy();
    expect(await screen.findByText('απέτυχε')).toBeTruthy();
  });

  it('translates the removing-phase line for each destination', async () => {
    let resolveRemoval;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Μεταφορά καταλοίπων στην Καραντίνα…')).toBeTruthy();
    resolveRemoval({ destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512 });
  });

  it('translates the removing-phase line for the recycle bin', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'recycle' });
    let resolveRemoval;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Αποστολή καταλοίπων στον Κάδο Ανακύκλωσης…')).toBeTruthy();
    resolveRemoval({ destination: 'recycle', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512 });
  });

  it('translates the removing-phase line for permanent deletion', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'permanent' });
    let resolveRemoval;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Οριστική διαγραφή' }));
    expect(await screen.findByText('Οριστική διαγραφή καταλοίπων…')).toBeTruthy();
    resolveRemoval({ destination: 'permanent', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512 });
  });

  it('translates the review-phase success banner and the embedded LeftoverReview screen', async () => {
    await run();
    expect(await screen.findByText('Απεγκαταστάθηκαν 2 από 2.')).toBeTruthy();
    expect(screen.getByText('Αρχεία & φάκελοι')).toBeTruthy();
  });

  it('translates the failed-programs section on the review phase', async () => {
    streamUninstall.mockRejectedValueOnce(new Error('boom'));
    await run();
    expect(await screen.findByText(/Αποτυχία απεγκατάστασης 1 και παρέμεινε ανέγγιχτο:/)).toBeTruthy();
  });

  it('translates a leftover-removal failure inside the review phase', async () => {
    removeQuarantined.mockRejectedValue(new Error('boom'));
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Αδυναμία αφαίρεσης καταλοίπων: boom')).toBeTruthy();
  });

  it('translates the settings-off no-scan message and its Done button', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', scanLeftoversAfterUninstall: false });
    await run();
    expect(await screen.findByText(/Η σάρωση καταλοίπων είναι απενεργοποιημένη στις Ρυθμίσεις/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Τέλος' })).toBeTruthy();
  });

  it('translates the Store-app no-scan message', async () => {
    const storeOnly = [{ id: 's1', name: 'A', source: 'store', sizeBytes: 1 }, { id: 's2', name: 'B', source: 'store', sizeBytes: 1 }];
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={storeOnly} onClose={vi.fn()} onFinished={vi.fn()} />);
    await screen.findByRole('heading', { name: /Απεγκατάσταση 2 προγραμμάτων/ });
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    await waitFor(() => expect(removeStoreApp).toHaveBeenCalledTimes(2));
    expect(await screen.findByText(/Δεν υπάρχει σάρωση καταλοίπων μετά από μια εφαρμογή Store/)).toBeTruthy();
  });

  it('translates the done-phase quarantine summary, restore-point note and Done button', async () => {
    removeQuarantined.mockResolvedValue({
      destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512,
      restorePoint: { created: false, reason: 'System Protection is off' }
    });
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText(/Απεγκαταστάθηκαν 2 πρόγραμμ.*μεταφέρθηκαν.*στην Καραντίνα, ελευθερώνοντας/)).toBeTruthy();
    expect(screen.getByText(/Δεν δημιουργήθηκε σημείο επαναφοράς συστήματος \(System Protection is off\)/)).toBeTruthy();
    expect(screen.getByText(/Όλα τα παραπάνω παραμένουν στην Καραντίνα/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Τέλος' })).toBeTruthy();
  });

  it('translates the restore-point fallback reason when none is given', async () => {
    removeQuarantined.mockResolvedValue({
      destination: 'quarantine', files: [], registryKeys: [], totalSizeBytes: 0,
      restorePoint: { created: false, reason: '' }
    });
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText(/\(μη διαθέσιμο\)/)).toBeTruthy();
  });

  it('translates the failed-registry-keys section on the done phase', async () => {
    removeQuarantined.mockResolvedValue({
      destination: 'quarantine', files: [], registryKeys: [], totalSizeBytes: 0,
      failedRegistryKeys: ['HKLM\\Software\\Thing']
    });
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText(/Αποτυχία αφαίρεσης 1 κλειδιού μητρώου.*αυτά συνήθως απαιτούν το Prune να εκτελείται ως διαχειριστής/)).toBeTruthy();
  });

  it('translates the recycle-bin done summary', async () => {
    removeQuarantined.mockResolvedValue({ destination: 'recycle', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512 });
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText(/στάλθηκαν.*στον Κάδο Ανακύκλωσης/)).toBeTruthy();
  });

  it('translates the permanent-deletion done summary', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({ destination: 'permanent', files: [{ originalPath: 'x', sizeBytes: 512 }], registryKeys: [], totalSizeBytes: 512 });
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Οριστική διαγραφή' }));
    expect(await screen.findByText(/διαγράφηκαν οριστικά/)).toBeTruthy();
  });

  it('translates the history label sent with the removal request', async () => {
    const { user } = await run();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    await waitFor(() => expect(removeQuarantined).toHaveBeenCalledTimes(1));
    expect(removeQuarantined.mock.calls[0][0].programName).toBe('Ομαδική απεγκατάσταση: 2 προγράμματα');
  });
});
