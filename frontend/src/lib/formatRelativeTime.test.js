import { describe, it, expect } from 'vitest';
import { formatRelativeTime } from './formatRelativeTime.js';

describe('formatRelativeTime', () => {
  it('shows seconds for under a minute', () => {
    expect(formatRelativeTime(Date.now() - 30 * 1000)).toBe('just now');
  });
  it('shows minutes for under an hour', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60 * 1000)).toBe('5 minutes ago');
  });
  it('uses singular "minute" for exactly 1', () => {
    expect(formatRelativeTime(Date.now() - 60 * 1000)).toBe('1 minute ago');
  });
  it('shows hours for under a day', () => {
    expect(formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000)).toBe('3 hours ago');
  });
  it('shows days for a week or less', () => {
    expect(formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000)).toBe('2 days ago');
  });
  it('falls back to a real date beyond a week', () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenDaysAgo)).toBe(new Date(tenDaysAgo).toLocaleDateString());
  });
});

describe('formatRelativeTime in another language', () => {
  it('says it in that language, from the platform locale data', () => {
    const text = formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000, 'de');
    expect(text).toBe(new Intl.RelativeTimeFormat('de', { numeric: 'auto' }).format(-3, 'hour'));
    expect(text).not.toBe('3 hours ago');
  });
  it('has a word for under a minute', () => {
    expect(formatRelativeTime(Date.now() - 5 * 1000, 'fr')).toBe(new Intl.RelativeTimeFormat('fr', { numeric: 'auto' }).format(0, 'second'));
  });
  it('uses a real date in that locale beyond a week', () => {
    const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
    expect(formatRelativeTime(tenDaysAgo, 'de')).toBe(new Date(tenDaysAgo).toLocaleDateString('de'));
  });
  it('stays English for en, and for a code the platform does not know', () => {
    expect(formatRelativeTime(Date.now() - 5 * 60 * 1000, 'en')).toBe('5 minutes ago');
    expect(formatRelativeTime(Date.now() - 5 * 60 * 1000, 'not a locale!!')).toBe('5 minutes ago');
  });
});
