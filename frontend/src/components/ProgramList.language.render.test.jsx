// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Applications list's own copy follows the chosen language -- the
 * property no English-only test can show, since English is also the
 * fallback those tests render under.
 *
 * Two collisions turned up while picking fixtures, both handled the same
 * way DiskMap's own language test handles its two collisions:
 *
 * - "Κατάστημα" (Store) is both a filter-tab label (with a count suffix,
 *   "Κατάστημα (2)") and the bare badge text on every Store-sourced row.
 *   Two Store rows exist here (one removable, one Windows-protected), so a
 *   bare getByText('Κατάστημα') would find three matches at once. Every
 *   badge assertion below is scoped with `within()` to the row it means.
 * - "Νέο" (New) is now both the "recent installs" COLUMN header word and
 *   the New badge a fresh row wears in that column, once ProgramList.jsx
 *   was fixed to translate the badge through the same
 *   `applications.columns.new` key instead of a hardcoded "New" literal
 *   (the gap this file's mutation pass exists to have caught). Scoped the
 *   same way: the header via the row the "Μέγεθος" header sits in, the
 *   badge via the data row "New Thing" sits in.
 *
 * The fixture deliberately has no `unused: true` program, so clicking the
 * always-visible Unused tab (unlike Store/Extensions/Broken, it isn't
 * gated on a nonzero count) produces a real zero-result screen -- the one
 * empty-state variant (`withFilter`) that a filter with a positive count
 * can never reach in this list.
 */

vi.mock('../lib/api.js', () => ({
  fetchPrograms: vi.fn(async () => []),
  revealInExplorer: vi.fn(async () => {}),
  openInstalledAppsSettings: vi.fn(async () => {}),
  // Read by LanguageProvider -- 'el' is the whole point of this file.
  fetchSettings: vi.fn(async () => ({ language: 'el' })),
  updateSettings: vi.fn()
}));

const ProgramList = (await import('./ProgramList.jsx')).default;

const TODAY = new Date().toISOString().slice(0, 10);

const program = (over = {}) => ({
  id: over.name || 'p',
  name: 'Thing',
  publisher: 'Acme',
  sizeBytes: 1024 * 1024,
  source: 'registry',
  uninstallString: 'C:\\Program Files\\Thing\\uninstall.exe',
  ...over
});

const PROGRAMS = [
  program({ id: 'steam', name: 'Steam', publisher: 'Valve', sizeBytes: 20e9, installLocation: 'C:\\Steam' }),
  program({ id: 'broken', name: 'Broken Thing', publisher: 'Nobody', sizeBytes: 2e9, health: { orphaned: true } }),
  program({ id: 'storeapp', name: 'Store App', publisher: 'Microsoft', sizeBytes: 3e9, source: 'store', nonRemovable: false, packageFullName: 'x', uninstallString: undefined }),
  program({ id: 'sechealth', name: 'Windows Security', publisher: 'Microsoft', sizeBytes: 1e8, source: 'store', nonRemovable: true, packageFullName: 'y', uninstallString: undefined }),
  program({ id: 'fresh', name: 'New Thing', publisher: 'Someone', sizeBytes: 5e6, installDate: TODAY }),
  program({ id: 'unknownsize', name: 'Mystery App', publisher: 'Nobody Knows', sizeBytes: null })
];

const EXTENSIONS = [
  program({ id: 'ext1', name: 'uBlock Origin', publisher: 'Raymond Hill', source: 'extension', browser: 'Chrome', enabled: false, uninstallString: undefined })
];

const render = (props = {}) => renderScreen(
  <ProgramList
    programs={props.programs !== undefined ? props.programs : PROGRAMS}
    extensions={props.extensions !== undefined ? props.extensions : EXTENSIONS}
    running={props.running || { steam: true }}
    icons={{}}
    onUninstall={props.onUninstall || (() => {})}
    onBatchUninstall={props.onBatchUninstall || (() => {})}
    onRemoveStoreApp={props.onRemoveStoreApp || (() => {})}
  />
);

const rowFor = async (name) => (await screen.findByText(name)).closest('div[class*="grid"]');
const clickFilter = async (user, label) => {
  const button = screen.getAllByRole('button').find((b) => b.textContent.trim().startsWith(label));
  await user.click(button);
};

/** `settings.language` resolves through the same async query every other
 * persisted setting does (useSettings()), so the very first render is
 * always English, one tick before the real language commits -- and
 * "Steam" is a program name, not a translated string, so waiting on it
 * proves nothing about which language actually rendered. "Όλα" (All) is
 * the one filter tab every render carries regardless of fixture, and it
 * only exists in Greek, so waiting for it is what actually proves the
 * language settled before a synchronous getByText/getByRole runs. */
const ready = () => screen.findByRole('button', { name: 'Όλα' });

beforeEach(() => { vi.clearAllMocks(); });

describe('loading and errors, in Greek', () => {
  it('shows the loading skeleton translated', async () => {
    const { fetchPrograms } = await import('../lib/api.js');
    // Never resolves -- the loading branch is what is under test.
    fetchPrograms.mockImplementationOnce(() => new Promise(() => {}));
    renderScreen(<ProgramList />);

    expect(await screen.findByText('Εφαρμογή')).toBeTruthy();
    expect(screen.getByText(/Ανάγνωση εγκατεστημένων προγραμμάτων/)).toBeTruthy();
  });

  it('shows the load-error message translated, with the raw error interpolated', async () => {
    const { fetchPrograms } = await import('../lib/api.js');
    fetchPrograms.mockRejectedValueOnce(new Error('reg.exe exited with 1'));
    renderScreen(<ProgramList />);

    expect(await screen.findByText(/Αδυναμία φόρτωσης προγραμμάτων: reg\.exe exited with 1/)).toBeTruthy();
  });
});

describe('search and filters, in Greek', () => {
  it('translates the search field', async () => {
    render();
    expect(await screen.findByPlaceholderText('Αναζήτηση εφαρμογών…')).toBeTruthy();
    expect(screen.getByLabelText('Αναζήτηση εφαρμογών')).toBeTruthy();
  });

  it('translates every filter tab, including the count-suffixed ones', async () => {
    render();
    await ready();

    expect(screen.getByRole('button', { name: 'Όλα' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Αχρησιμοποίητα' })).toBeTruthy();
    // storeCount = 2 (Store App + Windows Security), extensions = 1, broken = 1.
    expect(screen.getByRole('button', { name: 'Κατάστημα (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Επεκτάσεις (1)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Κατεστραμμένα (1)' })).toBeTruthy();
  });
});

describe('column headers, in Greek', () => {
  it('translates every labeled column', async () => {
    render();
    await ready();

    // "Μέγεθος" (Size) is unique on screen -- unlike "Νέο", nothing else
    // shares its text -- so it anchors the header row for the New-column
    // scoping check below.
    const sizeHeader = screen.getByText('Μέγεθος');
    expect(sizeHeader).toBeTruthy();
    expect(screen.getByText('Εφαρμογή')).toBeTruthy();
    expect(screen.getByText('Έκδοση')).toBeTruthy();
    expect(screen.getByText('Τύπος')).toBeTruthy();
    expect(screen.getByText('Εγκαταστάθηκε')).toBeTruthy();
    expect(screen.getByText('Εταιρεία')).toBeTruthy();

    const headerRow = sizeHeader.closest('[role="row"]');
    expect(within(headerRow).getByText('Νέο')).toBeTruthy();
  });
});

describe('row badges, in Greek', () => {
  it('translates the broken badge and switches its action to Force remove', async () => {
    render();
    await ready();
    const row = await rowFor('Broken Thing');
    expect(within(row).getByText('Κατεστραμμένο')).toBeTruthy();
    expect(within(row).getByRole('button', { name: 'Εξαναγκασμένη κατάργηση' })).toBeTruthy();
  });

  it('translates the running badge', async () => {
    render();
    await ready();
    const row = await rowFor('Steam');
    expect(within(row).getByText('Σε λειτουργία')).toBeTruthy();
  });

  it('translates the store badge on both a removable and a protected Store row', async () => {
    render();
    await ready();
    const removable = await rowFor('Store App');
    const protectedRow = await rowFor('Windows Security');
    expect(within(removable).getByText('Κατάστημα')).toBeTruthy();
    expect(within(protectedRow).getByText('Κατάστημα')).toBeTruthy();
  });

  it('translates the disabled badge on an extension', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    await clickFilter(user, 'Επεκτάσεις');

    const row = await rowFor('uBlock Origin');
    expect(within(row).getByText('Απενεργοποιημένο')).toBeTruthy();
    // Removal is a browser operation here, not an uninstall button.
    expect(within(row).getByText('μέσω του προγράμματος περιήγησης')).toBeTruthy();
    expect(within(row).queryByRole('button', { name: /απεγκατάσταση/i })).toBeNull();
  });

  it('translates the unused badge', async () => {
    render({ programs: [program({ id: 'idle', name: 'Idle Thing', unused: true })], extensions: [] });
    await ready();
    const row = await rowFor('Idle Thing');
    expect(within(row).getByText('Αχρησιμοποίητο')).toBeTruthy();
  });

  it('translates the New badge, scoped apart from the column header of the same word', async () => {
    render();
    await ready();
    const row = await rowFor('New Thing');
    expect(within(row).getByText('Νέο')).toBeTruthy();
  });
});

describe('row actions, in Greek', () => {
  it('translates the in-Windows button and its aria-label for a protected Store app', async () => {
    render();
    await ready();
    const row = await rowFor('Windows Security');
    const button = within(row).getByRole('button', { name: /δεν επιτρέπουν την κατάργηση/i });
    expect(button.textContent).toContain('Στα Windows');
  });

  it('translates Uninstall for a removable Store app', async () => {
    render();
    await ready();
    const row = await rowFor('Store App');
    expect(within(row).getByRole('button', { name: 'Απεγκατάσταση' })).toBeTruthy();
  });

  it('translates Uninstall for an ordinary registry program', async () => {
    render();
    await ready();
    const row = await rowFor('New Thing');
    expect(within(row).getByRole('button', { name: 'Απεγκατάσταση' })).toBeTruthy();
  });

  it('translates the reveal-folder button and its failure text', async () => {
    const { revealInExplorer } = await import('../lib/api.js');
    revealInExplorer.mockRejectedValueOnce(new Error('gone'));
    const user = userEvent.setup();
    render();
    await ready();
    const row = await rowFor('Steam');

    const button = within(row).getByRole('button', { name: 'Άνοιγμα του φακέλου για Steam' });
    expect(button.textContent).toBe('Φάκελος');

    await user.click(button);
    expect(await within(row).findByText('Δεν βρέθηκε')).toBeTruthy();
  });
});

describe('checkbox labels and translated batch reasons, in Greek', () => {
  it('names the row being selected', async () => {
    render();
    await ready();
    const row = await rowFor('Steam');
    expect(within(row).getByRole('checkbox', { name: 'Επιλογή Steam' })).toBeTruthy();
  });

  it('gives the translated reason a row cannot be batch-selected: orphaned', async () => {
    render();
    await ready();
    const row = await rowFor('Broken Thing');
    expect(within(row).getByRole('checkbox', { name: /εξαναγκασμένη κατάργηση/i })).toBeTruthy();
  });

  it('gives the translated reason a row cannot be batch-selected: Windows-protected Store app', async () => {
    render();
    await ready();
    const row = await rowFor('Windows Security');
    expect(within(row).getByRole('checkbox', { name: /δεν επιτρέπουν την κατάργησή της/i })).toBeTruthy();
  });

  it('gives the translated reason a row cannot be batch-selected: browser extension', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    await clickFilter(user, 'Επεκτάσεις');

    const row = await rowFor('uBlock Origin');
    expect(within(row).getByRole('checkbox', { name: /καταργούνται από το ίδιο το πρόγραμμα περιήγησης/i })).toBeTruthy();
  });

  it('translates Select all and Clear selection on the header checkbox', async () => {
    const user = userEvent.setup();
    render();
    await ready();

    const headerCheckbox = screen.getByRole('checkbox', { name: 'Επιλογή όλων των εμφανιζόμενων' });
    await user.click(headerCheckbox);
    expect(screen.getByRole('checkbox', { name: 'Απαλοιφή επιλογής' })).toBeTruthy();
  });
});

describe('the empty state, in every Greek variant', () => {
  it('translates the plain variant when there is nothing at all to show', async () => {
    render({ programs: [], extensions: [] });
    expect(await screen.findByText('Τίποτα δεν ταιριάζει.')).toBeTruthy();
    expect(screen.getByText(/0 καταχωρίσεις είναι κρυμμένες/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Απαλοιφή αναζήτησης και φίλτρων' })).toBeTruthy();
  });

  it('translates the query-only variant, with the term quoted inside the sentence', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    await user.type(screen.getByPlaceholderText(/Αναζήτηση/), 'zzzznotfound');

    expect(await screen.findByText('Τίποτα δεν ταιριάζει με «zzzznotfound».')).toBeTruthy();
    expect(screen.getByText(/6 καταχωρίσεις είναι κρυμμένες/)).toBeTruthy();
  });

  it('translates the filter-only variant, using a filter with zero matches', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    // Unused carries no count gate, and nothing in this fixture is unused.
    await clickFilter(user, 'Αχρησιμοποίητα');

    expect(await screen.findByText('Τίποτα δεν ταιριάζει στο Αχρησιμοποίητα.')).toBeTruthy();
  });

  it('translates the query-and-filter variant, naming both', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    await clickFilter(user, 'Κατεστραμμένα');
    await user.type(screen.getByPlaceholderText(/Αναζήτηση/), 'nomatch');

    expect(await screen.findByText('Τίποτα δεν ταιριάζει με «nomatch» στο Κατεστραμμένα.')).toBeTruthy();
  });

  it('clears the search and filter through the translated button', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    await user.type(screen.getByPlaceholderText(/Αναζήτηση/), 'zzzznotfound');
    await screen.findByText('Τίποτα δεν ταιριάζει με «zzzznotfound».');

    await user.click(screen.getByRole('button', { name: 'Απαλοιφή αναζήτησης και φίλτρων' }));
    expect(await screen.findByText('Steam')).toBeTruthy();
  });
});

