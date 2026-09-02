import { describe, it, expect } from 'vitest';
import { mergeMeasuredSizes } from './mergeSizes.js';

const programs = [
  { id: 'a', name: 'Reported', sizeBytes: 1000 },
  { id: 'b', name: 'Blank', sizeBytes: null },
  { id: 'c', name: 'Unmeasurable', sizeBytes: null }
];

describe('mergeMeasuredSizes', () => {
  it('fills in a size the registry did not have', () => {
    const merged = mergeMeasuredSizes(programs, { b: 4096 });
    expect(merged.find(p => p.id === 'b').sizeBytes).toBe(4096);
    expect(merged.find(p => p.id === 'b').sizeMeasured).toBe(true);
  });

  // The registry value is what the installer itself declared. A folder
  // walk can legitimately disagree with it, and silently replacing the
  // declared number with ours would change rows the user has already
  // read for no reason they asked for.
  it('never overwrites a size the registry already reported', () => {
    const merged = mergeMeasuredSizes(programs, { a: 99999 });
    expect(merged.find(p => p.id === 'a').sizeBytes).toBe(1000);
    expect(merged.find(p => p.id === 'a').sizeMeasured).toBeUndefined();
  });

  it('leaves a program with no measurement blank', () => {
    const merged = mergeMeasuredSizes(programs, { b: 10 });
    expect(merged.find(p => p.id === 'c').sizeBytes).toBeNull();
  });

  it('returns the list unchanged when there are no measurements', () => {
    expect(mergeMeasuredSizes(programs, {})).toEqual(programs);
    expect(mergeMeasuredSizes(programs, null)).toEqual(programs);
  });

  it('does not mutate the programs it was given', () => {
    const snapshot = JSON.stringify(programs);
    mergeMeasuredSizes(programs, { b: 500 });
    expect(JSON.stringify(programs)).toBe(snapshot);
  });
});
