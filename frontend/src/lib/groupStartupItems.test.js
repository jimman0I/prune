import { describe, it, expect } from 'vitest';
import { groupStartupItems, startupCounts } from './groupStartupItems.js';

const item = (over = {}) => ({ location: 'Run', rawScope: 'user', enabled: true, ...over });

describe('groupStartupItems', () => {
  it('groups by location and scope together', () => {
    // The same key name in the two hives is two different entries with
    // two different answers to "who does this affect".
    const groups = groupStartupItems([
      item({ location: 'Run', rawScope: 'user', name: 'a' }),
      item({ location: 'Run', rawScope: 'machine', name: 'b' })
    ]);
    expect(groups.map((g) => g.label)).toEqual(['Registry: HKCU Run', 'Registry: HKLM Run']);
  });

  it('puts the Startup folders before the Run keys', () => {
    // Those are the ones a person put there by hand.
    const groups = groupStartupItems([
      item({ location: 'RunOnce', rawScope: 'user', name: 'c' }),
      item({ location: 'Run', rawScope: 'user', name: 'b' }),
      item({ location: 'Startup folder', rawScope: 'user', name: 'a' })
    ]);
    expect(groups.map((g) => g.label)).toEqual([
      'Current user Startup folder',
      'Registry: HKCU Run',
      'Registry: HKCU RunOnce'
    ]);
  });

  it('leaves out a location with nothing in it', () => {
    const groups = groupStartupItems([item({ name: 'only' })]);
    expect(groups).toHaveLength(1);
  });

  it('still shows an entry from a location it does not know', () => {
    // Dropping one because its location was unexpected would hide exactly
    // the surprising entries this screen exists to surface.
    const groups = groupStartupItems([item({ location: 'Winlogon Shell', rawScope: 'machine', name: 'odd' })]);
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBe('Winlogon Shell');
    expect(groups[0].items[0].name).toBe('odd');
  });

  it('counts the enabled entries in each group', () => {
    const groups = groupStartupItems([
      item({ name: 'on', enabled: true }),
      item({ name: 'off', enabled: false }),
      item({ name: 'also on', enabled: true })
    ]);
    expect(groups[0].enabledCount).toBe(2);
  });

  it('copes with no list', () => {
    expect(groupStartupItems(null)).toEqual([]);
  });
});

describe('startupCounts', () => {
  it('reports the numbers Revo puts in its status bar', () => {
    const counts = startupCounts([
      item({ enabled: true, running: true, exists: true }),
      item({ enabled: false, running: false, exists: true }),
      item({ enabled: true, running: false, exists: false })
    ]);
    expect(counts).toEqual({ total: 3, enabled: 2, running: 1, broken: 1 });
  });

  it('counts an entry with no enabled flag as enabled', () => {
    // Absence of a record in StartupApproved is what "enabled" looks like,
    // so an item that never got the flag must not read as switched off.
    expect(startupCounts([{ name: 'x' }]).enabled).toBe(1);
  });

  it('copes with no list', () => {
    expect(startupCounts(null)).toEqual({ total: 0, enabled: 0, running: 0, broken: 0 });
  });
});
