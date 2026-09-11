// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { makeTestClient } from '../testSupport/renderScreen.jsx';
import { render } from '@testing-library/react';
import { LanguageProvider, useLanguage, translate } from './LanguageContext.jsx';
import { CATALOG } from './catalog.js';

const fetchSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: vi.fn()
}));

/** A tiny consumer, so the provider is exercised through real hook usage
 * rather than by reaching into its internals. */
function Probe() {
  const { language, t } = useLanguage();
  return (
    <>
      <span data-testid="language">{language}</span>
      <span data-testid="nav">{t('nav.dashboard')}</span>
    </>
  );
}

const mount = (client = makeTestClient()) => render(
  <QueryClientProvider client={client}>
    <LanguageProvider><Probe /></LanguageProvider>
  </QueryClientProvider>
);

beforeEach(() => { vi.clearAllMocks(); });

describe('LanguageProvider', () => {
  it('follows settings.language once settings arrive', async () => {
    fetchSettings.mockResolvedValue({ language: 'el' });
    mount();

    // findByTestId resolves the moment the element exists, which is
    // immediately, still showing the English default -- wait for the
    // TEXT to actually change instead.
    expect(await screen.findByText('Πίνακας ελέγχου')).toBeTruthy();
    await waitFor(() => expect(screen.getByTestId('language').textContent).toBe('el'));
  });

  it('is English before settings load, and while they say nothing recognisable', async () => {
    fetchSettings.mockResolvedValue({});
    mount();

    await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
    expect(screen.getByTestId('nav').textContent).toBe('Dashboard');
    expect(screen.getByTestId('language').textContent).toBe('en');
  });

  it('falls back to English for a code the catalog does not have, rather than crash', async () => {
    // Defensive: a future settings.json holding a language this build
    // predates should not blank the whole app. Checks the CONTEXT value
    // too, not just the rendered text -- translate()'s own fallback would
    // still show English text even if `language` itself stayed "xx".
    fetchSettings.mockResolvedValue({ language: 'xx' });
    mount();

    // Not `waitFor(() => expect(fetchSettings).toHaveBeenCalled())`: that
    // condition is already true on waitFor's own first synchronous check
    // -- fetchSettings is called during the very first render -- so it
    // returns before the resolved value has actually reached React state,
    // and the assertions below would only ever see the PENDING fallback
    // ('en'), which happens to be the right answer for THIS test even
    // when broken. A real macrotask tick is what actually lets the
    // already-resolved promise land.
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(screen.getByTestId('nav').textContent).toBe('Dashboard');
    expect(screen.getByTestId('language').textContent).toBe('en');
  });

  it('useLanguage throws outside the provider, same as useTheme and useToasts', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useLanguage must be used inside a LanguageProvider');
    spy.mockRestore();
  });
});

describe('translate', () => {
  // catalog.test.js guarantees every real key exists in every language;
  // these prove the runtime fallback that guarantee makes unreachable
  // today, but which still has to be correct for a translation genuinely
  // still being written. The catalog is mutated in place and restored in
  // a `finally`, since it's one shared module-level object for the whole
  // file's tests.
  it('falls back to English when the given language is missing a key', () => {
    const original = CATALOG.el.nav.dashboard;
    delete CATALOG.el.nav.dashboard;
    try {
      expect(translate('el', 'nav.dashboard')).toBe('Dashboard');
    } finally {
      CATALOG.el.nav.dashboard = original;
    }
  });
});

describe('useLanguage().t with a parameterised entry', () => {
  function Params() {
    const { t } = useLanguage();
    return <span data-testid="out">{t('nav.dashboard', 'Bob')}</span>;
  }

  it('calls a function-valued catalog entry with the arguments given to t()', async () => {
    fetchSettings.mockResolvedValue({});
    const original = CATALOG.en.nav.dashboard;
    CATALOG.en.nav.dashboard = (name) => `Hi ${name}`;
    try {
      render(
        <QueryClientProvider client={makeTestClient()}>
          <LanguageProvider><Params /></LanguageProvider>
        </QueryClientProvider>
      );
      expect((await screen.findByTestId('out')).textContent).toBe('Hi Bob');
    } finally {
      CATALOG.en.nav.dashboard = original;
    }
  });
});
