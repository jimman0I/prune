import { describe, it, expect } from 'vitest';
import { applyEnabled, toggleOutcome } from './startupToggleState.js';

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
