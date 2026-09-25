// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, cleanup } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { ToastProvider } from '../hooks/useToasts.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** Deep Clean's rule names, descriptions and category headings follow the
 * language, and the English stays a working fallback and a working search
 * term. Rendered in Greek against a fixture module (mocked above),
 * which translates brave_cache and brave_cookies and the Brave category and
 * deliberately nothing else -- brave_history is the untranslated rule. */

// Test-owned fixture instead of the real generated files: the tests below prove the
// lookup and the English fallback, and must not change when a translation is reworded.
// Deliberately incomplete (3 rules, 2 categories).
vi.mock('../i18n/cleaner/index.js', () => ({ CLEANER_TEXT: {
  el: {
    rules: {
      brave_cache: { name: 'Προσωρινή μνήμη', description: 'Αποθηκευμένες σελίδες και εικόνες. Ξαναδημιουργούνται καθώς περιηγείστε.' },
      brave_cookies: { name: 'Cookies', description: 'Σας αποσυνδέει από κάθε ιστότοπο που σας θυμόταν.' },
      chrome_cache: { name: 'Προσωρινή μνήμη', description: 'Αποθηκευμένες σελίδες και εικόνες του Chrome.' }
    },
    categories: {
      Brave: 'Πρόγραμμα περιήγησης Brave',
      Chrome: 'Πρόγραμμα περιήγησης Chrome'
    }
  }
} }));

const streamDeepCleanExecute = vi.fn();
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
let settingsRecord = null;
vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  fetchSettings: vi.fn(async () => settingsRecord),
  updateSettings: vi.fn(async (partial) => {
    settingsRecord = { ...settingsRecord, ...partial };
    return settingsRecord;
  }),
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
          </ToastProvider>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const rules = [{
  category: 'Brave',
  items: [
    { id: 'brave_cache', category: 'Brave', name: 'Cache', description: 'Rebuilt as you browse.', sizeBytes: 10, fileCount: 1 },
    { id: 'brave_history', category: 'Brave', name: 'History', description: 'Pages you visited.', sizeBytes: 10, fileCount: 1 },
    {
      id: 'brave_cookies', category: 'Brave', name: 'Cookies', risky: true,
      description: 'Signs you out of every site.', sizeBytes: 10, fileCount: 1
    }
  ]
}];

const CACHE_EL = 'Προσωρινή μνήμη';
const BRAVE_EL = 'Πρόγραμμα περιήγησης Brave';

beforeEach(() => {
  vi.clearAllMocks();
  settingsRecord = {
    language: 'el', excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false,
    skipRecentHours: 24, acknowledgedCleanWarnings: []
  };
  fetchDeepCleanRules.mockResolvedValue(rules);
  streamDeepCleanScan.mockImplementation(() => () => {});
  streamDeepCleanExecute.mockImplementation(() => new Promise(() => {}));
});

const ready = () => screen.findByRole('heading', { name: 'Βαθύς Καθαρισμός' });
const filterBox = () => screen.getByRole('textbox');

describe('Deep Clean rule text, in Greek', () => {
  it('shows translated rule names, descriptions and the category heading', async () => {
    mount();
    await ready();
    expect(await screen.findByText(CACHE_EL)).toBeTruthy();
    expect(screen.getByText(BRAVE_EL)).toBeTruthy();
    expect(screen.getByText(/Αποθηκευμένες σελίδες και εικόνες/)).toBeTruthy();
    expect(screen.getByRole('checkbox', { name: CACHE_EL })).toBeTruthy();
    // The English is not on screen for a translated rule...
    expect(screen.queryByText('Cache')).toBeNull();
    expect(screen.queryByText('Brave')).toBeNull();
  });

  it('falls back to the English for a rule with no translation', async () => {
    mount();
    await ready();
    expect(await screen.findByText('History')).toBeTruthy();
    expect(screen.getByText('Pages you visited.')).toBeTruthy();
  });

  it('the filter matches the translated text', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText(CACHE_EL);
    await user.type(filterBox(), 'προσωρ');
    expect(screen.getByText(CACHE_EL)).toBeTruthy();
    expect(screen.queryByText('History')).toBeNull();
  });

  it('the filter also matches the English text', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText(CACHE_EL);
    await user.type(filterBox(), 'cache');
    expect(screen.getByText(CACHE_EL)).toBeTruthy();
    expect(screen.queryByText('History')).toBeNull();
  });

  it('the filter matches a translated or an English category name and keeps its rules', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText(CACHE_EL);
    await user.type(filterBox(), 'περιήγησης');
    expect(screen.getByText('History')).toBeTruthy();
    await user.clear(filterBox());
    await user.type(filterBox(), 'brave');
    expect(screen.getByText('History')).toBeTruthy();
  });

  it('the risky-rule warning dialog uses the translated category, name and description', async () => {
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText(CACHE_EL);
    await user.click(screen.getByRole('checkbox', { name: 'Cookies' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog.textContent).toContain(`${BRAVE_EL} — Cookies`);
    expect(dialog.textContent).toContain('Σας αποσυνδέει από κάθε ιστότοπο');
    expect(dialog.textContent).not.toContain('Signs you out');
  });

  it('the scan log names a rule by its translated name', async () => {
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 1 });
      onEvent('rule', { ...rules[0].items[0], present: true, accessible: true, sizeBytes: 2048 });
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText(CACHE_EL);
    await user.click(screen.getAllByRole('button', { name: 'Προεπισκόπηση' })[0]);
    // One in the tree row, one in the log line.
    await waitFor(() => expect(screen.getAllByText(CACHE_EL)).toHaveLength(2));
  });

  it('the clean log names a rule by its translated name', async () => {
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('rule', { id: 'brave_cache', name: 'Cache', freedBytes: 1024, skipped: [] });
      await new Promise(() => {});
    });
    const user = userEvent.setup();
    mount();
    await ready();
    await screen.findByText(CACHE_EL);
    await user.click(screen.getByRole('checkbox', { name: CACHE_EL }));
    await user.click(await screen.findByRole('button', { name: 'Καθαρισμός' }));
    await user.click(screen.getByRole('button', { name: 'Μετακίνηση σε καραντίνα' }));
    expect(await screen.findByText(`Delete ${CACHE_EL}`)).toBeTruthy();
  });
});
