// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';
import ToastHost from './ToastHost.jsx';

/** The Duplicates screen's own copy follows the chosen language -- the
 * property no English-only test can show, since English is also the
 * fallback those tests render under.
 *
 * A hand-built provider tree, not renderScreen(), because runRemoval()
 * raises real toasts and renderScreen() mounts ToastProvider but not
 * ToastHost -- the same reason DiskMap.language.render.test.jsx builds
 * its own mount() rather than using renderScreen().
 *
 * The backend's own error message (scan.error.message) is deliberately
 * never translated, the same rule every other screen follows for text
 * Windows or the backend itself produced -- not tested here since
 * there's nothing of this screen's own to assert on it. */

const fetchDuplicates = vi.fn();
const quarantineDiskPath = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchDuplicates: (...a) => fetchDuplicates(...a),
  quarantineDiskPath: (...a) => quarantineDiskPath(...a),
  fetchSettings: async () => ({ language: 'el' })
}));

const Duplicates = (await import('./Duplicates.jsx')).default;

afterEach(cleanup);

const FOLDER = 'C:\\Users\\jim\\Pictures';

function mount() {
  return render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider>
        <LanguageProvider>
          <ToastProvider>
            <Duplicates />
            <ToastHost />
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const oneGroup = (over = {}) => ({
  groups: [{
    digest: 'd1', count: 2, size: 1024, wastedBytes: 1024,
    files: [
      { path: `${FOLDER}\\a.jpg`, mtimeMs: Date.UTC(2026, 0, 1) },
      { path: `${FOLDER}\\copy of a.jpg`, mtimeMs: Date.UTC(2026, 1, 1) }
    ]
  }],
  wastedBytes: 1024, scannedFiles: 10, truncated: false,
  ...over
});

beforeEach(() => { vi.clearAllMocks(); });

/** `settings.language` resolves through the same async query every other
 * persisted setting does, so the very first render is always English --
 * waiting for the Greek-only title is what actually proves the language
 * settled before a synchronous query runs. */
const ready = () => screen.findByRole('heading', { name: 'Διπλότυπα αρχεία' });

/** Types a folder and starts the search, the way a person would --
 * mirrors Duplicates.render.test.jsx's own search() helper. */
async function search(user) {
  await user.type(screen.getByLabelText('Φάκελος για αναζήτηση διπλότυπων'), FOLDER);
  await user.click(screen.getByRole('button', { name: 'Εύρεση διπλότυπων' }));
}

describe('the duplicates screen, in Greek', () => {
  it('translates the title, subtitle, and search field', async () => {
    mount();
    expect(await ready()).toBeTruthy();
    expect(screen.getByText(/Αρχεία που είναι πανομοιότυπα byte προς byte/)).toBeTruthy();
    expect(screen.getByLabelText('Φάκελος για αναζήτηση διπλότυπων')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Εύρεση διπλότυπων' })).toBeTruthy();
    expect(screen.getByText('Συγκρίνει πρώτα τα μεγέθη, μετά ένα δείγμα, μετά ολόκληρο το αρχείο — έτσι τα περισσότερα αρχεία δεν διαβάζονται ποτέ.')).toBeTruthy();
  });

  it('translates the reading state and Stop button', async () => {
    fetchDuplicates.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    expect(await screen.findByText(`Ανάγνωση ${FOLDER}`)).toBeTruthy();
    expect(screen.getByText(/Πρώτα τα μεγέθη, μετά ένα δείγμα 64 KB/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Διακοπή' })).toBeTruthy();
  });

  it('translates the empty-result state, including the truncated suffix', async () => {
    fetchDuplicates.mockResolvedValue(oneGroup({ groups: [], truncated: true }));
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    expect(await screen.findByText('Δεν υπάρχουν διπλότυπα αρχεία εδώ.')).toBeTruthy();
    expect(screen.getByText(/10 αρχεία συγκρίθηκαν\..*Η σάρωση διακόπηκε νωρίς/)).toBeTruthy();
  });

  it('translates the summary line, the auto-select buttons, and the truncated warning', async () => {
    fetchDuplicates.mockResolvedValue(oneGroup({ truncated: true }));
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    expect(await screen.findByText('1 σετ')).toBeTruthy();
    // "1 KB ανακτήσιμα" also appears on the single group's own line below
    // (same wasted-bytes value in this fixture), so this is scoped to the
    // summary row via its unique sibling, "Διατήρηση παλαιότερου".
    const summaryRow = screen.getByRole('button', { name: 'Διατήρηση παλαιότερου' }).closest('div');
    expect(within(summaryRow).getByText('1 KB ανακτήσιμα')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Διατήρηση νεότερου' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Απαλοιφή' })).toBeTruthy();
    expect(screen.getByText('Η σάρωση διακόπηκε νωρίς, οπότε μπορεί να υπάρχουν περισσότερα σετ από αυτά.')).toBeTruthy();
  });

  it('translates a group\'s own line and the all-ticked warning', async () => {
    fetchDuplicates.mockResolvedValue(oneGroup());
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    await screen.findByText('a.jpg');
    const groupCard = screen.getByText('a.jpg').closest('div.glass-panel');
    expect(within(groupCard).getByText('2 πανομοιότυπα αντίγραφα · 1 KB το καθένα')).toBeTruthy();
    // The group's own recoverable line, not the summary's -- both read
    // "1 KB ανακτήσιμα" in this fixture (same wasted-bytes value), which
    // is exactly why this needs its own scoped assertion rather than
    // trusting the summary-line check above to cover it too.
    expect(within(groupCard).getByText('1 KB ανακτήσιμα')).toBeTruthy();

    // Tick both files in the only group -- the guard against emptying it.
    for (const box of screen.getAllByRole('checkbox')) await user.click(box);
    expect(await screen.findByText('Κάθε αντίγραφο σε αυτό το σετ είναι επιλεγμένο — αποεπιλέξτε ένα για να το κρατήσετε.')).toBeTruthy();
    expect(screen.getByRole('button', { name: /θα έχαναν κάθε αντίγραφο/ }).disabled).toBe(true);
  });

  it('translates the footer selection line and opens the translated confirm modal', async () => {
    fetchDuplicates.mockResolvedValue(oneGroup());
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    const [firstCheckbox] = await screen.findAllByRole('checkbox');
    await user.click(firstCheckbox);

    expect(screen.getByText('1 επιλέχθηκε · 1 KB')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση επιλεγμένων σε καραντίνα' }));

    expect(await screen.findByRole('dialog', { name: 'Μετακίνηση διπλότυπων σε καραντίνα' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Μετακίνηση 1 αντιγράφου σε καραντίνα;' })).toBeTruthy();
    expect(screen.getByText(/Μόλις αδειάσετε την Καραντίνα, θα ελευθερωθούν 1 KB\. Κάθε σετ κρατά τουλάχιστον ένα αντίγραφο/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ακύρωση' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' })).toBeTruthy();
  });

  it('translates the success toast after a move that worked', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: true });
    fetchDuplicates.mockResolvedValue(oneGroup());
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    const [firstCheckbox] = await screen.findAllByRole('checkbox');
    await user.click(firstCheckbox);
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση επιλεγμένων σε καραντίνα' }));
    await user.click(await screen.findByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText('Μετακινήθηκε 1 αντίγραφο σε καραντίνα.')).toBeTruthy();
    expect(screen.getByText('Επαναφέρετέ τα από την οθόνη Καραντίνας.')).toBeTruthy();
  });

  it('translates the Moving… state while the removal is in flight', async () => {
    let resolveMove;
    quarantineDiskPath.mockReturnValue(new Promise((resolve) => { resolveMove = resolve; }));
    fetchDuplicates.mockResolvedValue(oneGroup());
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    const [firstCheckbox] = await screen.findAllByRole('checkbox');
    await user.click(firstCheckbox);
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση επιλεγμένων σε καραντίνα' }));
    await user.click(await screen.findByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByRole('button', { name: 'Μετακίνηση…' })).toBeTruthy();
    resolveMove({ ok: true });
  });

  it('translates the failure toast when a move does not work', async () => {
    quarantineDiskPath.mockResolvedValue({ ok: false });
    fetchDuplicates.mockResolvedValue(oneGroup());
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    const [firstCheckbox] = await screen.findAllByRole('checkbox');
    await user.click(firstCheckbox);
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση επιλεγμένων σε καραντίνα' }));
    await user.click(await screen.findByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));

    expect(await screen.findByText('1 δεν μπόρεσε να μετακινηθεί.')).toBeTruthy();
    expect(screen.getByText('Ενδέχεται να είναι ανοιχτά ή σε άλλο δίσκο.')).toBeTruthy();
  });
});

describe('the Apple design pass strings, in Greek', () => {
  it('translates the placeholder and the Keep / To quarantine tags', async () => {
    fetchDuplicates.mockResolvedValue(oneGroup());
    const user = userEvent.setup();
    mount();
    await ready();

    expect(screen.getByLabelText('Φάκελος για αναζήτηση διπλότυπων').getAttribute('placeholder'))
      .toMatch(/^Διαδρομή φακέλου, για παράδειγμα C:/);
    await search(user);
    await screen.findByText('a.jpg');
    expect(screen.getAllByText('Διατήρηση')).toHaveLength(2);

    await user.click((await screen.findAllByRole('checkbox'))[0]);
    expect(screen.getByText('Στην καραντίνα')).toBeTruthy();
  });

  it('translates the elapsed timer and the stopped note', async () => {
    fetchDuplicates.mockImplementation((_folder, signal) => new Promise((_, reject) => {
      signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const user = userEvent.setup();
    mount();
    await ready();
    await search(user);

    expect((await screen.findByTestId('duplicates-elapsed')).textContent).toBe('Χρόνος: 00:00');
    await user.click(screen.getByRole('button', { name: 'Διακοπή' }));
    expect(await screen.findByText('Διακόπηκε — δεν συγκρίθηκε τίποτα.')).toBeTruthy();
  });
});
