// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Dashboard's own copy follows the chosen language -- the property
 * Dashboard.render.test.jsx cannot show, since English is also the
 * fallback its assertions render under. Windows' own strings (the drive
 * model, healthStatus) are checked to stay AS Windows wrote them.
 *
 * Every t() call this screen makes gets its own assertion here, copied
 * verbatim from catalog.js's `el` block: the goal is that swapping any
 * one of them for its English literal -- invisible to
 * Dashboard.render.test.jsx, since English is also what that file
 * defaults to -- fails a test in THIS file. */

const fetchDiskSpace = vi.fn();
const fetchDiskHealth = vi.fn();
const unlockDiskWear = vi.fn();
const fetchUninstallHistory = vi.fn(async () => []);
const fetchAutomation = vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 }));

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({ language: 'el' })),
  updateSettings: vi.fn(),
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskHealth: (...a) => fetchDiskHealth(...a),
  unlockDiskWear: (...a) => unlockDiskWear(...a),
  fetchUninstallHistory: (...a) => fetchUninstallHistory(...a),
  fetchAutomation: (...a) => fetchAutomation(...a),
}));

const Dashboard = (await import('./Dashboard.jsx')).default;

const GB = 1024 ** 3;

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue(null);
  fetchDiskHealth.mockResolvedValue({ disks: [] });
});

const render = (programs = []) => renderScreen(<Dashboard programs={programs} totalSize={0} onNavigate={() => {}} />);

