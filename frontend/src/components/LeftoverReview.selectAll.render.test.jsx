// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { useState } from 'react';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import LeftoverReview from './LeftoverReview.jsx';

/** Selecting a tier at once, and what happens with nothing ticked at all.
 *
 * With preselect off, review scans of any real size meant one click per
 * item -- 80 leftovers, 80 clicks. Certain and Likely get a one-click
 * "Select all" because the scan already vouches for them; Possible never
 * does, since it is the tier that exists to make someone actually look.
 * And the primary button used to be clickable with nothing ticked at
 * all, closing the dialog exactly like Skip does -- indistinguishable
 * from outside which of the two had just happened.
 */

const scanResult = {
  files: { ok: true, items: [
    { path: 'D:\\Games\\A', sizeBytes: 10, confidence: 'certain' },
    { path: 'D:\\Games\\B', sizeBytes: 20, confidence: 'certain' },
    { path: 'C:\\ProgramData\\ByName', sizeBytes: 5, confidence: 'likely' }
  ] },
  registryKeys: { ok: true, items: [
    { path: 'HKCU\\Software\\Thing', confidence: 'certain' },
    { path: 'HKCU\\Software\\Guess', confidence: 'likely' }
  ] },
  scheduledTasks: { ok: true, items: [
    { name: 'PossibleTask1', confidence: 'possible' },
    { name: 'PossibleTask2', confidence: 'possible' }
  ] }
};

/** A real, stateful selection -- clicking Select all here actually
 * changes what is ticked and re-renders, unlike a bare vi.fn() mock. */
function Controlled({ initial = new Set(), ...props }) {
  const [selected, setSelected] = useState(initial);
  const onToggle = (key) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  return <LeftoverReview scanResult={scanResult} selected={selected} onToggle={onToggle} onConfirm={vi.fn()} onSkip={vi.fn()} {...props} />;
}

const tierSection = (name) => document.querySelector(`section[data-tier="${name}"]`);
const confirmButton = () => screen.getByRole('button', { name: 'Remove selected' });

describe('selecting a whole tier at once', () => {
  it('Certain offers one click for both its groups, and ticks every box in it', async () => {
    const user = userEvent.setup();
    renderScreen(<Controlled />);
    const certain = tierSection('certain');
    await user.click(within(certain).getByRole('button', { name: 'Select all' }));

    const boxes = within(certain).getAllByRole('checkbox');
    expect(boxes).toHaveLength(3); // 2 files + 1 registry key, all in Certain
    for (const box of boxes) expect(box.checked).toBe(true);
    // Likely and Possible are untouched by a click scoped to Certain.
    expect(within(tierSection('likely')).getAllByRole('checkbox').every((b) => !b.checked)).toBe(true);
  });

  it('turns into Clear once everything in the tier is ticked, and clearing empties just that tier', async () => {
    const user = userEvent.setup();
    renderScreen(<Controlled />);
    const likely = tierSection('likely');
    await user.click(within(likely).getByRole('button', { name: 'Select all' }));
    expect(within(likely).getAllByRole('checkbox').every((b) => b.checked)).toBe(true);

    const clear = within(likely).getByRole('button', { name: 'Clear' });
    expect(screen.queryByRole('button', { name: 'Select all', hidden: false })).toBeTruthy(); // Certain still offers it
    await user.click(clear);
    expect(within(likely).getAllByRole('checkbox').every((b) => !b.checked)).toBe(true);
  });

  it('Possible never offers a bulk select -- it has to stay manual', () => {
    renderScreen(<Controlled />);
    const possible = tierSection('possible');
    expect(within(possible).queryByRole('button', { name: 'Select all' })).toBeNull();
    expect(within(possible).queryByRole('button', { name: 'Clear' })).toBeNull();
  });

  it('a read-only group (services) never joins a tier-wide select, and is left unticked', async () => {
    const user = userEvent.setup();
    const withService = {
      ...scanResult,
      services: { ok: true, items: [{ name: 'SomeService', confidence: 'certain' }] }
    };
    renderScreen(<Controlled scanResult={withService} />);
    const certain = tierSection('certain');
    await user.click(within(certain).getByRole('button', { name: 'Select all' }));
    // The service row keeps its checkbox (disabled, unticked) alongside the 3 removable ones.
    const boxes = within(certain).getAllByRole('checkbox');
    expect(boxes).toHaveLength(4);
    const serviceBox = boxes.find((b) => b.disabled);
    expect(serviceBox.checked).toBe(false);
    expect(boxes.filter((b) => !b.disabled).every((b) => b.checked)).toBe(true);
    expect(screen.getByText('SomeService')).toBeTruthy();
  });

  it('a flat, untiered scan gets one select-all for the whole list', async () => {
    const user = userEvent.setup();
    const flat = {
      files: { ok: true, items: [{ path: 'C:\\a', sizeBytes: 1 }, { path: 'C:\\b', sizeBytes: 2 }] },
      registryKeys: { ok: true, items: [] }, scheduledTasks: { ok: true, items: [] }
    };
    renderScreen(<Controlled scanResult={flat} />);
    expect(document.querySelector('section[data-tier]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Select all' }));
    expect(screen.getAllByRole('checkbox').every((b) => b.checked)).toBe(true);
  });

  it('does not offer a bulk control for a tier with only one item', () => {
    const oneEach = {
      files: { ok: true, items: [{ path: 'C:\\a', sizeBytes: 1, confidence: 'certain' }] },
      registryKeys: { ok: true, items: [] },
      scheduledTasks: { ok: true, items: [{ name: 'X', confidence: 'likely' }] }
    };
    renderScreen(<Controlled scanResult={oneEach} />);
    expect(within(tierSection('certain')).queryByRole('button', { name: 'Select all' })).toBeNull();
    expect(within(tierSection('likely')).queryByRole('button', { name: 'Select all' })).toBeNull();
  });
});

describe('with nothing selected at all', () => {
  it('the primary button is disabled, and says what to do instead of silently closing', () => {
    renderScreen(<Controlled />);
    expect(confirmButton().disabled).toBe(true);
    expect(screen.getByText('Tick at least one item above, or Skip.')).toBeTruthy();
    // Skip itself is never disabled -- it is the explicit "do nothing" action.
    expect(screen.getByRole('button', { name: 'Skip' }).disabled).toBe(false);
  });

  it('enables the button the moment one item is ticked, and the count replaces the hint', async () => {
    const user = userEvent.setup();
    renderScreen(<Controlled />);
    const certain = tierSection('certain');
    await user.click(within(certain).getAllByRole('checkbox')[0]);
    expect(confirmButton().disabled).toBe(false);
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.queryByText('Tick at least one item above, or Skip.')).toBeNull();
  });

  it('disables again if the only ticked item is unticked', async () => {
    const user = userEvent.setup();
    renderScreen(<Controlled initial={new Set(['files:0'])} />);
    expect(confirmButton().disabled).toBe(false);
    const certain = tierSection('certain');
    await user.click(within(certain).getAllByRole('checkbox')[0]);
    expect(confirmButton().disabled).toBe(true);
  });

  it('never actually calls onConfirm while disabled, even on a stray click', async () => {
    const onConfirm = vi.fn();
    const user = userEvent.setup();
    renderScreen(<Controlled onConfirm={onConfirm} />);
    await user.click(confirmButton(), { skipPointerEventsCheck: true }).catch(() => {});
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
