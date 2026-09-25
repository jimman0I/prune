// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The Startup screen's own copy follows the chosen language -- the
 * property no English-only test can show, since English is also the
 * fallback those tests render under.
 *
 * The group headings (`Registry: HKCU Run`, etc.) come from
 * lib/groupStartupItems.js, a plain utility with no access to the
 * language hook -- StartupItems.jsx passes `t('startup.groups')` as its
 * optional `labels` override, the same pattern ProgramList.jsx already
 * uses for batchSelection.js's ineligibility reasons and DiskMap.jsx uses
 * for limitCells.js's aggregate-cell label. groupStartupItems.test.js
 * covers the override mechanism itself; this file covers that
 * StartupItems.jsx actually supplies a translated one.
 */

const fetchStartupItems = vi.fn();
const setStartupItemEnabled = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStartupItems: (...args) => fetchStartupItems(...args),
  fetchStartupIcons: async () => ({}),
  setStartupItemEnabled: (...args) => setStartupItemEnabled(...args),
  fetchSettings: async () => ({ language: 'el' })
}));

const StartupItems = (await import('./StartupItems.jsx')).default;

const entry = (over = {}) => ({
  id: 'e1',
  name: 'Thing',
  command: 'C:\\Program Files\\Thing\\thing.exe',
  description: 'Thing Launcher',
  publisher: 'Acme',
  location: 'Run',
  rawScope: 'user',
  enabled: true,
  running: false,
  exists: true,
  toggleNote: null,
  ...over
});

const rowFor = (name) => screen.getByText(name).closest('div[class*="grid"]');

beforeEach(() => {
  vi.clearAllMocks();
  fetchStartupItems.mockResolvedValue([entry()]);
  setStartupItemEnabled.mockResolvedValue({ ok: true, enabled: false });
});

/** `settings.language` resolves through the same async query every other
 * persisted setting does, so the first render is always English -- and
 * "Thing" is an entry name, not translated text, so waiting on it proves
 * nothing about which language actually rendered. The title renders
 * unconditionally, so waiting for its Greek text is what actually proves
 * the language settled before a synchronous query runs. */
const ready = () => screen.findByRole('heading', { name: 'Εκκίνηση' });

