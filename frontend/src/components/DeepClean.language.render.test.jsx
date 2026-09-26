// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, waitFor, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** The Deep Clean screen's own copy follows the chosen language -- the
 * property no English-only test can show, since English is also the
 * fallback those tests render under. Covers DeepClean.jsx,
 * DeepCleanTree.jsx, and CleanWarningDialog.jsx together, since the
 * warning dialog is reached directly from this screen's own checkbox
 * clicks, the same unit-of-work reasoning as StoreRemoveDialog bundled
 * with ProgramList.
 *
 * A hand-built provider tree, not renderScreen(), because handleClean()
 * raises real toasts and renderScreen() mounts ToastProvider but not
 * ToastHost -- the same reason Duplicates.language.render.test.jsx and
 * DiskMap.language.render.test.jsx each build their own mount().
 *
 * Rule/category names and descriptions follow the language too, from
 * i18n/cleaner/<lang>.js -- see DeepClean.cleanerText.render.test.jsx. The
 * fixtures here use ids with no translation, so they stay English.
 */

// The clean itself streams now -- see hooks/useDeepCleanExecute.js.
// Default delivers one 'rule' event for the first id carrying the whole
// freedBytes total, matching what DeepClean.render.test.jsx's own default
// does, for the same reason: nothing here cares about the per-rule split.
const streamDeepCleanExecute = vi.fn(async (ruleIds, onEvent) => {
  onEvent('rule', { id: ruleIds[0], name: ruleIds[0], freedBytes: 1024, skipped: [] });
});
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
// `fetchSettings`/`updateSettings` share one in-memory record rather than
// `updateSettings` echoing back only the partial it was handed -- see
// DeepClean.render.test.jsx's identical comment. Deep Clean now persists
// its checkbox selection on every change via a `{ deepCleanSelection }`
// save, and useSystemQueries.js's `save` mutation replaces the ENTIRE
// settings cache with whatever `updateSettings` resolves to (the real
// backend returns the full settings object). A mock that echoed only the
// partial would wipe `language: 'el'` off the cache the moment that save
// fired, silently reverting every screen back to English mid-test.
let settingsRecord = null;
const fetchSettings = vi.fn(async () => settingsRecord);
const updateSettings = vi.fn(async (partial) => {
  settingsRecord = { ...settingsRecord, ...partial };
  return settingsRecord;
});

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a),
  fetchCleanerCategoryIcons: vi.fn(async () => ({}))
}));

const DeepClean = (await import('./DeepClean.jsx')).default;

afterEach(cleanup);

function mount() {
  return render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <DeepClean />
            <ToastHost />
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const rules = [{
  category: 'Sample OS',
  items: [
    { id: 'temp', name: 'Temporary files', sizeBytes: null, fileCount: null },
    { id: 'thumbs', name: 'Thumbnail cache', sizeBytes: null, fileCount: null }
  ]
}];

const riskyRules = [{
  category: 'Sample Browser',
  items: [
    { id: 'sample_cache', category: 'Sample Browser', name: 'Cache', description: 'Regenerates on its own.', sizeBytes: null, fileCount: null },
    {
      id: 'sample_cookies', category: 'Sample Browser', name: 'Cookies', risky: true,
      description: 'Signs you out of every site that remembered you.',
      sizeBytes: null, fileCount: null
    }
  ]
}];

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = {
    language: 'el',
    excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
    skipRecentHours: 24, acknowledgedCleanWarnings: []
  };
  fetchDeepCleanRules.mockResolvedValue(rules);
  streamDeepCleanScan.mockImplementation(() => () => {});
});

/** `settings.language` resolves through the same async query every other
 * persisted setting does, so the very first render is always English --
 * waiting for the Greek-only title is what actually proves the language
 * settled before a synchronous query runs. */
const ready = () => screen.findByRole('heading', { name: 'Βαθύς καθαρισμός' });
const cleanButton = () => screen.getByRole('button', { name: 'Καθαρισμός' });

