// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { CATALOG } from '../i18n/catalog.js';

/** The Dashboard's own copy follows the chosen language -- the property
 * Dashboard.render.test.jsx cannot show, since English is also the
 * fallback its assertions render under. Windows' own strings (the drive
 * model, healthStatus) are checked to stay AS Windows wrote them.
 *
 * Every t() call this screen makes gets its own assertion here: the goal is
 * that swapping any one of them for its English literal -- invisible to
 * Dashboard.render.test.jsx, since English is also what that file defaults
 * to -- fails a test in THIS file.
 *
 * Strings that predate the redesign are pinned as Greek literals, copied
 * verbatim from catalog.js's `el` block. The redesign's own strings are read
 * from CATALOG.el rather than pinned, so the translation pass that follows
 * them does not have to touch this file: they hold whatever the catalog says,
 * and fail if the component stops going through t(). */

const fetchDiskSpace = vi.fn();
const fetchDiskHealth = vi.fn();
const unlockDiskWear = vi.fn();
const fetchUninstallHistory = vi.fn(async () => []);
const fetchAutomation = vi.fn(async () => ({ enabled: false, nextRun: null, missed: 0 }));
const streamDeepCleanScan = vi.fn(() => new Promise(() => {}));

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({ language: 'el' })),
  updateSettings: vi.fn(),
  fetchDiskSpace: (...a) => fetchDiskSpace(...a),
  fetchDiskHealth: (...a) => fetchDiskHealth(...a),
  unlockDiskWear: (...a) => unlockDiskWear(...a),
  fetchUninstallHistory: (...a) => fetchUninstallHistory(...a),
  fetchAutomation: (...a) => fetchAutomation(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
}));

const Dashboard = (await import('./Dashboard.jsx')).default;

const GB = 1024 ** 3;
const D = () => CATALOG.el.dashboard;

beforeEach(() => {
  vi.clearAllMocks();
  fetchDiskSpace.mockResolvedValue(null);
  fetchDiskHealth.mockResolvedValue({ disks: [] });
  streamDeepCleanScan.mockImplementation(() => new Promise(() => {}));
});

const render = (programs = [], props = {}) => renderScreen(
  <Dashboard programs={programs} programsMeasured onNavigate={() => {}} {...props} />
);
// Drive details is a translated button; its name is read from the catalog.
const openDetails = async (user) => user.click(await screen.findByRole('button', { name: D().quiet.driveDetails }));

