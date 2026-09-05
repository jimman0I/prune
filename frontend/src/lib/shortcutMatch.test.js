import { describe, it, expect } from 'vitest';
import { matchShortcut } from './shortcutMatch.js';

const press = (key, over = {}) => ({
  key, ctrlKey: false, metaKey: false, shiftKey: false, altKey: false,
  target: { tagName: 'DIV', isContentEditable: false },
  ...over
});

describe('matchShortcut', () => {
  it('finds the search box on Ctrl+K and Ctrl+F', () => {
    expect(matchShortcut(press('k', { ctrlKey: true }))).toBe('search');
    expect(matchShortcut(press('f', { ctrlKey: true }))).toBe('search');
  });

  it('accepts Cmd as well as Ctrl', () => {
    expect(matchShortcut(press('k', { metaKey: true }))).toBe('search');
  });

  it('opens settings on Ctrl+comma', () => {
    expect(matchShortcut(press(',', { ctrlKey: true }))).toBe('settings');
  });

  it('opens the shortcut list on Ctrl+slash', () => {
    expect(matchShortcut(press('/', { ctrlKey: true }))).toBe('help');
    expect(matchShortcut(press('?', { ctrlKey: true, shiftKey: true }))).toBe('help');
  });

  it('ignores the key on its own', () => {
    // Typing "k" into the page must not jump focus to a search box.
    expect(matchShortcut(press('k'))).toBeNull();
    expect(matchShortcut(press(','))).toBeNull();
  });

  it('is not case sensitive', () => {
    // Caps lock, or Shift held from a previous chord.
    expect(matchShortcut(press('K', { ctrlKey: true }))).toBe('search');
  });

  it('stays out of the way while typing in a field', () => {
    // Ctrl+F inside the search box should reach the box, not be swallowed
    // and re-fired at it. And Ctrl+A in a text field is select-all.
    expect(matchShortcut(press('f', { ctrlKey: true, target: { tagName: 'INPUT' } }))).toBeNull();
    expect(matchShortcut(press('k', { ctrlKey: true, target: { tagName: 'TEXTAREA' } }))).toBeNull();
    expect(matchShortcut(press('k', {
      ctrlKey: true, target: { tagName: 'DIV', isContentEditable: true }
    }))).toBeNull();
  });

  it('still opens settings from inside a field', () => {
    // Ctrl+comma means nothing to a text box, so there is nothing to
    // shadow -- and being unable to reach settings because focus happens
    // to sit in the search bar would be its own bug.
    expect(matchShortcut(press(',', { ctrlKey: true, target: { tagName: 'INPUT' } }))).toBe('settings');
  });

  it('ignores a chord with Alt in it', () => {
    // Ctrl+Alt+K is a different chord, and on Windows Ctrl+Alt is how
    // AltGr arrives -- swallowing it breaks typing on many layouts.
    expect(matchShortcut(press('k', { ctrlKey: true, altKey: true }))).toBeNull();
  });

  it('has no opinion about anything else', () => {
    expect(matchShortcut(press('s', { ctrlKey: true }))).toBeNull();
    expect(matchShortcut(null)).toBeNull();
  });
});
