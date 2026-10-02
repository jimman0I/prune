import { describe, it, expect } from 'vitest';
import { traceForProgram } from './installTraces.js';

const traces = [
  { id: 'a', programName: 'Acme', registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme' },
  { id: 'b', programName: 'Acme', registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme2' },
  { id: 'c', programName: 'Portable', registryKey: null }
];

describe('traceForProgram', () => {
  it('matches by the program\'s own registry key, however it is spelled', () => {
    expect(traceForProgram({ registryKey: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\ACME2\\' }, traces).id).toBe('b');
    expect(traceForProgram({ registryKey: 'HKLM:\\software\\microsoft\\windows\\currentversion\\uninstall\\acme' }, traces).id).toBe('a');
  });

  it('does not fall back to the name when the program has a key that matches nothing', () => {
    // Two versions can share a name; the key is what tells them apart.
    expect(traceForProgram({ name: 'Acme', registryKey: 'HKLM:\\SOFTWARE\\Other' }, traces)).toBeNull();
  });

  it('uses the display name only when there is no key', () => {
    expect(traceForProgram({ name: ' portable ' }, traces).id).toBe('c');
    expect(traceForProgram({ name: 'Nothing' }, traces)).toBeNull();
  });

  it('copes with nothing to match', () => {
    expect(traceForProgram(null, traces)).toBeNull();
    expect(traceForProgram({ name: 'Acme' }, [])).toBeNull();
    expect(traceForProgram({ name: 'Acme' }, undefined)).toBeNull();
    expect(traceForProgram({}, traces)).toBeNull();
  });
});
