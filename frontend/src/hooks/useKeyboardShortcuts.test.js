import { describe, it, expect } from 'vitest';
import { SHORTCUTS } from './useKeyboardShortcuts.js';
import { CATALOG } from '../i18n/catalog.js';

describe('SHORTCUTS', () => {
  it('lists the text-zoom keys the Electron shell restores (electron/zoom.cjs)', () => {
    const inOut = SHORTCUTS.find((s) => s.id === 'zoomInOut');
    expect(inOut.keys).toEqual(['Ctrl', '+']);
    expect(inOut.alternative).toEqual(['Ctrl', '-']);
    expect(SHORTCUTS.find((s) => s.id === 'zoomReset').keys).toEqual(['Ctrl', '0']);
  });

  it('has a label in the English catalog for every entry', () => {
    for (const { id } of SHORTCUTS) {
      expect(CATALOG.en.shortcutsModal.actions[id], id).toEqual(expect.any(String));
    }
  });
});