describe('the Dashboard in another language', () => {
  it('translates the title, the three stat card labels, and Recent Activity while empty', async () => {
    render();

    expect(await screen.findByRole('heading', { name: 'Πίνακας ελέγχου' })).toBeTruthy();
    expect(screen.getByText('Υγεία Δίσκου')).toBeTruthy();
    expect(screen.getByText('Συνολικός Αποθηκευτικός Χώρος')).toBeTruthy();
    expect(screen.getByText('Εγκατεστημένες Εφαρμογές')).toBeTruthy();
    expect(screen.getByText('Άχρηστα Αρχεία')).toBeTruthy();
    expect(screen.getByText('δεν έχει μετρηθεί')).toBeTruthy();
    expect(screen.getByText('Η μέτρηση διατρέχει κάθε διαδρομή καθαρισμού στον δίσκο — περίπου μισό λεπτό.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Μέτρηση' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Πρόσφατη Δραστηριότητα' })).toBeTruthy();
    // A chevron and aria-expanded now say hide/show; the words are gone.
    expect(screen.queryByText('Απόκρυψη')).toBeNull();
    expect(screen.getByText('Καμία απεγκατάσταση ακόμη.')).toBeTruthy();
    // Navigation, so it reuses nav.* rather than keeping a second,
    // independently-translatable copy of the same word.
    expect(screen.getByRole('button', { name: 'Βαθύς καθαρισμός' })).toBeTruthy();
  });

  it('collapses Recent Activity, reporting the state through aria-expanded', async () => {
    const user = userEvent.setup();
    render();
    const toggle = await screen.findByRole('button', { name: /Πρόσφατη Δραστηριότητα/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Καμία απεγκατάσταση ακόμη.')).toBeNull();
  });

  it('shows the translated loading word, then the used/total and free lines', async () => {
    let resolveDiskSpace;
    fetchDiskSpace.mockImplementation(() => new Promise((r) => { resolveDiskSpace = r; }));
    render();

    expect(await screen.findByText('Φόρτωση…')).toBeTruthy();
    resolveDiskSpace({ freeBytes: 100 * GB, totalBytes: 500 * GB });

    expect(await screen.findByText('400 GB σε χρήση / 500 GB σύνολο')).toBeTruthy();
    expect(await screen.findByText('ελεύθερο')).toBeTruthy();
  });

  it('shows the reason disk space could not be read, in place of the translated loading word', async () => {
    fetchDiskSpace.mockRejectedValue(new Error('E_DISKSPACE'));
    render();
    // Retried once (useDiskSpace sets retry: 1) before it reaches the screen.
    expect(await screen.findByText('E_DISKSPACE', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('says a broken app count, and offers a translated Review button', async () => {
    render([{ id: 'a', health: { orphaned: true } }]);
    expect(await screen.findByText('1 απομεινάρια από αποτυχημένη απεγκατάσταση')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Έλεγχος' })).toBeTruthy();
  });

  it('says no broken apps, and offers a translated Manage button, when nothing is broken', async () => {
    render([{ id: 'a', health: {} }]);
    expect(await screen.findByText('Καμία κατεστραμμένη καταχώριση.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Διαχείριση' })).toBeTruthy();
  });

  it('names the reason drive health could not be read', async () => {
    fetchDiskHealth.mockRejectedValue(new Error('E_DRIVEHEALTH'));
    render();
    expect(await screen.findByText('Αδυναμία ανάγνωσης της υγείας του δίσκου: E_DRIVEHEALTH', {}, { timeout: 5000 }))
      .toBeTruthy();
  });

  it('says it is reading drive health before any disk has arrived', async () => {
    fetchDiskHealth.mockImplementation(() => new Promise(() => {}));
    render();
    expect(await screen.findByText('Ανάγνωση υγείας δίσκου…')).toBeTruthy();
  });

  it('translates the life-remaining and powered-on-hours line for a drive that reports one', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', lifeRemainingPercent: 80, powerOnHours: 1200 }]
    });
    render();
    expect(await screen.findByText(/80% διάρκειας ζωής απομένει/)).toBeTruthy();
    expect(screen.getByText(/1,200 ώρες σε λειτουργία|1\.200 ώρες σε λειτουργία/)).toBeTruthy();
  });

  it('leaves the drive\'s own reported status untranslated inside the translated sentence, and translates the admin-access note beside it', async () => {
    // healthStatus is Windows' own word, not Prune's copy -- it must
    // appear exactly as reported, even mid-sentence in Greek.
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Warning', lifeRemainingPercent: null }]
    });
    render();

    // Not a bare /Warning/: the gauge's own centre label separately shows
    // the same raw word, unrelated to the sentence this test is about.
    expect(await screen.findByText(/Windows.*Warning/)).toBeTruthy();
    expect(screen.getByText(/Η φθορά, η θερμοκρασία και οι ώρες λειτουργίας απαιτούν πρόσβαση διαχειριστή/)).toBeTruthy();
  });

  it('falls back to translated "unknown" copy -- in the gauge, and inside the sentence -- when Windows reports no status at all', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: null, lifeRemainingPercent: null }]
    });
    render();
    // An unknown status is a real answer, so the ring shows the neutral
    // score (75) rather than the word; the word lives in the sentence.
    expect(await screen.findByText('75')).toBeTruthy();
    // The inline fallback inside the "Windows reports..." sentence -- a
    // different catalog key from the gauge's, and must stay so.
    expect(screen.getByText(/άγνωστη κατάσταση/)).toBeTruthy();
  });

  it('shows the wear-unlock button, its waiting state, and the Not approved note when the prompt is cancelled', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: null }]
    });
    let resolveUnlock;
    unlockDiskWear.mockImplementation(() => new Promise((r) => { resolveUnlock = r; }));
    render();

    const button = await screen.findByRole('button', { name: 'Ανάγνωση φθοράς δίσκου (διαχειριστής)' });
    await user.click(button);
    expect(await screen.findByRole('button', { name: 'Αναμονή έγκρισης…' })).toBeTruthy();

    resolveUnlock({ cancelled: true });
    expect(await screen.findByText('Δεν εγκρίθηκε — εξακολουθεί να εμφανίζει ό,τι αναφέρουν τα Windows.')).toBeTruthy();
  });

  it('shows the No-wear-data note when the drive supports no wear counters even as administrator', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: null }]
    });
    unlockDiskWear.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: null }],
      reliabilityAvailable: false
    });
    render();

    const button = await screen.findByRole('button', { name: 'Ανάγνωση φθοράς δίσκου (διαχειριστής)' });
    await user.click(button);
    expect(await screen.findByText('Αυτός ο δίσκος δεν αναφέρει δεδομένα φθοράς, ούτε καν ως διαχειριστής.')).toBeTruthy();
  });

  it('translates the uncorrected-errors line', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: 80,
        readErrorsUncorrected: 2, writeErrorsUncorrected: 1
      }]
    });
    render();
    expect(await screen.findByText('2 μη διορθωμένα σφάλματα ανάγνωσης · 1 μη διορθωμένα σφάλματα εγγραφής')).toBeTruthy();
  });

  it('translates the SMART header and every attribute row label', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: 80,
        smart: {
          powerOnHours: 10, powerCycles: 5, bytesWritten: 1e12, bytesRead: 2e12,
          availableSparePercent: 99, unsafeShutdowns: 0, mediaErrors: 0, errorLogEntries: 0
        }
      }]
    });
    render();
    expect(await screen.findByText('Όπως αναφέρεται από τον δίσκο')).toBeTruthy();
    for (const label of [
      'Ώρες λειτουργίας', 'Κύκλοι ενεργοποίησης', 'Δεδομένα που γράφτηκαν', 'Δεδομένα που διαβάστηκαν',
      'Εφεδρικά μπλοκ', 'Μη ασφαλείς τερματισμοί', 'Σφάλματα μέσου', 'Καταχωρίσεις αρχείου σφαλμάτων'
    ]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('translates the schedule badge for a due run', async () => {
    fetchAutomation.mockResolvedValue({ automation: { enabled: true }, due: true, missed: 0 });
    render();
    expect(await screen.findByText('Μια προγραμματισμένη εκτέλεση εκκρεμεί')).toBeTruthy();
  });

  it('pluralises the schedule badge\'s missed-run count', async () => {
    fetchAutomation.mockResolvedValue({ automation: { enabled: true }, due: false, missed: 3 });
    render();
    expect(await screen.findByText('3 προγραμματισμένες εκτελέσεις χάθηκαν όσο αυτός ο υπολογιστής ήταν κλειστός'))
      .toBeTruthy();
  });

  it('translates Recent Activity\'s "freed" suffix on a real entry', async () => {
    fetchUninstallHistory.mockResolvedValue([{ timestamp: 1, programName: 'Thing', sizeBytes: 1024 }]);
    render();
    expect(await screen.findByText('1 KB ελευθερώθηκαν')).toBeTruthy();
  });
});
