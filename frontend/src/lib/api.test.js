import { parseSSELine } from './api';

describe('parseSSELine', () => {
  it('parses a JSON data line', () => {
    const line = 'data: {"status":"progress","percent":50}';
    expect(parseSSELine(line)).toEqual({ status: 'progress', percent: 50 });
  });

  it('parses a plain text data line', () => {
    const line = 'data: Uninstalling...';
    expect(parseSSELine(line)).toBe('Uninstalling...');
  });

  it('ignores comment lines', () => {
    const line = ': comment line';
    expect(parseSSELine(line)).toBeNull();
  });

  it('returns null for empty lines', () => {
    expect(parseSSELine('')).toBeNull();
  });
});