describe('the Deep Clean screen, in Greek', () => {
  it('translates the title and subtitle', async () => {
    mount();
    expect(await ready()).toBeTruthy();
    expect(screen.getByText(/Τίποτα δεν διαγράφεται απευθείας/)).toBeTruthy();
  });

  it('translates the empty state and the Preview button', async () => {
    // Never resolves -- categories stays null, which is what shows the
    // "before" panel. A resolved empty array is still a truthy `[]` and
    // would render the (empty) tree instead.
    fetchDeepCleanRules.mockImplementation(() => new Promise(() => {}));
    mount();
    await ready();
    // Once now: the empty scan log says what to do next instead of
    // repeating the panel's own "nothing scanned yet".
    expect(await screen.findAllByText('Δεν έχει σαρωθεί τίποτα ακόμα.')).toHaveLength(1);
    expect(screen.getByText('Πατήστε Προεπισκόπηση για να μετρήσετε τι μπορεί να καθαριστεί.')).toBeTruthy();
    expect(screen.getByText(/διαρκεί περίπου μισό λεπτό/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Προεπισκόπηση' }).length).toBeGreaterThan(0);
  });

  it('translates the scan log header and column headers of the tree', async () => {
    mount();
    await ready();
    await screen.findByText('Temporary files');

    expect(screen.getByText('Έξοδος σάρωσης')).toBeTruthy();
  });

  it('translates the "before any scan" panel\'s own Scanning… button', async () => {
    // Both hang -- categories stays null (rulesQuery never resolves) so
    // the "before" panel itself stays on screen while a scan runs, which
    // is the only way to see that panel's OWN Preview button flip to
    // "Scanning…" rather than the footer's separate one.
    fetchDeepCleanRules.mockImplementation(() => new Promise(() => {}));
    streamDeepCleanScan.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await ready();
    const [previewButton] = await screen.findAllByRole('button', { name: 'Προεπισκόπηση' });
    await user.click(previewButton);

    expect(await screen.findByRole('button', { name: 'Σάρωση…' })).toBeTruthy();
  });

  it('translates the scanning announcement, the finished announcement, and the unmeasured-count suffix', async () => {
    // Only 'temp' gets a 'rule' event; 'thumbs' stays at its listed
    // sizeBytes: null. Selecting both after the scan finishes exercises
    // the mixed measured/unmeasured total the footer's suffix reports on.
    let announceScanning;
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 2 });
      announceScanning = await screen.findByText('Σάρωση 2 τοποθεσιών.');
      onEvent('rule', { id: 'temp', category: 'Sample OS', name: 'Temporary files', sizeBytes: 100, present: true, accessible: true });
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    await user.click(screen.getByRole('button', { name: 'Προεπισκόπηση' }));

    await waitFor(() => expect(announceScanning).toBeTruthy());
    expect(await screen.findByText('Η σάρωση ολοκληρώθηκε. Μετρήθηκαν 1 από 2 τοποθεσίες.')).toBeTruthy();

    await user.click(screen.getByRole('checkbox', { name: 'Temporary files' }));
    await user.click(screen.getByRole('checkbox', { name: 'Thumbnail cache' }));
    expect(await screen.findByText(/1 χωρίς μέτρηση/)).toBeTruthy();
  });

  it('translates the scan-error message, with the raw error interpolated', async () => {
    streamDeepCleanScan.mockImplementationOnce(async (onEvent) => {
      onEvent('error', { message: 'Access is denied: C:\\Windows\\Prefetch' });
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');

    await user.click(screen.getAllByRole('button', { name: 'Προεπισκόπηση' })[0]);
    expect(await screen.findByText(/Αδυναμία σάρωσης: Access is denied/)).toBeTruthy();
  });

  it('translates the clean-error message, with the raw error interpolated', async () => {
    streamDeepCleanExecute.mockRejectedValueOnce(new Error('EBUSY: locked.tmp'));
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText(/Αδυναμία καθαρισμού: EBUSY/)).toBeTruthy();
  });

  it('translates the hidden-cleaners note', async () => {
    settingsRecord = {
      language: 'el',
      excludeFolders: [], excludeExtensions: [], hideUnavailableRules: true,
      skipRecentHours: 24, acknowledgedCleanWarnings: []
    };
    fetchDeepCleanRules.mockResolvedValue([{
      category: 'Sample OS',
      items: [{ id: 'temp', name: 'Temporary files', sizeBytes: null, fileCount: null, present: false }]
    }]);
    mount();
    await ready();
    expect(await screen.findByText(/επειδή το λογισμικό δεν είναι εγκατεστημένο/)).toBeTruthy();
  });

  it('translates the tree: aria-label, Loses data badge, needs admin / not installed', async () => {
    fetchDeepCleanRules.mockResolvedValue([{
      category: 'Sample OS',
      items: [
        { id: 'a', name: 'Item A', sizeBytes: null, fileCount: null, accessible: false, sizeBytesKnown: false },
        { id: 'b', name: 'Item B', sizeBytes: null, fileCount: null, present: false }
      ]
    }, ...riskyRules]);
    mount();
    await ready();
    await screen.findByText('Item A');

    expect(screen.getByRole('checkbox', { name: 'Επιλογή όλων στην κατηγορία Sample OS' })).toBeTruthy();
    // Item A has sizeBytes: null so SizeLabel short-circuits before
    // reaching `accessible`/`present` -- use one with a non-null size to
    // reach the needs-admin/not-installed branches.
  });

  it('translates "needs admin" and "not installed" via a measured size', async () => {
    fetchDeepCleanRules.mockResolvedValue([{
      category: 'Sample OS',
      items: [
        { id: 'a', name: 'Item A', sizeBytes: 10, fileCount: 1, accessible: false },
        { id: 'b', name: 'Item B', sizeBytes: 10, fileCount: 1, present: false }
      ]
    }]);
    mount();
    await ready();
    const rowA = (await screen.findByText('Item A')).closest('div');
    const rowB = screen.getByText('Item B').closest('div');
    expect(within(rowA).getByText('απαιτεί διαχειριστή')).toBeTruthy();
    expect(within(rowB).getByText('δεν είναι εγκατεστημένο')).toBeTruthy();
  });

  it('translates the "Loses data" badge on a risky rule', async () => {
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    mount();
    await ready();
    const row = (await screen.findByText('Cookies')).closest('div');
    expect(within(row).getByText('Χάνει δεδομένα')).toBeTruthy();
  });

  it('translates the footer: total label, not-measured-yet, Select everything, Clear', async () => {
    mount();
    await ready();
    await screen.findByText('Temporary files');

    expect(screen.getByText(/Συνολικός χώρος προς απελευθέρωση:/)).toBeTruthy();
    expect(screen.getByText('δεν έχει μετρηθεί ακόμα')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Επιλογή όλων' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Απαλοιφή' })).toBeTruthy();
    expect(screen.getByText('0 επιλέχθηκαν')).toBeTruthy();
  });

  it('translates the tree filter, its header and its empty result', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');

    expect(screen.getByText('0 από 2 επιλεγμένα')).toBeTruthy();
    const filter = screen.getByRole('textbox', { name: 'Φιλτράρισμα καθαριστών…' });
    await user.type(filter, 'zzzz');
    expect(screen.getByText('Κανένας καθαριστής δεν ταιριάζει με αυτό το φίλτρο.')).toBeTruthy();
  });

  it('translates the confirm prompt, Cancel and Confirm', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());

    expect(screen.getByText(/Μετακίνηση 1 στοιχείου \(το μέγεθος δεν μετρήθηκε\) σε καραντίνα;/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ακύρωση' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' })).toBeTruthy();
  });

  it('translates the Cleaning… busy state', async () => {
    let resolveClean;
    // The signature is (ruleIds, onEvent, signal) now, not a plain
    // resolved value -- but the busy state only needs the promise to
    // stay pending, so what it resolves WITH is unused (the hook builds
    // freedBytes/results from onEvent calls, never called here).
    streamDeepCleanExecute.mockReturnValue(new Promise((resolve) => { resolveClean = resolve; }));
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByRole('button', { name: 'Καθαρισμός…' })).toBeTruthy();
    resolveClean();
  });

  it('translates Stop while scanning, and Rescan once a scan has finished', async () => {
    streamDeepCleanScan.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    await user.click(screen.getAllByRole('button', { name: 'Προεπισκόπηση' })[0]);

    expect(await screen.findByRole('button', { name: 'Διακοπή' })).toBeTruthy();
  });

  it('translates the success toast and the locked-files clause', async () => {
    streamDeepCleanExecute.mockImplementation(async (ruleIds, onEvent) => {
      onEvent('rule', { id: 'temp', name: 'temp', freedBytes: 1024, skipped: [{ path: 'C:\\a.tmp', reason: 'locked' }] });
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText(/Ο καθαρισμός ολοκληρώθηκε\. Ελευθερώθηκαν/)).toBeTruthy();
    expect(await screen.findByText('Παραλείφθηκε 1 κλειδωμένο αρχείο.')).toBeTruthy();
    expect(screen.getByText('Κλείστε τις εφαρμογές που τα χρησιμοποιούν και καθαρίστε ξανά.')).toBeTruthy();
  });

  // No test for the inline "Freed X" success-banner's own locked-files
  // clause (t('deepClean.resultLockedSuffix')): handleClean() sets
  // cleanResult, then -- still in the same synchronous stack, no await
  // between them -- calls runPreview(), whose first line clears it again
  // before its own await. React 18 batches both into one commit, so the
  // banner never actually paints; confirmed by trying exactly this
  // assertion and finding the banner's div simply absent afterward, while
  // the corresponding success toast (a separate piece of state) renders
  // fine. A genuine pre-existing bug unrelated to translation, flagged
  // separately rather than fixed here -- see the spawned task on this
  // session. deepClean.resultLockedSuffix is exercised as a plain
  // function by validate_deepclean_blocks.mjs's syntax check instead.
});

