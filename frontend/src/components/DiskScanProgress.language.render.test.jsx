// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { ThemeProvider } from '../hooks/useTheme.jsx';
import { LanguageProvider } from '../i18n/LanguageContext.jsx';
import { makeTestClient } from '../testSupport/renderScreen.jsx';

/** The scan card's own copy follows the chosen language. English is also
 * the fallback every other test renders under, so only a non-English run
 * can show the strings really come from the catalog. The path itself is
 * Windows' own text and stays exactly as reported. */

vi.mock('../lib/api.js', () => ({
  fetchSettings: vi.fn(async () => ({ language: 'el' })),
  updateSettings: vi.fn()
}));

const DiskScanProgress = (await import('./DiskScanProgress.jsx')).default;

afterEach(cleanup);

function mount(props) {
  return render(
    <QueryClientProvider client={makeTestClient()}>
      <ThemeProvider>
        <LanguageProvider>
          <MotionConfig reducedMotion="always">
            <DiskScanProgress {...props} />
          </MotionConfig>
        </LanguageProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

const GB = 1024 ** 3;

describe('the scan card in another language', () => {
  it('says "Scanning C:\\" in Greek, in one element, and labels the bar', async () => {
    mount({ status: 'scanning', path: 'C:\\', percent: null });

    expect(await screen.findByText('Σάρωση του C:\\')).toBeTruthy();
    expect(screen.getByRole('progressbar', { name: 'Πρόοδος σάρωσης' })).toBeTruthy();
  });

  it('keeps both counters animating inside the Greek sentence', async () => {
    mount({ status: 'scanning', path: 'C:\\', percent: null, files: 1200, bytes: 5 * GB });

    await screen.findByText('Σάρωση του C:\\');
    expect(document.body.textContent).toMatch(/1[,.]200 αρχεία σαρώθηκαν · 5 GB επεξεργάστηκαν/);
    expect(screen.getByText(/δεν είναι γνωστό το συνολικό μέγεθος/)).toBeTruthy();
  });

  it('says the index note and the elapsed time in Greek for the fast scan', async () => {
    mount({ status: 'scanning', mode: 'index', path: 'C:\\' });

    expect(await screen.findByText('Χρόνος 00:00')).toBeTruthy();
    expect(screen.getByText(/Τα Windows δεν αναφέρουν πρόοδο/)).toBeTruthy();
  });

  it('says complete, with counts, and offers "Scan again", in Greek', async () => {
    const onScanAgain = vi.fn();
    mount({ status: 'complete', totalFiles: 1500, totalBytes: 2 * GB, onScanAgain });

    expect(await screen.findByText(/^Η σάρωση ολοκληρώθηκε — 1[,.]500 αρχεία, 2 GB$/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Σάρωση ξανά' }));
    expect(onScanAgain).toHaveBeenCalledTimes(1);
  });

  it('says plain complete in Greek when the totals are unknown', async () => {
    mount({ status: 'complete' });

    expect(await screen.findByText('Η σάρωση ολοκληρώθηκε')).toBeTruthy();
  });

  it('offers "Retry" in Greek on an error and calls onRetry', async () => {
    const onRetry = vi.fn();
    mount({ status: 'error', message: 'Αδυναμία σάρωσης', onRetry });

    fireEvent.click(await screen.findByRole('button', { name: 'Δοκιμή ξανά' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('the time-left lines in Greek', () => {
  it('says "up to N s left" for a folder walk, and the stopped-early wording at the limit', async () => {
    mount({ status: 'scanning', path: 'C:\\Users', percent: null, remainingMs: 25_000, remainingAt: Date.now() });

    expect(await screen.findByText(/^Έως 2[45] δευτ\. ακόμη$/)).toBeTruthy();
    cleanup();
    mount({ status: 'complete', truncated: true, totalFiles: 10, totalBytes: 5 * GB });
    expect(await screen.findByText(/^Η σάρωση σταμάτησε πρόωρα — μέχρι τώρα 10 αρχεία, 5 GB$/)).toBeTruthy();
  });

  it('says the fast-scan estimate and the overrun wording in Greek', async () => {
    mount({ status: 'scanning', mode: 'index', path: 'C:\\', expectedMs: 30_000 });

    expect(await screen.findByText(/^Περίπου \d+ δευτ\. ακόμη, με βάση την τελευταία σας σάρωση$/)).toBeTruthy();
    expect(screen.getByText(/αυτή η εκτίμηση είναι η διάρκεια της τελευταίας σας σάρωσης/)).toBeTruthy();
    cleanup();
    mount({ status: 'scanning', mode: 'index', path: 'C:\\', expectedMs: 1000, elapsedMs: 5000 });
    expect(await screen.findByText('Διαρκεί περισσότερο από την τελευταία σας σάρωση')).toBeTruthy();
  });
});

describe('Stop in Greek', () => {
  it('reuses the catalog Stop wording', async () => {
    const onStop = vi.fn();
    mount({ status: 'scanning', path: 'C:\Users', percent: null, onStop });

    fireEvent.click(await screen.findByRole('button', { name: 'Διακοπή' }));
    expect(onStop).toHaveBeenCalledTimes(1);
  });
});
