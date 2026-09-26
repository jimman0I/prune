// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The single-program uninstall dialog's own copy follows the chosen
 * language -- including the LeftoverReview screen it embeds in its
 * 'review' step, since that component reads useLanguage() itself. */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn();
const scanForcedUninstall = vi.fn();
const removeQuarantined = vi.fn();
const fetchSettings = vi.fn();

vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  scanForcedUninstall: (...a) => scanForcedUninstall(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(),
  appendHistoryEntry: vi.fn(async () => {})
}));

const UninstallModal = (await import('./UninstallModal.jsx')).default;

const program = { id: 'thing', name: 'Thing', publisher: 'Acme', uninstallString: '"C:\\Program Files\\Thing\\uninst.exe"' };
const found = {
  files: { ok: true, items: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', sizeBytes: 2048 }] },
  registryKeys: { ok: true, items: [{ path: 'HKCU\\Software\\Thing' }] },
  scheduledTasks: { ok: true, items: [] }
};

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockResolvedValue();
  scanForLeftovers.mockResolvedValue(found);
  removeQuarantined.mockResolvedValue({ destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048 });
  fetchSettings.mockResolvedValue({ language: 'el' });
});

/** `settings.language` resolves through the same async query every other
 * persisted setting does, so the very first render is always English. The
 * modal's own title renders unconditionally once settings resolve, so
 * waiting for it proves the language settled before any synchronous read. */
const ready = (name = 'Απεγκατάσταση Thing') => screen.findByRole('heading', { name });

const openAndUninstall = async () => {
  const onClose = vi.fn();
  const user = userEvent.setup();
  renderScreen(<UninstallModal program={program} onClose={onClose} />);
  await ready();
  await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
  return { user, onClose };
};

/** Same as openAndUninstall, but also clicks past the new manual
 * readyToScan step (translated Scan button) -- for the tests below that
 * exercise what happens once a leftover scan actually runs, not the
 * readyToScan gate itself. */
const openAndScan = async () => {
  const { user, onClose } = await openAndUninstall();
  await user.click(await screen.findByRole('button', { name: 'Σάρωση για κατάλοιπα' }));
  return { user, onClose };
};

