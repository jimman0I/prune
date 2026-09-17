// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

const fetchCookieDomains = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchCookieDomains: (...a) => fetchCookieDomains(...a)
}));

const CookieKeepListSettings = (await import('./CookieKeepListSettings.jsx')).default;

describe('CookieKeepListSettings', () => {
  it('scans, lists domains by count, and ticking one saves it into cookieKeepList', async () => {
    fetchCookieDomains.mockResolvedValue({
      domains: [{ domain: 'example.com', count: 12 }, { domain: 'other.com', count: 3 }],
      errors: []
    });
    const save = vi.fn();
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={save} />);

    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('example.com');

    await user.click(screen.getByRole('checkbox', { name: /example\.com/ }));
    expect(save).toHaveBeenCalledWith({ cookieKeepList: ['example.com'] });
  });

  it('unticks a checked domain, removing it from cookieKeepList', async () => {
    fetchCookieDomains.mockResolvedValue({ domains: [{ domain: 'example.com', count: 5 }], errors: [] });
    const save = vi.fn();
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: ['example.com'] }} save={save} />);

    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('example.com');

    await user.click(screen.getByRole('checkbox', { name: /example\.com/ }));
    expect(save).toHaveBeenCalledWith({ cookieKeepList: [] });
  });

  it('shows a domain already in cookieKeepList but absent from the latest scan as a stale, checked row', async () => {
    fetchCookieDomains.mockResolvedValue({ domains: [{ domain: 'other.com', count: 2 }], errors: [] });
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: ['gone-browser.com'] }} save={vi.fn()} />);

    // Renders even before a scan runs -- the setting isn't invisible.
    expect(screen.getByText('gone-browser.com')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('other.com');
    expect(screen.getByRole('checkbox', { name: /gone-browser\.com/ }).checked).toBe(true);
  });

  it('filters the list by substring as the user types', async () => {
    fetchCookieDomains.mockResolvedValue({
      domains: [{ domain: 'example.com', count: 1 }, { domain: 'other.com', count: 1 }],
      errors: []
    });
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText('example.com');

    await user.type(screen.getByPlaceholderText('Filter domains…'), 'exam');
    expect(screen.getByText('example.com')).toBeTruthy();
    expect(screen.queryByText('other.com')).toBeNull();
  });

  it('shows a non-fatal note when some files could not be read', async () => {
    fetchCookieDomains.mockResolvedValue({
      domains: [{ domain: 'example.com', count: 1 }],
      errors: [{ path: 'C:\\locked\\Cookies', reason: 'could not read cookies: file is locked' }]
    });
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText(/couldn't be read/i);
  });

  it('shows the fetch error when the scan itself fails', async () => {
    fetchCookieDomains.mockRejectedValue(new Error('sqlite3.exe not found'));
    const user = userEvent.setup();
    renderScreen(<CookieKeepListSettings settings={{ cookieKeepList: [] }} save={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Scan for cookies' }));
    await screen.findByText(/sqlite3\.exe not found/);
  });
});
