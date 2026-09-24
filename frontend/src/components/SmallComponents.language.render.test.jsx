// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Five small, otherwise-untested-for-language components share one file:
 * ResourceMonitor, ShortcutsModal (+ useKeyboardShortcuts.js's SHORTCUTS
 * labels), ThemeToggle, ToastHost, UpdateButton. None is large enough to
 * warrant its own language file, and all five follow the same shape --
 * mock fetchSettings to answer Greek, render, and check the Greek text
 * that only a translated catalog produces (never English, which is also
 * the fallback these components render under when a key is missing). */

const fetchSettings = vi.fn();
const fetchResources = vi.fn();
const fetchUpdateCheck = vi.fn();
const openUpdatePage = vi.fn(async () => ({ ok: true }));
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn(async (partial) => partial),
  fetchResources: (...a) => fetchResources(...a),
  fetchUpdateCheck: (...a) => fetchUpdateCheck(...a),
  openUpdatePage: (...a) => openUpdatePage(...a)
}));

const ResourceMonitor = (await import('./ResourceMonitor.jsx')).default;
const ShortcutsModal = (await import('./ShortcutsModal.jsx')).default;
const ThemeToggle = (await import('./ThemeToggle.jsx')).default;
const ToastHost = (await import('./ToastHost.jsx')).default;
const { useToasts } = await import('../hooks/useToasts.jsx');
const UpdateButton = (await import('./UpdateButton.jsx')).default;

beforeEach(() => {
  vi.clearAllMocks();
  fetchSettings.mockResolvedValue({ language: 'el' });
});

describe('ResourceMonitor in Greek', () => {
  it('renders every label and the core count in Greek', async () => {
    fetchResources.mockResolvedValue({
      cpuPercent: 12, cores: 8,
      ram: { percent: 40, usedBytes: 4 * 1024 ** 3, totalBytes: 16 * 1024 ** 3 },
      diskBytesPerSec: 1024
    });
    renderScreen(<ResourceMonitor />);

    expect(await screen.findByText('Αυτή τη στιγμή')).toBeTruthy();
    expect(screen.getByText('8 πυρήνες')).toBeTruthy();
    expect(screen.getByText('CPU')).toBeTruthy();
    expect(screen.getByText('Μνήμη')).toBeTruthy();
    expect(screen.getByText('Δίσκος')).toBeTruthy();
    expect(screen.getByText(/Μια σάρωση διαβάζει ολόκληρο τον δίσκο/)).toBeTruthy();
  });
});

