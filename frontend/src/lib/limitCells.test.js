import { describe, it, expect } from 'vitest';
import { limitCells, AGGREGATE_NAME_PREFIX } from './limitCells.js';

const cell = (name, size) => ({ name, size, type: 'file' });

describe('limitCells', () => {
  it('leaves a small list alone', () => {
    const cells = [cell('a', 3), cell('b', 2), cell('c', 1)];
    expect(limitCells(cells, 10)).toEqual(cells);
  });

  it('keeps the largest cells and aggregates the rest', () => {
    const cells = [cell('big', 100), cell('mid', 50), cell('t1', 3), cell('t2', 2), cell('t3', 1)];
    const result = limitCells(cells, 2);
    expect(result.map(c => c.name).slice(0, 2)).toEqual(['big', 'mid']);
    expect(result[2].name).toBe(`3 ${AGGREGATE_NAME_PREFIX}`);
    expect(result[2].size).toBe(6);
  });

  it('names the aggregate with how many entries it stands for', () => {
    const cells = Array.from({ length: 500 }, (_, i) => cell(`f${i}`, 1));
    const result = limitCells(cells, 100);
    expect(result).toHaveLength(101);
    expect(result[100].name).toMatch(/400/);
  });

  // Every byte still has to be somewhere. A treemap that quietly drops
  // the tail understates the folder it is describing.
  it('preserves the total size exactly', () => {
    const cells = Array.from({ length: 300 }, (_, i) => cell(`f${i}`, i + 1));
    const before = cells.reduce((s, c) => s + c.size, 0);
    const after = limitCells(cells, 50).reduce((s, c) => s + c.size, 0);
    expect(after).toBe(before);
  });

  // It is not a folder and has no path, so it must not look clickable or
  // claim a location the way a real cell does.
  it('marks the aggregate as not drillable', () => {
    const cells = Array.from({ length: 20 }, (_, i) => cell(`f${i}`, 1));
    const aggregate = limitCells(cells, 5).at(-1);
    expect(aggregate.fullPath).toBeUndefined();
    expect(aggregate.aggregated).toBe(true);
  });

  it('does not aggregate a single leftover cell into a one-item group', () => {
    // Drawing "1 smaller item" instead of just drawing the item is worse
    // in every way.
    const cells = [cell('a', 5), cell('b', 4), cell('c', 3)];
    expect(limitCells(cells, 2).map(c => c.name)).toEqual(['a', 'b', 'c']);
  });

  it('handles an empty or missing list', () => {
    expect(limitCells([], 10)).toEqual([]);
    expect(limitCells(null, 10)).toEqual([]);
  });
});
