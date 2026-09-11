import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/** Text selection, for the app as a whole.
 *
 * Off by default, the way a desktop app behaves: dragging across the
 * program list selects rows, it does not highlight every label it passes
 * over. What stays selectable is opted back in element by element (see
 * testSupport/copyable.js), and text boxes keep it unconditionally --
 * without it the cursor cannot select a word in the field being typed in.
 *
 * Read from the stylesheet because that is the only place it exists: the
 * rule is CSS, and jsdom does not apply CSS. */

const css = readFileSync(new URL('./index.css', import.meta.url), 'utf8');

describe('text selection', () => {
  it('is off for the app as a whole', () => {
    expect(css).toMatch(/\nbody\s*\{\s*user-select:\s*none;\s*\}/);
  });

  it('stays on inside text boxes', () => {
    expect(css).toMatch(/\ninput,\s*textarea\s*\{\s*user-select:\s*text;\s*\}/);
  });
});
