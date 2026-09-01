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