describe('the footer, in Greek', () => {
  it('translates the default count, the New window and the total', async () => {
    render();
    await ready();

    expect(screen.getByText('Εγκαταστάσεις: 6')).toBeTruthy();
    expect(screen.getByText(/νέα σε 7 ημέρες/)).toBeTruthy();
    expect(screen.getByText(/σύνολο/)).toBeTruthy();
  });

  it('translates "showing X of Y" once the list is actually filtered', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    await user.type(screen.getByPlaceholderText(/Αναζήτηση/), 'Steam');

    expect(await screen.findByText('Εμφάνιση 1 από 6')).toBeTruthy();
  });

  it('translates the selected-count bar, unknown sizes, clear, and the pluralized batch button', async () => {
    const user = userEvent.setup();
    render();
    await ready();
    const steamRow = await rowFor('Steam');
    await user.click(within(steamRow).getByRole('checkbox'));

    expect(screen.getByText('1 επιλέχθηκαν')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Απεγκατάσταση 1 προγράμματος' })).toBeTruthy();

    const unknownRow = await rowFor('Mystery App');
    await user.click(within(unknownRow).getByRole('checkbox'));

    expect(screen.getByText('2 επιλέχθηκαν')).toBeTruthy();
    expect(screen.getByText(/άγνωστο μέγεθος/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Απεγκατάσταση 2 προγραμμάτων' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Απαλοιφή' }));
    expect(screen.queryByText('2 επιλέχθηκαν')).toBeNull();
  });
});