describe('the startup screen, in Greek', () => {
  it('translates the title and subtitle', async () => {
    renderScreen(<StartupItems />);
    expect(await screen.findByRole('heading', { name: 'Εκκίνηση' })).toBeTruthy();
    expect(screen.getByText(/τα Windows όταν συνδέεστε/)).toBeTruthy();
  });

  it('translates the loading text and the skeleton\'s own column headers', async () => {
    fetchStartupItems.mockImplementation(() => new Promise(() => {}));
    renderScreen(<StartupItems />);
    expect(await screen.findByText('Ανάγνωση καταχωρίσεων εκκίνησης…')).toBeTruthy();
    expect(screen.getByText('Όνομα εκκίνησης')).toBeTruthy();
  });

  it('translates the load-error message, with the raw error interpolated', async () => {
    fetchStartupItems.mockRejectedValue(new Error('reg.exe exited with 1'));
    renderScreen(<StartupItems />);
    expect(await screen.findByText(/Αδυναμία ανάγνωσης των καταχωρίσεων εκκίνησης: reg\.exe exited with 1/, {}, { timeout: 5000 })).toBeTruthy();
  });

  it('translates the empty state', async () => {
    fetchStartupItems.mockResolvedValue([]);
    renderScreen(<StartupItems />);
    expect(await screen.findByText('Τίποτα δεν εκτελείται κατά τη σύνδεση.')).toBeTruthy();
    expect(screen.getByText(/κλειδιά Run και RunOnce/)).toBeTruthy();
  });

  it('translates the column headers', async () => {
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Thing');

    expect(screen.getByText('Όνομα εκκίνησης')).toBeTruthy();
    expect(screen.getByText('Διαδρομή εκκίνησης')).toBeTruthy();
    expect(screen.getByText('Περιγραφή')).toBeTruthy();
    expect(screen.getByText('Εκδότης')).toBeTruthy();
    expect(screen.getByText('Κατάσταση')).toBeTruthy();
  });

  it('translates the switch name, and it is the SAME name whether the entry is on or off', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'on', name: 'Thing', enabled: true }),
      entry({ id: 'off', name: 'Other', enabled: false })
    ]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Thing');

    // Fixed name; the on/off state is aria-checked, not part of the words.
    const on = screen.getByRole('checkbox', { name: 'Εκτέλεση του Thing κατά τη σύνδεση' });
    const off = screen.getByRole('checkbox', { name: 'Εκτέλεση του Other κατά τη σύνδεση' });
    expect(on.getAttribute('aria-checked')).toBe('true');
    expect(off.getAttribute('aria-checked')).toBe('false');
  });

  it('says a disabled entry is off, in Greek, in the Status column', async () => {
    fetchStartupItems.mockResolvedValue([entry({ id: 'off', name: 'Other', enabled: false })]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Other');

    expect(within(rowFor('Other')).getByText('Ανενεργό')).toBeTruthy();
  });

  it('translates the summary counts as whole bolded phrases', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'a', name: 'Steam' }),
      entry({ id: 'b', name: 'Discord', enabled: false })
    ]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Steam');

    expect(screen.getByText('2 καταχωρίσεις')).toBeTruthy();
    expect(screen.getByText('1 ενεργοποιημένες')).toBeTruthy();
  });

  it('translates the broken-entry count when a file is missing', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'orphan', name: 'Ghost', exists: false })
    ]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Ghost');

    expect(screen.getByText(/1.*δείχνουν σε αρχείο που δεν υπάρχει/)).toBeTruthy();
  });

  it('translates the status pill words', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'orphan', name: 'Ghost', exists: false, running: true }),
      entry({ id: 'path', name: 'PathThing', exists: null })
    ]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Ghost');

    const ghostRow = rowFor('Ghost');
    expect(within(ghostRow).getByText('Μη έγκυρο')).toBeTruthy();
    expect(within(ghostRow).queryByText('Σε λειτουργία')).toBeNull();

    const pathRow = rowFor('PathThing');
    expect(within(pathRow).getByText('Δεν ελέγχθηκε')).toBeTruthy();
  });

  it('translates "Not running" for an entry that is off and inactive', async () => {
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Thing');
    expect(within(rowFor('Thing')).getByText('Δεν εκτελείται')).toBeTruthy();
  });

  it('translates the Running pill and the "running now" count for an active entry', async () => {
    fetchStartupItems.mockResolvedValue([entry({ id: 'r', name: 'Live', running: true })]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Live');

    expect(within(rowFor('Live')).getByText('Σε λειτουργία')).toBeTruthy();
    expect(screen.getByText('1 εκτελούνται τώρα')).toBeTruthy();
  });

  it('translates the group labels via the translated labels override, and the per-group enabled count', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'u1', name: 'UserOn', rawScope: 'user', enabled: true }),
      entry({ id: 'u2', name: 'UserOff', rawScope: 'user', enabled: false })
    ]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('UserOn');

    expect(screen.getByText('Μητρώο: HKCU Run')).toBeTruthy();
    const heading = screen.getByText('Μητρώο: HKCU Run').closest('div');
    expect(within(heading).getByText('1 από 2 ενεργοποιημένες')).toBeTruthy();
  });

  it('translates the machine-group administrator note, only on the machine group', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'u', name: 'UserThing', rawScope: 'user' }),
      entry({ id: 'm', name: 'MachineThing', rawScope: 'machine' })
    ]);
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('MachineThing');

    const machineHeading = screen.getByText('Μητρώο: HKLM Run').closest('div');
    expect(within(machineHeading).getByText('Η αλλαγή τους ζητά δικαιώματα διαχειριστή')).toBeTruthy();

    const userHeading = screen.getByText('Μητρώο: HKCU Run').closest('div');
    expect(within(userHeading).queryByText('Η αλλαγή τους ζητά δικαιώματα διαχειριστή')).toBeNull();
  });

  it('translates the footer note', async () => {
    renderScreen(<StartupItems />);
    await ready();
    await screen.findByText('Thing');
    expect(screen.getByText(/StartupApproved/)).toBeTruthy();
    expect(screen.getByText(/αναστρέψιμη από εδώ/)).toBeTruthy();
  });
});
