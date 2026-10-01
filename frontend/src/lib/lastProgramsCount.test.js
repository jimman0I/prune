import { describe, it, expect, afterEach } from 'vitest';
import { setLastProgramsCount, getLastProgramsCount } from './lastProgramsCount.js';

afterEach(() => setLastProgramsCount(null));

describe('lastProgramsCount', () => {
  it('starts at null (nothing known yet)', () => {
    expect(getLastProgramsCount()).toBeNull();
  });

  it('records a real count, including zero', () => {
    setLastProgramsCount(0);
    expect(getLastProgramsCount()).toBe(0);
  });

  it('records an ordinary count', () => {
    setLastProgramsCount(214);
    expect(getLastProgramsCount()).toBe(214);
  });

  it('ignores a negative number, a non-integer, and NaN -- keeps the last good value', () => {
    setLastProgramsCount(128);
    setLastProgramsCount(-1);
    setLastProgramsCount(1.5);
    setLastProgramsCount(NaN);
    expect(getLastProgramsCount()).toBe(128);
  });

  it('can be reset back to null explicitly', () => {
    setLastProgramsCount(5);
    setLastProgramsCount(null);
    expect(getLastProgramsCount()).toBeNull();
  });
});
