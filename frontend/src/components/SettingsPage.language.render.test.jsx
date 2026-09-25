// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Settings screen's own copy follows the chosen language -- covering
 * both SettingsPage.jsx (General/Uninstall/Cleanup/About tabs, including
 * the exclusions list and the Sandbox Test panel) and AutomationSettings,
 * which SettingsPage mounts directly inside its Cleanup tab. */

const updateSettings = vi.fn();
const fetchSettings = vi.fn();
const fetchUpdateCheck = vi.fn();
const openUpdatePage = vi.fn(async () => ({ ok: true }));
const fetchAutomation = vi.fn(async () => ({ enabled: false, nextRun: null }));
const runSandboxTest = vi.fn();

vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchUpdateCheck: (...a) => fetchUpdateCheck(...a),
  openUpdatePage: (...a) => openUpdatePage(...a),
  fetchAutomation: (...a) => fetchAutomation(...a),
  runSandboxTest: (...a) => runSandboxTest(...a),
  fetchStartupItems: vi.fn(), fetchStartupIcons: vi.fn(), setStartupItemEnabled: vi.fn(),
  fetchQuarantineBatches: vi.fn(), restoreQuarantineBatch: vi.fn(),
  deleteQuarantineBatch: vi.fn(), emptyQuarantine: vi.fn(),
  fetchDiskSpace: vi.fn(), fetchDiskHealth: vi.fn()
}));

const SettingsPage = (await import('./SettingsPage.jsx')).default;

