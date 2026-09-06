import { describe, it, expect } from 'vitest';
import { applyEnabled, toggleOutcome, enabledStateOf } from './startupToggleState.js';

const items = [
  { id: 'registry:user:Run:Discord', name: 'Discord', enabled: true },
  { id: 'registry:machine:Run:Discord', name: 'Discord', enabled: true },
  { id: 'folder:user:Startup folder:Peace', name: 'Peace', enabled: false }
];

describe('applyEnabled', () => {
  it('changes only the entry that was clicked', () => {
    // The same name legitimately appears in both hives -- Discord is in
    // both on this machine -- so matching on anything but the id switches
    // off a program the user did not touch.
    const next = applyEnabled(items, 'registry:user:Run:Discord', false);
    expect(next[0].enabled).toBe(false);
    expect(next[1].enabled).toBe(true);
    expect(next[2].enabled).toBe(false);
  });

  it('leaves the list alone when the id is not in it', () => {
    expect(applyEnabled(items, 'nothing', false)).toEqual(items);
  });

  it('copes with no list at all', () => {
    expect(applyEnabled(null, 'x', true)).toEqual([]);
  });

  it('does not mutate the list it was given', () => {
    // The rows are rendered from this array; mutating it in place means a
    // failed toggle has nothing left to roll back to.
    const before = JSON.parse(JSON.stringify(items));
    applyEnabled(items, 'registry:user:Run:Discord', false);
    expect(items).toEqual(before);
  });
});

describe('toggleOutcome', () => {
  it('keeps the new state when the machine agrees', () => {
    expect(toggleOutcome({ ok: true, enabled: false }, false))
      .toEqual({ revert: false, message: null });
  });

  it('rolls back and says nothing when the user declines the UAC prompt', () => {
    // Declining is a decision, not a failure. An error banner for it reads
    // as something having gone wrong, and the row snapping back is already
    // the whole message.
    expect(toggleOutcome({ ok: false, cancelled: true }, false))
      .toEqual({ revert: true, message: null });
  });

  it('rolls back and shows the reason when the change failed', () => {
    const outcome = toggleOutcome({ ok: false, error: 'Access is denied.' }, false);
    expect(outcome.revert).toBe(true);
    expect(outcome.message).toContain('Access is denied.');
  });

  it('rolls back when the machine reports a state nobody asked for', () => {
    // ok: true with the wrong state is the case the backend's read-back
    // exists to catch; the row must follow the machine, not the click.
    const outcome = toggleOutcome({ ok: true, enabled: true }, false);
    expect(outcome.revert).toBe(true);
    expect(outcome.message).toBeTruthy();
  });

  it('rolls back when the request never produced a result', () => {
    expect(toggleOutcome(null, false).revert).toBe(true);
    expect(toggleOutcome(undefined, true).message).toBeTruthy();
  });
});

describe('enabledStateOf', () => {
  const items = [
    { id: 'a', name: 'Discord', enabled: true },
    { id: 'b', name: 'Discord', enabled: false }
  ];

  it('reads one entry state by id', () => {
    expect(enabledStateOf(items, 'a')).toBe(true);
    expect(enabledStateOf(items, 'b')).toBe(false);
  });

  it('is null for an entry that is not there', () => {
    // Distinct from false. A row that has since left the list must not
    // roll back to "disabled" -- there is nothing to roll back to, and
    // writing false would invent a state the machine never reported.
    expect(enabledStateOf(items, 'gone')).toBeNull();
    expect(enabledStateOf(null, 'a')).toBeNull();
    expect(enabledStateOf(undefined, 'a')).toBeNull();
  });

  it('is null when the entry never recorded a state', () => {
    expect(enabledStateOf([{ id: 'c', name: 'Thing' }], 'c')).toBeNull();
  });
});

describe('rolling back one row rather than guessing its inverse', () => {
  // The bug: onSettled reverted with applyEnabled(current, id, !requested),
  // which is only right when the row's prior state was exactly the
  // opposite of what was asked. Two fast clicks on one row break that --
  // the second rollback writes a value the row never had.
  it('restores what the row actually was, across two interleaved toggles', () => {
    const original = [{ id: 'a', name: 'Discord', enabled: false }];

    // Click 1 turns it on optimistically; click 2 turns it back off.
    const afterFirst = applyEnabled(original, 'a', true);
    const afterSecond = applyEnabled(afterFirst, 'a', false);

    // Both fail. Reverting by the inverse of each request lands wrong:
    // the second rollback asks for !false = true, a state the row was
    // never in before either click.
    const byInverse = applyEnabled(applyEnabled(afterSecond, 'a', false), 'a', true);
    expect(enabledStateOf(byInverse, 'a')).toBe(true);
    expect(enabledStateOf(byInverse, 'a')).not.toBe(enabledStateOf(original, 'a'));

    // Reverting each to the state captured before its own mutation lands
    // back where the machine actually was.
    const byCapture = applyEnabled(
      applyEnabled(afterSecond, 'a', enabledStateOf(afterFirst, 'a')),
      'a',
      enabledStateOf(original, 'a')
    );
    expect(enabledStateOf(byCapture, 'a')).toBe(false);
    expect(enabledStateOf(byCapture, 'a')).toBe(enabledStateOf(original, 'a'));
  });
});