describe('ShortcutsModal in Greek', () => {
  it('renders the title, close button, actions and footer in Greek', async () => {
    renderScreen(<ShortcutsModal onClose={() => {}} />);

    expect(await screen.findByRole('heading', { name: 'Συντομεύσεις πληκτρολογίου' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Κλείσιμο' })).toBeTruthy();
    expect(screen.getByText('Εστίαση στο πλαίσιο αναζήτησης')).toBeTruthy();
    expect(screen.getByText('Άνοιγμα Ρυθμίσεων')).toBeTruthy();
    expect(screen.getByText('Εμφάνιση αυτής της λίστας')).toBeTruthy();
    expect(screen.getByText('Κλείσιμο ενός παραθύρου διαλόγου')).toBeTruthy();
    expect(screen.getByText(/Μετακίνηση μεταξύ στοιχείων ελέγχου/)).toBeTruthy();
    expect(screen.getByText('Μεγέθυνση ή σμίκρυνση κειμένου')).toBeTruthy();
    expect(screen.getByText('Επαναφορά μεγέθους κειμένου')).toBeTruthy();
    expect(screen.getAllByText('ή').length).toBeGreaterThan(0);
    expect(screen.getByText('Μετάβαση σε οθόνη, με τη σειρά της πλαϊνής γραμμής')).toBeTruthy();
    expect(screen.getByText(/Μια συντόμευση αγνοείται ενώ πληκτρολογείτε/)).toBeTruthy();
    expect(screen.queryByText(/Cmd/)).toBeNull();
  });
});

describe('ThemeToggle in Greek', () => {
  const listeners = new Set();
  let systemDark = false;
  const stubMatchMedia = () => {
    window.matchMedia = (query) => ({
      matches: query.includes('dark') ? systemDark : !systemDark,
      media: query,
      addEventListener: (_, fn) => listeners.add(fn),
      removeEventListener: (_, fn) => listeners.delete(fn),
      addListener: () => {},
      removeListener: () => {}
    });
  };
  beforeEach(() => {
    listeners.clear();
    systemDark = true;
    stubMatchMedia();
    window.localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
  });

  it('names the theme it will switch TO, in Greek, and updates after a click', async () => {
    renderScreen(<ThemeToggle />);

    const button = await screen.findByRole('button', { name: 'Εναλλαγή σε ανοιχτόχρωμο θέμα' });

    const user = userEvent.setup();
    await user.click(button);
    expect(await screen.findByRole('button', { name: 'Εναλλαγή σε σκοτεινό θέμα' })).toBeTruthy();
  });
});

describe('ToastHost in Greek', () => {
  function Push({ message }) {
    const toasts = useToasts();
    return <button type="button" onClick={() => toasts.info(message)}>push</button>;
  }

  it('labels its dismiss button in Greek', async () => {
    renderScreen(
      <>
        <Push message="done" />
        <ToastHost />
      </>
    );
    const user = userEvent.setup();
    await user.click(await screen.findByText('push'));

    expect(await screen.findByLabelText('Απόρριψη ειδοποίησης')).toBeTruthy();
  });
});

describe('UpdateButton in Greek', () => {
  const newer = { enabled: true, current: '2.4.1', latest: '2.5.0', newer: true, url: 'https://example.test' };

  function fakeBridge() {
    let listener = null;
    return {
      prepare: vi.fn(async (version) => ({ version })),
      install: vi.fn(async () => {}),
      setInstallOnQuit: vi.fn(async () => {}),
      onProgress: vi.fn((callback) => { listener = callback; return () => { listener = null; }; }),
      emitProgress: (percent) => listener?.(percent)
    };
  }

  let bridge;
  beforeEach(() => {
    fetchSettings.mockResolvedValue({ language: 'el', updateCheck: true, autoInstallUpdates: false });
    fetchUpdateCheck.mockResolvedValue(newer);
    bridge = fakeBridge();
    window.pruneWindow = { updates: bridge };
  });
  afterEach(() => { delete window.pruneWindow; });

  it('labels the button in Greek, including the idle tooltip, and shows a Greek error panel on failure', async () => {
    bridge.prepare.mockRejectedValueOnce(new Error('boom'));
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);

    const button = await screen.findByRole('button', { name: 'Ενημέρωση στο Prune 2.5.0' });
    // The hover tooltip's short form, present (aria-hidden) at idle.
    expect(screen.getByText('Ενημέρωση στο 2.5.0')).toBeTruthy();

    await user.click(button);

    expect(await screen.findByText("Αδυναμία ενημέρωσης στο 2.5.0")).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Άνοιγμα σελίδας λήψης' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Δοκιμάστε ξανά' })).toBeTruthy();
  });

  it('shows a Greek download-progress label and a Greek restart label once ready', async () => {
    let finish;
    bridge.prepare.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const user = userEvent.setup();
    renderScreen(<UpdateButton />);

    const button = await screen.findByRole('button', { name: 'Ενημέρωση στο Prune 2.5.0' });
    await user.click(button);

    expect(screen.getByLabelText('Πρόοδος λήψης')).toBeTruthy();

    await act(async () => { finish({ version: '2.5.0' }); });
    expect(await screen.findByText('Επανεκκίνηση…')).toBeTruthy();
  });

  it('turns into a Greek restart label, tooltip included, once auto-downloaded', async () => {
    fetchSettings.mockResolvedValue({ language: 'el', updateCheck: true, autoInstallUpdates: true });
    renderScreen(<UpdateButton />);

    const button = await screen.findByRole('button', { name: 'Επανεκκίνηση για ενημέρωση στο Prune 2.5.0' });
    expect(screen.getByText('Επανεκκίνηση για ενημέρωση στο 2.5.0')).toBeTruthy();
    expect(button).toBeTruthy();
  });
});