describe('the uninstall dialog, in Greek', () => {
  it('translates the title and the Close button', async () => {
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    expect(await ready()).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Κλείσιμο' })).toBeTruthy();
  });

  it('translates the running warning', async () => {
    renderScreen(<UninstallModal program={program} running onClose={vi.fn()} />);
    await ready();
    expect(screen.getByText(/εκτελείται αυτή τη στιγμή/)).toBeTruthy();
  });

  it('translates the normal-flow intro, command fallback and start button', async () => {
    renderScreen(<UninstallModal program={{ ...program, uninstallString: '' }} onClose={vi.fn()} />);
    await ready();
    expect(screen.getByText(/Αυτό εκτελεί τον απεγκαταστάτη του Thing/)).toBeTruthy();
    expect(screen.getByText('Δεν έχει καταχωρηθεί εντολή απεγκατάστασης')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' })).toBeTruthy();
  });

  it('translates the broken-uninstaller flow: warning, intro, label, hint and search button', async () => {
    renderScreen(<UninstallModal program={{ ...program, health: { orphaned: true, reason: 'The registry entry has no working uninstaller.' } }} onClose={vi.fn()} />);
    await ready('Εξαναγκασμένη αφαίρεση Thing');
    expect(screen.getByText(/Τα Windows θα συνεχίσουν να το εμφανίζουν/)).toBeTruthy();
    expect(screen.getByText(/Το Prune θα αναζητήσει αρχεία και κλειδιά μητρώου/)).toBeTruthy();
    expect(screen.getByText('Αναζήτηση για')).toBeTruthy();
    expect(screen.getByText(/Λήφθηκε από "Thing" χωρίς την έκδοσή του/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Αναζήτηση καταλοίπων' })).toBeTruthy();
    // `uninstallModal.noWorkingUninstaller` has no assertion here: it's the
    // `command` value computed for `broken === true`, but the only place
    // `command` renders is the non-broken confirm view and the
    // 'uninstalling' ProgressPhase, which the broken flow's own button
    // (startForcedScan) never reaches -- pre-existing dead code, unrelated
    // to this i18n pass. Documented here and excluded, by name, in
    // mutate-uninstall-i18n.py's own module docstring.
  });

  it('translates a forced-scan failure', async () => {
    scanForcedUninstall.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={{ ...program, health: { orphaned: true, reason: 'x' } }} onClose={vi.fn()} />);
    await ready('Εξαναγκασμένη αφαίρεση Thing');
    await user.click(screen.getByRole('button', { name: 'Αναζήτηση καταλοίπων' }));
    expect(await screen.findByText('Η σάρωση απέτυχε: boom')).toBeTruthy();
  });

  it('translates a normal-flow uninstall failure', async () => {
    streamUninstall.mockRejectedValue(new Error('boom'));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    expect(await screen.findByText('Η απεγκατάσταση απέτυχε: boom')).toBeTruthy();
  });

  it('translates the uninstalling progress phase, including the restore-point sub-titles', async () => {
    let resolveStream;
    streamUninstall.mockImplementation((id, onEvent) => new Promise((resolve) => {
      onEvent('preUninstall', { step: 'registryBackup' });
      resolveStream = resolve;
    }));
    const user = userEvent.setup();
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    expect(await screen.findByText('Δημιουργία αντιγράφου ασφαλείας μητρώου')).toBeTruthy();
    resolveStream();
  });

  it('translates the default uninstalling title before any preUninstall step fires', async () => {
    let resolveStream;
    streamUninstall.mockImplementation(() => new Promise((resolve) => { resolveStream = resolve; }));
    const { } = await openAndUninstall();
    expect(await screen.findByText('Εκτέλεση εγγενούς απεγκαταστάτη')).toBeTruthy();
    resolveStream();
  });

  it('translates the removing phase for each destination', async () => {
    let resolveRemoval;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Μεταφορά στην Καραντίνα')).toBeTruthy();
    expect(screen.getByText('Τίποτα δεν διαγράφεται — κάθε στοιχείο μπορεί να επαναφερθεί')).toBeTruthy();
    resolveRemoval({ destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048 });
  });

  it('translates the removing phase for the recycle bin', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'recycle' });
    let resolveRemoval;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Αποστολή στον Κάδο Ανακύκλωσης')).toBeTruthy();
    expect(screen.getByText('Επαναφέρετέ τα από τον Κάδο Ανακύκλωσης αν χρειαστεί')).toBeTruthy();
    resolveRemoval({ destination: 'recycle', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: [], totalSizeBytes: 2048 });
  });

  it('translates the removing phase for permanent deletion', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'permanent' });
    let resolveRemoval;
    removeQuarantined.mockReturnValue(new Promise((resolve) => { resolveRemoval = resolve; }));
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Οριστική διαγραφή' }));
    expect(await screen.findByText('Οριστική διαγραφή')).toBeTruthy();
    expect(screen.getByText('Αυτά δεν μπορούν να επαναφερθούν')).toBeTruthy();
    resolveRemoval({ destination: 'permanent', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: [], totalSizeBytes: 2048 });
  });

  it('translates the readyToScan step: body copy and Scan button', async () => {
    const { user } = await openAndUninstall();
    expect(await screen.findByText(/Αν ο απεγκαταστάτης του Thing δεν έχει τελειώσει ακόμα/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Σάρωση για κατάλοιπα' })).toBeTruthy();
    expect(scanForLeftovers).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Σάρωση για κατάλοιπα' }));
    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
  });

  it('translates the scanning progress phase', async () => {
    let resolveScan;
    scanForLeftovers.mockReturnValue(new Promise((resolve) => { resolveScan = resolve; }));
    const { } = await openAndScan();
    expect(await screen.findByText('Σάρωση καταλοίπων')).toBeTruthy();
    expect(screen.getByText('Έλεγχος συστήματος αρχείων, μητρώου & προγραμματισμένων εργασιών…')).toBeTruthy();
    resolveScan(found);
  });

  it('translates the noScan step', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', scanLeftoversAfterUninstall: false });
    await openAndUninstall();
    expect(await screen.findByText(/Η σάρωση καταλοίπων είναι απενεργοποιημένη στις Ρυθμίσεις/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Τέλος' })).toBeTruthy();
  });

  it('translates the review step, including the embedded LeftoverReview screen', async () => {
    await openAndScan();
    expect(await screen.findByText(/Βρέθηκ.*στοιχεί.*απεγκαταστάτης/)).toBeTruthy();
    expect(screen.getByText('Αρχεία & φάκελοι')).toBeTruthy();
    expect(screen.getByText('Κλειδιά μητρώου')).toBeTruthy();
    expect(screen.getByText('Τα επιλεγμένα στοιχεία μεταφέρονται στην Καραντίνα, όπου μπορείτε να τα επαναφέρετε.')).toBeTruthy();
    expect(screen.getByText(/επιλεγμένα στοιχεία ·/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Παράλειψη' })).toBeTruthy();
  });

  it('translates every remaining LeftoverReview state: scheduled tasks, a failed group, an item note, exclusions and reclaimable size', async () => {
    scanForLeftovers.mockResolvedValue({
      files: { ok: true, items: [{ path: 'C:\\Thing', sizeBytes: 1024 }], excluded: 1 },
      registryKeys: {
        ok: true,
        items: [{ path: 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'ThingUpdater' }]
      },
      scheduledTasks: { ok: false, items: [] }
    });
    await openAndScan();
    await screen.findByText('Αρχεία & φάκελοι');
    // scheduledTasks reported ok: false -> the "couldn't check" line, in the
    // group's own translated, lower-cased label.
    expect(screen.getByText('Αδυναμία ελέγχου προγραμματισμένες εργασίες.')).toBeTruthy();
    // The registry value's item note.
    expect(screen.getByText(/Μόνο η τιμή "ThingUpdater"/)).toBeTruthy();
    // One folder held back by the user's exclusions.
    expect(screen.getByText(/1 φάκελος παραλείφθηκε επειδή βρίσκεται στις εξαιρέσεις σας\./)).toBeTruthy();
    // The reclaimable-size suffix, once at least one item is selected.
    expect(screen.getByText('ανακτήσιμο', { exact: false })).toBeTruthy();
  });

  it('translates the "not removed" badge on the scheduled-tasks group', async () => {
    scanForLeftovers.mockResolvedValue({
      files: { ok: true, items: [] },
      registryKeys: { ok: true, items: [] },
      scheduledTasks: { ok: true, items: [{ name: 'ThingUpdaterTask', path: '\\' }] }
    });
    await openAndScan();
    expect(await screen.findByText('βρέθηκε, δεν αφαιρέθηκε')).toBeTruthy();
    expect(screen.getByText('Προγραμματισμένες εργασίες')).toBeTruthy();
  });

  it('translates the clean, no-leftovers state', async () => {
    scanForLeftovers.mockResolvedValue({
      files: { ok: true, items: [] },
      registryKeys: { ok: true, items: [] },
      scheduledTasks: { ok: true, items: [] }
    });
    await openAndScan();
    expect(await screen.findByText('Δεν βρέθηκαν κατάλοιπα — καθαρή απεγκατάσταση.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Τέλος' })).toBeTruthy();
  });

  it('translates a removal failure inside the review step', async () => {
    removeQuarantined.mockRejectedValue(new Error('boom'));
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Η αφαίρεση απέτυχε: boom')).toBeTruthy();
  });

  it('translates the done step: quarantine summary, restore-point note and Done button', async () => {
    removeQuarantined.mockResolvedValue({
      destination: 'quarantine', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048,
      restorePoint: { created: false, reason: 'System Protection is off' }
    });
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText(/Μεταφέρθηκ.*στην Καραντίνα, ελευθερώνοντας/)).toBeTruthy();
    expect(screen.getByText(/Δεν δημιουργήθηκε σημείο επαναφοράς συστήματος \(System Protection is off\)/)).toBeTruthy();
    expect(screen.getByText(/Η επαναφορά από την Καραντίνα εξακολουθεί να λειτουργεί/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Τέλος' })).toBeTruthy();
  });

  it('translates the recycle-bin done summary', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'recycle' });
    removeQuarantined.mockResolvedValue({ destination: 'recycle', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048 });
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText(/Στάλθηκ.*στον Κάδο Ανακύκλωσης/)).toBeTruthy();
  });

  it('translates the permanent-deletion done summary', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({ destination: 'permanent', files: [{ originalPath: 'x', sizeBytes: 2048 }], registryKeys: ['k'], totalSizeBytes: 2048 });
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Οριστική διαγραφή' }));
    expect(await screen.findByText(/Διαγράφηκ.*οριστικά/)).toBeTruthy();
  });

  it('translates the failed-files section on the done step', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', leftoverDestination: 'permanent' });
    removeQuarantined.mockResolvedValue({
      destination: 'permanent', files: [], registryKeys: [], totalSizeBytes: 0,
      failedFiles: [{ path: 'C:\\Users\\jim\\AppData\\Roaming\\Thing', reason: 'The file is in use.' }]
    });
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Οριστική διαγραφή' }));
    expect(await screen.findByText('Αποτυχία αφαίρεσης 1 στοιχείου:')).toBeTruthy();
  });

  it('translates the failed-registry-keys section on the done step', async () => {
    removeQuarantined.mockResolvedValue({
      destination: 'quarantine', files: [], registryKeys: [], totalSizeBytes: 0,
      failedRegistryKeys: ['HKLM\\Software\\Thing']
    });
    const { user } = await openAndScan();
    await user.click(await screen.findByRole('button', { name: 'Αφαίρεση επιλεγμένων' }));
    expect(await screen.findByText('Αποτυχία αφαίρεσης 1 κλειδιού μητρώου')).toBeTruthy();
    expect(screen.getByText(/αυτά συνήθως απαιτούν το Prune να εκτελείται ως διαχειριστής/)).toBeTruthy();
  });

  it('translates the "automatically delete all found leftovers" checkbox label on the confirm step', async () => {
    renderScreen(<UninstallModal program={program} onClose={vi.fn()} />);
    await ready();
    expect(screen.getByRole('checkbox', {
      name: 'Αφαίρεση αυτόματα όλων των καταλοίπων που βρίσκει η σάρωση, χωρίς να τα ελέγξετε πρώτα'
    })).toBeTruthy();
  });
});