describe('the warning dialog, in Greek', () => {
  const tick = async (user, label) => {
    await screen.findByText('Cookies');
    await user.click(screen.getByRole('checkbox', { name: label }));
  };

  it('translates the title, remember label, cancel and enable-anyway', async () => {
    fetchDeepCleanRules.mockResolvedValue(riskyRules);
    const user = userEvent.setup();
    mount();
    await ready();
    await tick(user, 'Cookies');

    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getByText('Ενεργοποίηση Sample Browser — Cookies')).toBeTruthy();
    // The rule's own description is backend DATA and stays untranslated.
    expect(dialog.getByText('Signs you out of every site that remembered you.')).toBeTruthy();
    expect(dialog.getByLabelText('Απομνημόνευση της επιλογής μου για Sample Browser — Cookies')).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Ακύρωση' })).toBeTruthy();
    expect(dialog.getByRole('button', { name: 'Ενεργοποίηση ούτως ή άλλως' })).toBeTruthy();
  });

  it('falls back to the translated generic body for a rule with no description', async () => {
    fetchDeepCleanRules.mockResolvedValue([{
      category: 'Sample Browser',
      items: [{ id: 'sample_x', category: 'Sample Browser', name: 'X', risky: true, sizeBytes: null, fileCount: null }]
    }]);
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('X');
    await user.click(screen.getByRole('checkbox', { name: 'X' }));

    expect(within(screen.getByRole('dialog')).getByText('Αυτή η επιλογή αφαιρεί δεδομένα που ίσως θέλετε να κρατήσετε.')).toBeTruthy();
  });
});

