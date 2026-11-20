// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

/** The theme choice is mirrored into settings.json (the 4.0 native shell
 * reads it there) while localStorage stays what the first paint uses. */

const updateSettings = vi.fn();
vi.mock('../lib/api.js', () => ({
  updateSettings: (...a) => updateSettings(...a)
}));

const { ThemeProvider, useTheme } = await import('./useTheme.jsx');

function mount() {
  return renderHook(() => useTheme(), { wrapper: ThemeProvider });
}

beforeEach(() => {
  updateSettings.mockReset();
  updateSettings.mockResolvedValue({});
  window.localStorage.clear();
  window.matchMedia = vi.fn(() => ({
    matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn()
  }));
});

describe('useTheme settings sync', () => {
  it('sends the stored choice once on mount', () => {
    window.localStorage.setItem('prune.theme', 'light');
    mount();
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'light', themeSynced: true });
  });

  it('sends System when nothing is stored', () => {
    mount();
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'system', themeSynced: true });
  });

  it('sends each new choice', () => {
    const { result } = mount();
    updateSettings.mockClear();
    act(() => result.current.setChoice('dark'));
    expect(updateSettings).toHaveBeenCalledWith({ theme: 'dark', themeSynced: true });
  });

  it('survives a rejected update and keeps the applied theme', async () => {
    updateSettings.mockRejectedValue(new Error('backend down'));
    window.localStorage.setItem('prune.theme', 'light');
    const { result } = mount();
    await act(async () => { await Promise.resolve(); });
    expect(result.current.theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
