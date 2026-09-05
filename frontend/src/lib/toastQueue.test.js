import { describe, it, expect } from 'vitest';
import { addToast, dismissToast, expireToasts, MAX_TOASTS } from './toastQueue.js';

const NOW = 1_000_000;

describe('addToast', () => {
  it('adds a toast with an id and a created time', () => {
    const [toast] = addToast([], { message: 'Freed 2.4 GB' }, { now: NOW });
    expect(toast.message).toBe('Freed 2.4 GB');
    expect(toast.id).toBeTruthy();
    expect(toast.createdAt).toBe(NOW);
    expect(toast.count).toBe(1);
  });

  it('puts the newest first', () => {
    let list = addToast([], { message: 'first' }, { now: NOW });
    list = addToast(list, { message: 'second' }, { now: NOW + 10 });
    expect(list.map((t) => t.message)).toEqual(['second', 'first']);
  });

  it('counts a repeat instead of stacking a duplicate', () => {
    // Cleaning twice in a row produces the same sentence twice. Four
    // identical toasts stacked up is noise that hides the one line that
    // might have been different.
    let list = addToast([], { message: 'Skipped 3 locked files' }, { now: NOW });
    list = addToast(list, { message: 'Skipped 3 locked files' }, { now: NOW + 500 });
    expect(list).toHaveLength(1);
    expect(list[0].count).toBe(2);
  });

  it('refreshes the timer when it counts a repeat', () => {
    // Otherwise the second occurrence inherits the first one's remaining
    // life and can vanish almost immediately after being raised.
    let list = addToast([], { message: 'same' }, { now: NOW });
    list = addToast(list, { message: 'same' }, { now: NOW + 3000 });
    expect(list[0].createdAt).toBe(NOW + 3000);
  });

  it('treats a different tone as a different toast', () => {
    // "Cleanup complete" as success and as an error are not the same
    // event even if some caller words them alike.
    let list = addToast([], { message: 'done', tone: 'success' }, { now: NOW });
    list = addToast(list, { message: 'done', tone: 'danger' }, { now: NOW });
    expect(list).toHaveLength(2);
  });

  it('caps the stack and drops the oldest', () => {
    let list = [];
    for (let i = 0; i < MAX_TOASTS + 3; i++) {
      list = addToast(list, { message: `m${i}` }, { now: NOW + i });
    }
    expect(list).toHaveLength(MAX_TOASTS);
    expect(list[0].message).toBe(`m${MAX_TOASTS + 2}`);
    expect(list.some((t) => t.message === 'm0')).toBe(false);
  });

  it('ignores a toast with nothing to say', () => {
    expect(addToast([], { message: '' }, { now: NOW })).toEqual([]);
    expect(addToast([], null, { now: NOW })).toEqual([]);
  });
});

describe('expireToasts', () => {
  it('drops a toast once its time is up', () => {
    const list = addToast([], { message: 'x', ttl: 4000 }, { now: NOW });
    expect(expireToasts(list, NOW + 3999)).toHaveLength(1);
    expect(expireToasts(list, NOW + 4001)).toHaveLength(0);
  });

  it('never expires one that asked to stay', () => {
    // A failure the user has not acknowledged should not disappear on a
    // timer -- that is how someone misses the only notice that three
    // files were not cleaned.
    const list = addToast([], { message: 'failed', ttl: 0 }, { now: NOW });
    expect(expireToasts(list, NOW + 10_000_000)).toHaveLength(1);
  });

  it('returns the same array when nothing expired', () => {
    // Identity matters: a new array every tick re-renders the host and
    // restarts every exit animation underneath it.
    const list = addToast([], { message: 'x', ttl: 4000 }, { now: NOW });
    expect(expireToasts(list, NOW + 1)).toBe(list);
  });
});

describe('dismissToast', () => {
  it('removes just the one', () => {
    let list = addToast([], { message: 'a' }, { now: NOW });
    list = addToast(list, { message: 'b' }, { now: NOW + 1 });
    const after = dismissToast(list, list[0].id);
    expect(after.map((t) => t.message)).toEqual(['a']);
  });

  it('is unbothered by an id that is not there', () => {
    const list = addToast([], { message: 'a' }, { now: NOW });
    expect(dismissToast(list, 'nope')).toBe(list);
  });
});
