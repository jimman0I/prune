import { describe, it, expect } from 'vitest';
import { categoryTickPlan } from './categoryTickPlan.js';

/** What ticking a whole application's checkbox should do.
 *
 * It used to quietly skip every rule that loses data, on the reasoning
 * that a bulk click is the opposite of the deliberate choice the warning
 * exists to capture. Asked for directly, the behaviour is now the one
 * Revo and BleachBit both have: tick everything, and ask about each risky
 * one in turn. The warnings still happen -- they are queued rather than
 * skipped -- so nothing gets selected without being seen.
 */

const items = [
  { id: 'cache', name: 'Cache' },
  { id: 'cookies', name: 'Cookies', risky: true },
  { id: 'history', name: 'History', risky: true },
  { id: 'icons', name: 'Site icons' }
];

describe('categoryTickPlan, ticking on', () => {
  it('selects the safe rules straight away', () => {
    const plan = categoryTickPlan(items, new Set(), []);
    expect(plan.selectNow).toEqual(['cache', 'icons']);
  });

  it('queues every risky rule instead of silently skipping it', () => {
    const plan = categoryTickPlan(items, new Set(), []);
    expect(plan.askAbout.map((i) => i.id)).toEqual(['cookies', 'history']);
  });

  it('asks in the order the rules are listed', () => {
    // The dialogs name a rule each; arriving in a different order from the
    // rows they refer to would make them hard to follow.
    const plan = categoryTickPlan(items, new Set(), []);
    expect(plan.askAbout.map((i) => i.name)).toEqual(['Cookies', 'History']);
  });

  it('does not re-ask about a rule already acknowledged', () => {
    // "Remember my choice" is per rule, and this is the bulk path where
    // honouring it matters most.
    const plan = categoryTickPlan(items, new Set(), ['cookies']);
    expect(plan.selectNow).toEqual(['cache', 'cookies', 'icons']);
    expect(plan.askAbout.map((i) => i.id)).toEqual(['history']);
  });

  it('leaves already-selected rules alone', () => {
    // Including risky ones: a rule that is already ticked must not raise
    // its warning again just because the category was ticked.
    const plan = categoryTickPlan(items, new Set(['cache', 'cookies']), []);
    expect(plan.selectNow).toEqual(['icons']);
    expect(plan.askAbout.map((i) => i.id)).toEqual(['history']);
  });

  it('has nothing to do for an already-full category', () => {
    const plan = categoryTickPlan(items, new Set(['cache', 'cookies', 'history', 'icons']), []);
    expect(plan.selectNow).toEqual([]);
    expect(plan.askAbout).toEqual([]);
  });

  it('survives an empty or missing list', () => {
    expect(categoryTickPlan([], new Set(), [])).toEqual({ selectNow: [], askAbout: [] });
    expect(categoryTickPlan(null, new Set(), null)).toEqual({ selectNow: [], askAbout: [] });
  });

  it('treats a malformed acknowledged list as acknowledging nothing', () => {
    // Same rule cleanWarning.js follows: if the saved list cannot be read,
    // ask again rather than assume consent that may never have been given.
    const plan = categoryTickPlan(items, new Set(), 'not-an-array');
    expect(plan.askAbout.map((i) => i.id)).toEqual(['cookies', 'history']);
  });
});