const DEFAULTS = {
  language: 'el',
  excludeFolders: [],
  excludeExtensions: [],
  autoQuarantine: true,
  theme: 'dark',
  minimizeToTray: true,
  skipRecentHours: 24,
  createRestorePoint: true,
  hideUnavailableRules: false,
  quarantineRetentionDays: null,
  quarantineMaxSizeGb: null,
  updateCheck: false,
  automation: { enabled: false, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
};

/** Tracks the settings object across a save the way the real backend does:
 * `updateSettings`'s real implementation (lib/api.js) returns the full,
 * merged settings row, not the bare partial the request sent. A naive
 * `vi.fn(async (partial) => partial)` mock -- as SettingsPage.render.test.jsx
 * (English) uses -- lets `onSuccess`'s `setQueryData(keys.settings, updated)`
 * silently strip every OTHER key, `language` included, off the cached
 * settings object once any save happens. Invisible in English (English is
 * also the fallback), but it would flip the whole rendered page back to
 * English mid-test here. */
let currentSettings;
const setSettings = (overrides) => {
  currentSettings = { ...DEFAULTS, ...overrides };
  fetchSettings.mockResolvedValue(currentSettings);
};

beforeEach(() => {
  vi.clearAllMocks();
  setSettings({});
  updateSettings.mockImplementation(async (partial) => {
    currentSettings = { ...currentSettings, ...partial };
    return currentSettings;
  });
  fetchUpdateCheck.mockResolvedValue({ enabled: false, current: '2.3.4' });
  fetchAutomation.mockResolvedValue({ enabled: false, nextRun: null });
});

/** `settings.language` resolves through the same async query every other
 * persisted setting does, so the very first render is always English. The
 * title renders unconditionally, so waiting for its Greek text is what
 * actually proves the language settled before any synchronous read. */
const ready = () => screen.findByRole('heading', { name: 'Ρυθμίσεις' });

const openTab = async (label) => {
  const user = userEvent.setup();
  renderScreen(<SettingsPage />);
  await ready();
  await user.click(screen.getByRole('tab', { name: label }));
  return user;
};

describe('the settings screen, in Greek', () => {
  it('translates the title and all four tab labels', async () => {
    renderScreen(<SettingsPage />);
    await ready();
    expect(screen.getByRole('tab', { name: 'Γενικά' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Απεγκατάσταση' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Καθαρισμός' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Σχετικά' })).toBeTruthy();
  });

  // `settings.loading` has no test here, and cannot: SettingsPage's own
  // `loading` flag comes from the exact same useSettings() query that
  // LanguageContext itself reads `language` from. While that query is
  // still pending, LanguageContext has no settled language either, so it
  // renders under its English fallback -- structurally, "loading" can
  // never appear on screen in anything but English. Documented here and
  // excluded, by name, in mutate-settings-i18n.py's own module docstring.

  // `settings.loadError` has no test here: SettingsPage.jsx's own `error`
  // local is a hardcoded `null` (never set from a fetchSettings failure),
  // so that branch is permanently unreachable dead code, not something
  // this i18n pass introduced. Documented here and excluded, by name, in
  // mutate-settings-i18n.py's own module docstring.

  it('translates the Appearance card', async () => {
    renderScreen(<SettingsPage />);
    await ready();
    expect(screen.getByText('Εμφάνιση')).toBeTruthy();
    expect(screen.getByText('Επιλέξτε Ανοιχτό ή Σκούρο, ή αφήστε το Σύστημα να ακολουθεί τα Windows.')).toBeTruthy();
    // The System / Light / Dark control, translated.
    expect(screen.getByRole('button', { name: 'Σύστημα' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Ανοιχτό' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Σκούρο' })).toBeTruthy();
  });

  it('translates Minimize to Tray, both the heading and the switch name', async () => {
    renderScreen(<SettingsPage />);
    await ready();
    expect(screen.getByText('Ελαχιστοποίηση στη γραμμή συστήματος')).toBeTruthy();
    expect(await screen.findByRole('switch', { name: 'Ελαχιστοποίηση στη γραμμή συστήματος' })).toBeTruthy();
    expect(screen.getByText(/στη γραμμή συστήματος αντί να τερματίζεται/)).toBeTruthy();
  });

  it('translates Check for updates: heading, switch name and description', async () => {
    renderScreen(<SettingsPage />);
    await ready();
    expect(screen.getByText('Έλεγχος για ενημερώσεις')).toBeTruthy();
    expect(await screen.findByRole('switch', { name: 'Έλεγχος για ενημερώσεις' })).toBeTruthy();
    expect(screen.getByText(/api\.github\.com/)).toBeTruthy();
    expect(screen.getByText(/τίποτα δεν πραγματοποιεί λήψη ή εγκατάσταση/)).toBeTruthy();
  });

  it('translates Install updates automatically: heading, switch name and description', async () => {
    setSettings({ updateCheck: true });
    renderScreen(<SettingsPage />);
    await ready();
    expect(screen.getByText('Αυτόματη εγκατάσταση ενημερώσεων')).toBeTruthy();
    expect(await screen.findByRole('switch', { name: 'Αυτόματη εγκατάσταση ενημερώσεων' })).toBeTruthy();
    expect(screen.getByText(/Απαιτεί τον παραπάνω έλεγχο ενημερώσεων/)).toBeTruthy();
  });

  it('translates the "checking" update status', async () => {
    setSettings({ updateCheck: true });
    fetchUpdateCheck.mockImplementation(() => new Promise(() => {}));
    renderScreen(<SettingsPage />);
    await ready();
    expect(await screen.findByText('Έλεγχος…')).toBeTruthy();
  });

  it('translates a newer-available update status, with the version interpolated', async () => {
    setSettings({ updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.3.4', latest: '2.3.5', newer: true, url: 'x' });
    renderScreen(<SettingsPage />);
    await ready();
    expect(await screen.findByText('Το Prune 2.3.5 είναι διαθέσιμο.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Άνοιγμα σελίδας λήψης' })).toBeTruthy();
  });

  it('translates the up-to-date update status, with the current version interpolated', async () => {
    setSettings({ updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.3.4', latest: '2.3.4', newer: false, url: 'x' });
    renderScreen(<SettingsPage />);
    await ready();
    expect(await screen.findByText('Έχετε την πιο πρόσφατη έκδοση (2.3.4).')).toBeTruthy();
  });

  it('translates a failed update check, with the raw error interpolated', async () => {
    setSettings({ updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.3.4', error: 'boom' });
    renderScreen(<SettingsPage />);
    await ready();
    expect(await screen.findByText('Αδυναμία ελέγχου για ενημερώσεις: boom')).toBeTruthy();
  });

  it('translates the open-page error', async () => {
    openUpdatePage.mockRejectedValue(new Error('nope'));
    setSettings({ updateCheck: true });
    fetchUpdateCheck.mockResolvedValue({ enabled: true, current: '2.3.4', latest: '2.3.5', newer: true, url: 'x' });
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await ready();
    await user.click(await screen.findByRole('button', { name: 'Άνοιγμα σελίδας λήψης' }));
    expect(await screen.findByText('Αδυναμία ανοίγματος σελίδας: nope')).toBeTruthy();
  });

  it('translates Show free space on the Disk Map, switch name and description', async () => {
    renderScreen(<SettingsPage />);
    await ready();
    expect(await screen.findByRole('switch', { name: 'Εμφάνιση ελεύθερου χώρου στον Χάρτη Δίσκου' })).toBeTruthy();
    expect(screen.getByText(/κάθε φάκελος να διαβάζεται ως μερίδιο του δίσκου/)).toBeTruthy();
  });

  it('translates the save-error message, with the raw error interpolated', async () => {
    updateSettings.mockRejectedValue(new Error('disk full'));
    const user = userEvent.setup();
    renderScreen(<SettingsPage />);
    await user.click(await screen.findByRole('switch', { name: 'Εμφάνιση ελεύθερου χώρου στον Χάρτη Δίσκου' }));
    expect(await screen.findByText('Αδυναμία αποθήκευσης: disk full')).toBeTruthy();
  });

  describe('the Cleanup tab', () => {
    it('translates Auto-Quarantine, heading, switch name and description', async () => {
      const user = await openTab('Καθαρισμός');
      expect(screen.getByText('Αυτόματη Καραντίνα')).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Αυτόματη Καραντίνα' })).toBeTruthy();
      expect(screen.getByText(/Ο Βαθύς Καθαρισμός μετακινεί/)).toBeTruthy();
      void user;
    });

    it('translates the recent-files guard, description, hours unit and aria label', async () => {
      await openTab('Καθαρισμός');
      expect(screen.getByText('Αφήστε ήσυχα τα πρόσφατα αρχεία')).toBeTruthy();
      expect(screen.getByText(/Παραλείπει οτιδήποτε τροποποιήθηκε/)).toBeTruthy();
      expect(screen.getByLabelText('Ώρες για να αφήσετε ήσυχα τα πρόσφατα αρχεία')).toBeTruthy();
      expect(screen.getByText('ώρες')).toBeTruthy();
    });

    it('groups the Cleanup tab under Greek Deep Clean and Quarantine headings', async () => {
      await openTab('Καθαρισμός');
      expect(screen.getByRole('heading', { name: 'Βαθύς καθαρισμός' })).toBeTruthy();
      expect(screen.getByRole('heading', { name: 'Καραντίνα' })).toBeTruthy();
    });
  });

  describe('the restore-point guard, which moved to the Uninstall tab', () => {
    it('translates the restore-point guard, heading and description', async () => {
      await openTab('Απεγκατάσταση');
      expect(screen.getByText('Δημιουργία σημείου επαναφοράς πρώτα')).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Δημιουργία σημείου επαναφοράς πρώτα' })).toBeTruthy();
      expect(screen.getByText(/Πριν από μια εξαναγκασμένη αφαίρεση/)).toBeTruthy();
    });
  });

  describe('more of the Cleanup tab', () => {
    it('translates the hide-unavailable guard, heading and description', async () => {
      await openTab('Καθαρισμός');
      expect(screen.getByText('Απόκρυψη καθαριστών που δεν ισχύουν')).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Απόκρυψη καθαριστών που δεν ισχύουν' })).toBeTruthy();
      expect(screen.getByText(/Το μεγαλύτερο μέρος της λίστας/)).toBeTruthy();
    });

    it('translates the retention-days field, description, placeholder, unit and aria label', async () => {
      await openTab('Καθαρισμός');
      const input = screen.getByLabelText('Ημέρες διατήρησης αντιγράφων ασφαλείας καραντίνας');
      expect(input.placeholder).toBe('Ποτέ');
      expect(screen.getByText('Χρόνος διατήρησης στοιχείων Καραντίνας')).toBeTruthy();
      expect(screen.getByText(/Οτιδήποτε αφαιρεί το Prune πηγαίνει πρώτα/)).toBeTruthy();
      expect(screen.getByText('ημέρες')).toBeTruthy();
    });

    it('translates the max-size field, heading, description, placeholder and aria label', async () => {
      await openTab('Καθαρισμός');
      const input = screen.getByLabelText('Μέγιστο μέγεθος καραντίνας σε gigabyte');
      expect(input.placeholder).toBe('Χωρίς όριο');
      expect(screen.getByText('Όριο μεγέθους Καραντίνας')).toBeTruthy();
      expect(screen.getByText(/Ένα όριο για ολόκληρο τον φάκελο Καραντίνας/)).toBeTruthy();
      // gbUnit's Greek translation is literally "GB", identical to the
      // English fallback -- rendering it correctly and rendering the
      // untranslated English literal are indistinguishable on screen, so
      // this one key can never be caught by a rendered-text mutation test.
      // Documented here and excluded, by name, in mutate-settings-i18n.py.
      expect(screen.getByText('GB')).toBeTruthy();
    });

    it('translates the exclusions panel entirely', async () => {
      const user = await openTab('Καθαρισμός');
      expect(screen.getByText('Εξαίρεση φακέλων')).toBeTruthy();
      expect(screen.getByText(/Φάκελοι και τύποι αρχείων που το Prune θα αφήσει ήσυχους/)).toBeTruthy();
      expect(screen.getByText('Μια πλήρης διαδρομή φακέλου, ή ένας τύπος αρχείου γραμμένος ως *.iso')).toBeTruthy();
      expect(screen.getByText('Τίποτα δεν εξαιρείται.')).toBeTruthy();

      const input = screen.getByLabelText('Διαδρομή φακέλου ή τύπος αρχείου προς εξαίρεση');
      await user.type(input, 'notavalidvalue');
      await user.click(screen.getByRole('button', { name: 'Προσθήκη' }));
      expect(screen.getByText(/Γράψτε μια πλήρη διαδρομή φακέλου/)).toBeTruthy();

      await user.clear(input);
      await user.type(input, '*.iso');
      await user.click(screen.getByRole('button', { name: 'Προσθήκη' }));

      // classifyExclusion normalizes "*.iso" to the stored value ".iso".
      expect(await screen.findByText('Τύπος')).toBeTruthy();
      expect(screen.getByText('.iso')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Διακοπή εξαίρεσης του .iso' })).toBeTruthy();
    });

    it('translates a folder exclusion badge as Φάκελος, not Τύπος', async () => {
      setSettings({ excludeFolders: ['D:\\Games'] });
      await openTab('Καθαρισμός');
      expect(await screen.findByText('Φάκελος')).toBeTruthy();
    });

    it('translates the Sandbox Test panel, including the Running… state', async () => {
      let resolveTest;
      runSandboxTest.mockReturnValue(new Promise((resolve) => { resolveTest = resolve; }));
      const user = await openTab('Καθαρισμός');
      expect(screen.getByText('Δοκιμή sandbox')).toBeTruthy();
      expect(screen.getByText(/Εκτελεί την πραγματική μηχανή καθαρισμού/)).toBeTruthy();
      await user.click(screen.getByRole('button', { name: 'Εκτέλεση δοκιμής sandbox' }));
      expect(await screen.findByRole('button', { name: 'Εκτελείται…' })).toBeTruthy();
      resolveTest({ passed: true, steps: [] });
      expect(await screen.findByText('Όλοι οι έλεγχοι πέρασαν')).toBeTruthy();
    });

    it('translates a failed Sandbox Test result', async () => {
      runSandboxTest.mockResolvedValue({ passed: false, steps: [], error: 'boom' });
      const user = await openTab('Καθαρισμός');
      await user.click(screen.getByRole('button', { name: 'Εκτέλεση δοκιμής sandbox' }));
      expect(await screen.findByText('Η δοκιμή sandbox απέτυχε')).toBeTruthy();
    });

    it('translates the warning-confirmations heading, default copy and the reset button', async () => {
      await openTab('Καθαρισμός');
      expect(await screen.findByText('Επιβεβαιώσεις προειδοποίησης')).toBeTruthy();
      expect(screen.getByText('Κάθε καθαριστής που χάνει δεδομένα ρωτά πριν εκτελεστεί.')).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Επαναφορά επιβεβαιώσεων προειδοποίησης' })).toBeTruthy();
    });

    it('translates and pluralizes the acknowledged-count copy', async () => {
      setSettings({ acknowledgedCleanWarnings: ['a', 'b'] });
      await openTab('Καθαρισμός');
      expect(await screen.findByText(/2 προειδοποιήσ.*ρυθμισμένες/)).toBeTruthy();
    });

    it('translates AutomationSettings: title, description, Off state', async () => {
      await openTab('Καθαρισμός');
      expect(await screen.findByText('Αυτοματισμός')).toBeTruthy();
      expect(screen.getByText(/Δεν μπορεί να ξυπνήσει ένα μηχάνημα σε αδράνεια/)).toBeTruthy();
      expect(screen.getByText('Ανενεργό')).toBeTruthy();
    });

    it('translates AutomationSettings when enabled: Scheduled, field labels, weekday names', async () => {
      setSettings({
        automation: { enabled: true, frequency: 'weekly', weekday: 2, hour: 3, minute: 30, task: 'scan' }
      });
      await openTab('Καθαρισμός');
      expect(await screen.findByText('Προγραμματισμένο')).toBeTruthy();
      expect(screen.getByText('Πόσο συχνά')).toBeTruthy();
      expect(screen.getByText('Ημέρα')).toBeTruthy();
      expect(screen.getByText('Στις')).toBeTruthy();
      expect(screen.getByText('Τι κάνει')).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Κάθε εβδομάδα' }).selected).toBe(true);
      expect(screen.getByRole('option', { name: 'Τρίτη' }).selected).toBe(true);
      expect(screen.getByRole('option', { name: 'Μόνο μέτρηση' }).selected).toBe(true);
    });

    it('translates the daily frequency option', async () => {
      setSettings({
        automation: { enabled: true, frequency: 'daily', hour: 2, minute: 0, task: 'scan' }
      });
      await openTab('Καθαρισμός');
      expect((await screen.findByRole('option', { name: 'Κάθε μέρα' })).selected).toBe(true);
    });

    it('translates the clean-warning banner, only when the task is set to clean', async () => {
      setSettings({
        automation: { enabled: true, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'clean' }
      });
      await openTab('Καθαρισμός');
      expect(await screen.findByText(/Αυτό αφαιρεί αρχεία χωρίς κανέναν να παρακολουθεί/)).toBeTruthy();
      expect(screen.getByRole('option', { name: 'Καθαρισμός' }).selected).toBe(true);
    });

    it('translates Next run / Last run labels', async () => {
      fetchAutomation.mockResolvedValue({
        enabled: true,
        nextRun: Date.UTC(2026, 0, 1),
        lastResult: { at: Date.UTC(2025, 11, 25), ok: true, summary: '3 items' }
      });
      setSettings({
        automation: { enabled: true, frequency: 'weekly', weekday: 0, hour: 2, minute: 0, task: 'scan' }
      });
      await openTab('Καθαρισμός');
      expect(await screen.findByText('Επόμενη εκτέλεση:')).toBeTruthy();
      // Exact-string match fails here, not because the label is untranslated
      // but because this <p>'s direct text-node children (what getByText
      // concatenates by default) also include the trailing "— 3 items"
      // segment once a lastResult is present -- a regex sidesteps that.
      expect(screen.getByText(/Τελευταία εκτέλεση:/)).toBeTruthy();
    });
  });

  describe('the Uninstall tab', () => {
    it('translates the before/after headings and every guard', async () => {
      await openTab('Απεγκατάσταση');
      expect(screen.getByText('Πριν την απεγκατάσταση')).toBeTruthy();
      expect(screen.getByText('Μετά την απεγκατάσταση')).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Δημιουργία σημείου επαναφοράς πριν την απεγκατάσταση' })).toBeTruthy();
      expect(screen.getByText(/Η δική τους Επαναφορά Συστήματος των Windows/)).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Δημιουργία αντιγράφου ασφαλείας μητρώου πριν την απεγκατάσταση' })).toBeTruthy();
      expect(screen.getByText(/Εξάγει τα HKLM\\SOFTWARE/)).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Σάρωση για κατάλοιπα μετά την απεγκατάσταση' })).toBeTruthy();
      expect(screen.getByText(/Αναζητά τα αρχεία, τα κλειδιά μητρώου/)).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Επιλογή κάθε καταλοίπου από προεπιλογή' })).toBeTruthy();
      expect(screen.getByText(/Η επισκόπηση ανοίγει με όλα όσα βρέθηκαν/)).toBeTruthy();
      expect(screen.getByRole('switch', { name: 'Διατήρηση ιστορικού απεγκαταστάσεων' })).toBeTruthy();
      expect(screen.getByText(/Η λίστα του πίνακα ελέγχου με τις πρόσφατες αφαιρέσεις/)).toBeTruthy();
    });

    it('translates the leftover-destination heading and all three options', async () => {
      await openTab('Απεγκατάσταση');
      expect(screen.getByText('Τα κατάλοιπα αρχεία πηγαίνουν στο')).toBeTruthy();
      expect(screen.getByRole('radio', { name: /Καραντίνα/ })).toBeTruthy();
      expect(screen.getByRole('radio', { name: /Ο Κάδος Ανακύκλωσης/ })).toBeTruthy();
      expect(screen.getByRole('radio', { name: /Οριστική διαγραφή/ })).toBeTruthy();
      expect(screen.getByText(/Τα κλειδιά μητρώου εξάγονται στην Καραντίνα/)).toBeTruthy();
    });

    it('translates the permanent-delete warning, shown only once selected', async () => {
      const user = await openTab('Απεγκατάσταση');
      expect(screen.queryByText(/δεν μπορούν να επαναφερθούν/)).toBeNull();
      await user.click(screen.getByRole('radio', { name: /Οριστική διαγραφή/ }));
      expect(await screen.findByText(/δεν μπορούν να επαναφερθούν/)).toBeTruthy();
    });
  });

  describe('the About tab', () => {
    it('translates the description', async () => {
      await openTab('Σχετικά');
      expect(await screen.findByText(/εργαλείο απεγκατάστασης και καθαρισμού για Windows/)).toBeTruthy();
    });
  });
});
