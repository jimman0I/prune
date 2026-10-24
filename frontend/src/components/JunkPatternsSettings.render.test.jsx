// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** Settings -> Cleanup -> Junk file patterns: switch one off, remove one, add
 * one (with the backend's refusal said in words), reset to the defaults. */

const fetchJunkPatterns = vi.fn();
const saveJunkPatterns = vi.fn();
const resetJunkPatterns = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchJunkPatterns: (...a) => fetchJunkPatterns(...a),
  saveJunkPatterns: (...a) => saveJunkPatterns(...a),
  resetJunkPatterns: (...a) => resetJunkPatterns(...a),
  fetchSettings: vi.fn(async () => ({})),
  updateSettings: vi.fn(async (p) => p)
}));

const JunkPatternsSettings = (await import('./JunkPatternsSettings.jsx')).default;

const PATTERNS = [
  { pattern: '*.tmp', enabled: true, preselected: true },
  { pattern: '*.old', enabled: true, preselected: false },
  { pattern: '*.bak', enabled: false, preselected: false }
];
const refusal = (reason) => Object.assign(new Error(`refused (${reason})`), { reason });

beforeEach(() => {
  vi.clearAllMocks();
  fetchJunkPatterns.mockResolvedValue({ patterns: PATTERNS, defaults: PATTERNS });
  saveJunkPatterns.mockImplementation(async (patterns) => ({
    patterns: patterns.map((p) => ({ ...p, preselected: p.pattern === '*.tmp' }))
  }));
});

describe('the junk file patterns panel', () => {
  it('lists each pattern with whether it is on, what it is, and whether its results start ticked', async () => {
    renderScreen(<JunkPatternsSettings />);
    const list = await screen.findByRole('list', { name: 'Junk file patterns' });
    expect(within(list).getByRole('checkbox', { name: 'Look for *.tmp' }).checked).toBe(true);
    expect(within(list).getByRole('checkbox', { name: 'Look for *.bak' }).checked).toBe(false);
    expect(within(list).getByText('Backups, often kept on purpose')).toBeTruthy();
    expect(within(list).getAllByText('Ticked by default')).toHaveLength(1);
  });

  it('switches a pattern off without losing it', async () => {
    const user = userEvent.setup();
    renderScreen(<JunkPatternsSettings />);
    await user.click(await screen.findByRole('checkbox', { name: 'Look for *.old' }));
    expect(saveJunkPatterns).toHaveBeenCalledWith([
      { pattern: '*.tmp', enabled: true }, { pattern: '*.old', enabled: false }, { pattern: '*.bak', enabled: false }
    ]);
    expect((await screen.findByRole('checkbox', { name: 'Look for *.old' })).checked).toBe(false);
  });

  it('removes a pattern', async () => {
    const user = userEvent.setup();
    renderScreen(<JunkPatternsSettings />);
    await user.click(await screen.findByRole('button', { name: 'Remove *.bak' }));
    expect(saveJunkPatterns.mock.calls[0][0].map((p) => p.pattern)).toEqual(['*.tmp', '*.old']);
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Look for *.bak' })).toBeNull());
  });

  it('adds a pattern, switched on', async () => {
    const user = userEvent.setup();
    renderScreen(<JunkPatternsSettings />);
    await user.type(await screen.findByLabelText('New junk file pattern'), '*.junk{Enter}');
    expect(saveJunkPatterns.mock.calls[0][0].at(-1)).toEqual({ pattern: '*.junk', enabled: true });
    expect(await screen.findByRole('checkbox', { name: 'Look for *.junk' })).toBeTruthy();
    expect(screen.getByLabelText('New junk file pattern').value).toBe('');
  });

  it('says why a pattern was refused, in words, and keeps what was typed', async () => {
    const user = userEvent.setup();
    renderScreen(<JunkPatternsSettings />);
    const field = await screen.findByLabelText('New junk file pattern');
    for (const [typed, reason, message] of [
      ['*.*', 'everything', 'That would match every file.'],
      ['*.dll', 'executable', 'Programs, libraries, drivers and installers are never junk.'],
      ['desktop.ini', 'desktopIni', 'That would match desktop.ini, which gives a folder its icon and name.']
    ]) {
      saveJunkPatterns.mockRejectedValueOnce(refusal(reason));
      await user.clear(field);
      await user.type(field, `${typed}{Enter}`);
      expect((await screen.findByRole('alert')).textContent).toBe(message);
      expect(field.value).toBe(typed);
    }
  });

  it('asks before a reset would throw away patterns the person added, with Cancel taking focus', async () => {
    const user = userEvent.setup();
    fetchJunkPatterns.mockResolvedValue({ patterns: [...PATTERNS, { pattern: '*.mine', enabled: true, preselected: false }], defaults: PATTERNS });
    resetJunkPatterns.mockResolvedValue({ patterns: PATTERNS });
    renderScreen(<JunkPatternsSettings />);
    await user.click(await screen.findByRole('button', { name: 'Reset to defaults' }));
    expect(resetJunkPatterns).not.toHaveBeenCalled();
    expect(screen.getByText('Replace your list with the defaults? Patterns you added are removed.')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(resetJunkPatterns).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }));
    await user.click(screen.getAllByRole('button', { name: 'Reset to defaults' }).at(-1));
    expect(resetJunkPatterns).toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Look for *.mine' })).toBeNull());
  });

  it('resets to the defaults', async () => {
    const user = userEvent.setup();
    resetJunkPatterns.mockResolvedValue({ patterns: [{ pattern: '*.tmp', enabled: true, preselected: true }] });
    renderScreen(<JunkPatternsSettings />);
    await user.click(await screen.findByRole('button', { name: 'Reset to defaults' }));
    expect(resetJunkPatterns).toHaveBeenCalled();
    await vi.waitFor(() => expect(screen.queryByRole('checkbox', { name: 'Look for *.old' })).toBeNull());
  });
});
