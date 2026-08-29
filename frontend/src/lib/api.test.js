import { describe, it, expect } from 'vitest';
import { parseSSELine } from './api.js';

describe('parseSSELine', () => {
  it('parses an "event:" line', () => {
    expect(parseSSELine('event: running')).toEqual({ field: 'event', value: 'running' });
  });

  it('parses a "data:" line, trimming exactly one leading space per the SSE spec', () => {
    expect(parseSSELine('data: {"a":1}')).toEqual({ field: 'data', value: '{"a":1}' });
  });

  it('returns null for a blank line (the SSE block separator)', () => {
    expect(parseSSELine('')).toBeNull();
  });

  it('returns null for a line with no recognized field prefix', () => {
    expect(parseSSELine('not a field')).toBeNull();
  });
});