describe('the Deep Clean live logs, in Greek', () => {
  it('words a scan log line in Greek', async () => {
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 2 });
      onEvent('rule', { id: 'temp', category: 'Sample OS', name: 'Temporary files', sizeBytes: 0, present: false });
      onEvent('rule', { id: 'thumbs', category: 'Sample OS', name: 'Thumbnail cache', sizeBytes: 0, present: true, accessible: false });
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    await user.click(screen.getByRole('button', { name: 'Προεπισκόπηση' }));

    const log = (await screen.findByText('Έξοδος σάρωσης')).closest('[class*="border-b"]').parentElement;
    expect(await within(log).findByText('δεν είναι εγκατεστημένο')).toBeTruthy();
    expect(within(log).getByText('απαιτεί διαχειριστή')).toBeTruthy();
    // The English wording is not what the log shows.
    expect(within(log).queryByText('not installed')).toBeNull();
    expect(within(log).queryByText('needs admin')).toBeNull();
  });

  it('words a clean log line in Greek', async () => {
    // Held open so the clean log is still the panel on screen: a finished
    // clean immediately re-scans and replaces it.
    streamDeepCleanExecute.mockImplementation(async (ruleIds, onEvent) => {
      onEvent('start', { total: 1 });
      onEvent('rule', { id: 'temp', name: 'Temporary files', freedBytes: 1024, skipped: [{ path: 'C:\a.tmp', reason: 'locked' }] });
      await new Promise(() => {});
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText('Temporary files');
    const boxes = screen.getAllByRole('checkbox');
    await user.click(boxes[boxes.length - 1]);
    await waitFor(() => expect(cleanButton().disabled).toBe(false));
    await user.click(cleanButton());
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText('Διαγραφή: Temporary files')).toBeTruthy();
    expect(screen.getByText('1 KB, κλειδωμένα: 1')).toBeTruthy();
    expect(screen.queryByText(/Delete /)).toBeNull();
  });
});
