import { describe, it, expect } from 'vitest';
import { sizeBadgeTone } from './sizeBadgeTone.js';

describe('sizeBadgeTone', () => {
  it('is cyan under 100MB', () => {
    expect(sizeBadgeTone(50 * 1024 * 1024)).toBe('cyan');
  });
  it('is blue from 100MB up to (not including) 1GB', () => {
    expect(sizeBadgeTone(100 * 1024 * 1024)).toBe('blue');
    expect(sizeBadgeTone(500 * 1024 * 1024)).toBe('blue');
  });
  it('is amber from 1GB up to (not including) 5GB', () => {
    expect(sizeBadgeTone(1024 * 1024 * 1024)).toBe('amber');
    expect(sizeBadgeTone(3 * 1024 * 1024 * 1024)).toBe('amber');
  });
  it('is coral at 5GB and above', () => {
    expect(sizeBadgeTone(5 * 1024 * 1024 * 1024)).toBe('coral');
    expect(sizeBadgeTone(40 * 1024 * 1024 * 1024)).toBe('coral');
  });
  it('is cyan for null/undefined/zero (unknown size)', () => {
    expect(sizeBadgeTone(null)).toBe('cyan');
    expect(sizeBadgeTone(undefined)).toBe('cyan');
    expect(sizeBadgeTone(0)).toBe('cyan');
  });
});
