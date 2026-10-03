import { describe, it, expect } from 'vitest';
import { recommendedPlan } from './recommendedClean.js';

const item = (id, extra = {}) => ({
  id, recommended: true, present: true, accessible: true, sizeBytes: 100, ...extra
});
const tree = (...items) => [{ category: 'Windows', items }];

describe('recommendedPlan', () => {
  it('takes the recommended rules that were measured and have something in them', () => {
    const plan = recommendedPlan(tree(item('a', { sizeBytes: 100 }), item('b', { sizeBytes: 50 })));
    expect(plan.ids).toEqual(['a', 'b']);
    expect(plan.bytes).toBe(150);
    expect(plan.count).toBe(2);
  });

  it('leaves out anything that is not recommended', () => {
    const plan = recommendedPlan(tree(item('a'), item('b', { recommended: false })));
    expect(plan.ids).toEqual(['a']);
  });

  it('never includes a rule that loses data, even one already acknowledged', () => {
    const plan = recommendedPlan(tree(item('a'), item('cookies', { risky: true })));
    expect(plan.ids).toEqual(['a']);
  });

  it('never includes the free-space wipe, which is confirmed every time', () => {
    const plan = recommendedPlan(tree(item('a'), item('wipe', { confirmEveryTime: true })));
    expect(plan.ids).toEqual(['a']);
  });

  it('leaves out rules for software that is not installed or folders Windows will not list', () => {
    const plan = recommendedPlan(tree(
      item('a'), item('gone', { present: false }), item('locked', { accessible: false })
    ));
    expect(plan.ids).toEqual(['a']);
  });

  it('leaves out empty, unmeasured and settled-but-unknown rules', () => {
    const plan = recommendedPlan(tree(
      item('a'),
      item('empty', { sizeBytes: 0 }),
      item('unmeasured', { sizeBytes: null }),
      item('never', { sizeBytes: undefined }),
      item('cleaned', { sizeBytes: null, rescanNeeded: true })
    ));
    expect(plan.ids).toEqual(['a']);
  });

  it('says when any of the sizes came from an earlier scan', () => {
    expect(recommendedPlan(tree(item('a'), item('b', { fromCache: true }))).fromCache).toBe(true);
    expect(recommendedPlan(tree(item('a'))).fromCache).toBe(false);
  });

  it('is empty for no tree at all', () => {
    expect(recommendedPlan(null)).toEqual({ ids: [], bytes: 0, count: 0, fromCache: false });
    expect(recommendedPlan([])).toEqual({ ids: [], bytes: 0, count: 0, fromCache: false });
  });
});