describe('the Dashboard in another language', () => {
  it('translates the title, the drive-health title and Recent Activity while empty', async () => {
    render();

    expect(await screen.findByRole('heading', { name: 'Πίνακας ελέγχου' })).toBeTruthy();
    expect(screen.getByText('Υγεία δίσκου')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Πρόσφατη δραστηριότητα' })).toBeTruthy();
    // A chevron and aria-expanded now say hide/show; the words are gone.
    expect(screen.queryByText('Απόκρυψη')).toBeNull();
    expect(screen.getByText('Καμία απεγκατάσταση ακόμη.')).toBeTruthy();
    // The old stat cards and the Deep Clean pill are gone in every language.
    expect(screen.queryByText('Συνολικός αποθηκευτικός χώρος')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Βαθύς καθαρισμός' })).toBeNull();
  });

  it('collapses Recent Activity, reporting the state through aria-expanded', async () => {
    const user = userEvent.setup();
    render();
    const toggle = await screen.findByRole('button', { name: /Πρόσφατη δραστηριότητα/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('true');

    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Καμία απεγκατάσταση ακόμη.')).toBeNull();
  });

  it('shows the translated loading state, then the question, the summary line and the bar label', async () => {
    let resolveDiskSpace;
    fetchDiskSpace.mockImplementation(() => new Promise((r) => { resolveDiskSpace = r; }));
    render([{ id: 'a', name: 'A', sizeBytes: 100 * GB }]);

    expect(await screen.findByRole('img', { name: D().space.loading })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: D().space.heading })).toBeTruthy();
    expect(screen.getByText(D().space.drive('C'))).toBeTruthy();
    resolveDiskSpace({ freeBytes: 100 * GB, totalBytes: 500 * GB });

    expect(await screen.findByText(D().space.summary('400 GB', '500 GB', '100 GB'))).toBeTruthy();
    expect(screen.getByRole('img', { name: D().space.barLabel('100 GB', '300 GB', '100 GB') })).toBeTruthy();
    for (const label of [D().space.legendPrograms, D().space.legendOther, D().space.legendFree]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
  });

  it('translates the measuring state: the used legend, the placeholder and the bar label', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 500 * GB });
    render([{ id: 'a', name: 'A', sizeBytes: 100 * GB }], { programsMeasured: false });
    expect(await screen.findByRole('img', { name: D().space.barLabelMeasuring('400 GB', '100 GB') })).toBeTruthy();
    expect(screen.getByText(D().space.legendUsed)).toBeTruthy();
    expect(screen.getByText(`${D().space.legendPrograms}:`)).toBeTruthy();
    expect(screen.getAllByText(D().measuring).length).toBeGreaterThan(0);
    expect(screen.getByText(D().largest.measuring)).toBeTruthy();
  });

  it('translates the unsized note and the exceeds-used note', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 500 * GB });
    render([{ id: 'a', name: 'A', sizeBytes: 450 * GB }, { id: 'b', name: 'B' }]);
    expect(await screen.findByText(D().space.unsized(1))).toBeTruthy();
    expect(screen.getByText(D().space.exceedsUsed)).toBeTruthy();
  });

  it('translates Largest programs: heading, link, count, remainder sentence and Disk Map link', async () => {
    fetchDiskSpace.mockResolvedValue({ freeBytes: 100 * GB, totalBytes: 500 * GB });
    render([{ id: 'a', name: 'Alpha', sizeBytes: 100 * GB }]);
    expect(await screen.findByRole('heading', { name: D().largest.heading })).toBeTruthy();
    expect(screen.getByRole('button', { name: D().largest.openApplications })).toBeTruthy();
    expect(screen.getByText(D().largest.installedCount(1))).toBeTruthy();
    const sentence = D().largest.notInList('300 GB');
    expect(screen.getByText((content) => content.includes(sentence))).toBeTruthy();
    expect(screen.getByRole('button', { name: D().largest.seeDiskMap })).toBeTruthy();
  });

  it('translates the empty Largest programs state', async () => {
    render([{ id: 'a', name: 'Ext' }]);
    expect(await screen.findByText(D().largest.none)).toBeTruthy();
  });

  it('shows the reason disk space could not be read, in place of the translated loading word', async () => {
    fetchDiskSpace.mockRejectedValue(new Error('E_DISKSPACE'));
    render();
    // Retried once (useDiskSpace sets retry: 1) before it reaches the screen.
    expect(await screen.findByText('E_DISKSPACE', {}, { timeout: 5000 })).toBeTruthy();
  });

  it('says how many programs a failed uninstall left behind, and offers a translated Review button', async () => {
    render([{ id: 'a', health: { orphaned: true } }]);
    expect(await screen.findByText(D().quiet.leftTitle)).toBeTruthy();
    expect(screen.getByText(D().quiet.leftCount(1))).toBeTruthy();
    expect(screen.getByRole('button', { name: D().quiet.leftReview })).toBeTruthy();
  });

  it('says nothing is left behind, with no Review button, when nothing is', async () => {
    render([{ id: 'a', health: {} }]);
    expect(await screen.findByText(D().quiet.leftNone)).toBeTruthy();
    expect(screen.queryByRole('button', { name: D().quiet.leftReview })).toBeNull();
  });

  it('translates the junk item: not measured, Measure, progress, total, basis and Open Deep Clean', async () => {
    const user = userEvent.setup();
    let emit;
    let finish;
    streamDeepCleanScan.mockImplementation((onEvent) => new Promise((resolve) => { emit = onEvent; finish = resolve; }));
    render();
    expect(await screen.findByText(D().quiet.junkTitle)).toBeTruthy();
    expect(screen.getByText(D().quiet.junkNotMeasured)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: D().quiet.junkMeasure }));
    expect(screen.getByText(D().quiet.junkMeasuring)).toBeTruthy();
    act(() => {
      emit('start', { total: 3 });
      emit('rule', { id: 'a', recommended: true, present: true, accessible: true, sizeBytes: GB });
    });
    expect(screen.getByText(D().quiet.junkProgress(1, 3))).toBeTruthy();
    await act(async () => { finish(); });
    expect(await screen.findByText(D().quiet.junkBasis(1))).toBeTruthy();
    expect(screen.getByRole('button', { name: D().quiet.openDeepClean })).toBeTruthy();
  });

  it('translates the junk measuring failure', async () => {
    const user = userEvent.setup();
    streamDeepCleanScan.mockRejectedValueOnce(new Error('E_SCAN'));
    render();
    await user.click(await screen.findByRole('button', { name: D().quiet.junkMeasure }));
    expect(await screen.findByText(D().quiet.junkError('E_SCAN'))).toBeTruthy();
  });

  it('translates the score line and the Drive details button', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', lifeRemainingPercent: 80 }]
    });
    render();
    expect(await screen.findByText(D().quiet.scoreOf(80))).toBeTruthy();
    expect(screen.getByRole('button', { name: D().quiet.driveDetails })).toBeTruthy();
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

  it('translates the life-remaining line in the summary, and the powered-on-hours line in the details', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', lifeRemainingPercent: 80, powerOnHours: 1200 }]
    });
    render();
    expect(await screen.findByText(/Απομένει 80% της διάρκειας ζωής/)).toBeTruthy();
    await openDetails(user);
    expect(screen.getByText(/1,200 ώρες σε λειτουργία|1\.200 ώρες σε λειτουργία/)).toBeTruthy();
  });

  it('leaves the drive\'s own reported status untranslated inside the translated sentence, and translates the admin-access note beside it', async () => {
    // healthStatus is Windows' own word, not Prune's copy -- it must
    // appear exactly as reported, even mid-sentence in Greek.
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: 'Warning', lifeRemainingPercent: null }]
    });
    render();

    // The summary line carries the sentence; the details repeat it with the
    // admin-access note, so it is asserted once there.
    expect(await screen.findByText(/Windows.*Warning/)).toBeTruthy();
    await openDetails(user);
    expect(screen.getByText(/Η φθορά, η θερμοκρασία και οι ώρες λειτουργίας απαιτούν πρόσβαση διαχειριστή/)).toBeTruthy();
  });

  it('falls back to translated "unknown" copy -- in the score slot, and inside the sentence -- when Windows reports no status at all', async () => {
    fetchDiskHealth.mockResolvedValue({
      disks: [{ deviceId: '0', model: 'Test NVMe', healthStatus: null, lifeRemainingPercent: null }]
    });
    render();
    expect(await screen.findByText('Άγνωστο')).toBeTruthy();
    // The inline fallback inside the "Windows reports..." sentence -- a
    // different catalog key from the score slot's, and must stay so.
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
    await openDetails(user);

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
    await openDetails(user);

    const button = await screen.findByRole('button', { name: 'Ανάγνωση φθοράς δίσκου (διαχειριστής)' });
    await user.click(button);
    expect(await screen.findByText('Αυτός ο δίσκος δεν αναφέρει δεδομένα φθοράς, ούτε καν ως διαχειριστής.')).toBeTruthy();
  });

  it('translates the uncorrected-errors line', async () => {
    const user = userEvent.setup();
    fetchDiskHealth.mockResolvedValue({
      disks: [{
        deviceId: '0', model: 'Test NVMe', healthStatus: 'Healthy', lifeRemainingPercent: 80,
        readErrorsUncorrected: 2, writeErrorsUncorrected: 1
      }]
    });
    render();
    await openDetails(user);
    expect(await screen.findByText('2 μη διορθωμένα σφάλματα ανάγνωσης · 1 μη διορθωμένα σφάλματα εγγραφής')).toBeTruthy();
  });

  it('translates the SMART header and every attribute row label', async () => {
    const user = userEvent.setup();
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
    await openDetails(user);
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
