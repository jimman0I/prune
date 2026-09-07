import { describe, it, expect } from 'vitest';
import { categorySelectionState, nextCategoryChecked } from './categorySelection.js';

/** The state of a category's own checkbox, from its children.
 *
 * The Deep Clean list groups 74 rules under 29 application headings, and
 * the heading needs to say at a glance whether that whole app is in or
 * out. Two text links ("Select All / Deselect All") said it in words and
 * cost two targets and a read; a single tri-state box says it in one
 * glance and one click, which is what BleachBit's own tree does.
 */

const items = (...ids) => ids.map((id) => ({ id }));

describe('categorySelectionState', () => {
  it('is none when nothing under it is ticked', () => {
    expect(categorySelectionState(items('a', 'b'), new Set())).toBe('none');
  });

  it('is all when every child is ticked', () => {
    expect(categorySelectionState(items('a', 'b'), new Set(['a', 'b']))).toBe('all');
  });

  it('is some when the selection is partial', () => {
    expect(categorySelectionState(items('a', 'b'), new Set(['a']))).toBe('some');
  });

  it('ignores selections belonging to other categories', () => {
    // One flat Set holds the selection for the whole screen, so a rule
    // ticked under Chrome must not make Brave's heading look full.
    expect(categorySelectionState(items('a', 'b'), new Set(['x', 'y']))).toBe('none');
  });

  it('reads an empty category as none rather than as all', () => {
    // Vacuously "every child is ticked" is true of no children, and a
    // heading rendered full while showing nothing is a lie. Hiding
    // uninstalled software can empty a category, so this is reachable.
    expect(categorySelectionState([], new Set())).toBe('none');
    expect(categorySelectionState(null, new Set())).toBe('none');
  });
});

describe('nextCategoryChecked', () => {
  it('fills an empty category', () => {
    expect(nextCategoryChecked('none')).toBe(true);
  });

  it('clears a full one', () => {
    expect(nextCategoryChecked('all')).toBe(false);
  });

  it('clears a partial one rather than filling it', () => {
    // The alternative -- completing the selection -- would silently tick
    // rules the user had deliberately left alone, including risky ones
    // they had already declined. Clearing is the reversible reading of an
    // ambiguous click.
    expect(nextCategoryChecked('some')).toBe(false);
  });
});
