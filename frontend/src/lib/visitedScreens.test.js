import { describe, it, expect } from 'vitest';
import { rememberVisited } from './visitedScreens.js';

describe('rememberVisited', () => {
  it('adds a screen the first time it is opened', () => {
    const next = rememberVisited(new Set(['dashboard']), 'diskmap');
    expect([...next].sort()).toEqual(['dashboard', 'diskmap']);
  });

  it('returns the identical set when the screen is already known', () => {
    // Identity, not equality. This feeds component state, so a fresh Set
    // on every render would set state on every render and spin -- the
    // same shape of bug that already cost this project a render loop.
    const visited = new Set(['dashboard', 'diskmap']);
    expect(rememberVisited(visited, 'diskmap')).toBe(visited);
  });

  it('keeps every screen visited so far', () => {
    let visited = new Set();
    for (const screen of ['dashboard', 'diskmap', 'deepclean', 'dashboard']) {
      visited = rememberVisited(visited, screen);
    }
    expect([...visited].sort()).toEqual(['dashboard', 'deepclean', 'diskmap']);
  });

  it('ignores an empty screen name', () => {
    const visited = new Set(['dashboard']);
    expect(rememberVisited(visited, '')).toBe(visited);
    expect(rememberVisited(visited, null)).toBe(visited);
  });
});
