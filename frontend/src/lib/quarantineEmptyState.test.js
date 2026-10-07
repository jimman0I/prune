import { describe, it, expect } from 'vitest';
import { quarantineEmptyBodyKey } from './quarantineEmptyState.js';

describe('quarantineEmptyBodyKey', () => {
  it('says both land here on the reversible defaults', () => {
    expect(quarantineEmptyBodyKey({})).toBe('quarantine.empty.bodyBoth');
    expect(quarantineEmptyBodyKey({ deepCleanRemoval: 'quarantine', leftoverDestination: 'quarantine' })).toBe('quarantine.empty.bodyBoth');
    // undefined settings fall back to the reversible default for both -- same as before
    expect(quarantineEmptyBodyKey(undefined)).toBe('quarantine.empty.bodyBoth');
  });

  it('says only uninstalls land here once Delete now is on (Deep Clean no longer quarantines)', () => {
    expect(quarantineEmptyBodyKey({ deepCleanRemoval: 'delete' })).toBe('quarantine.empty.bodyUninstallOnly');
  });

  it('says only uninstalls land here once Auto-Quarantine is off (Deep Clean goes to the Recycle Bin instead)', () => {
    expect(quarantineEmptyBodyKey({ autoQuarantine: false })).toBe('quarantine.empty.bodyUninstallOnly');
  });

  it('says only Deep Clean lands here when the leftover destination is the Recycle Bin or permanent', () => {
    expect(quarantineEmptyBodyKey({ leftoverDestination: 'recycle' })).toBe('quarantine.empty.bodyDeepCleanOnly');
    expect(quarantineEmptyBodyKey({ leftoverDestination: 'permanent' })).toBe('quarantine.empty.bodyDeepCleanOnly');
  });

  it('says nothing lands here when both are set away from Quarantine', () => {
    expect(quarantineEmptyBodyKey({ deepCleanRemoval: 'delete', leftoverDestination: 'permanent' })).toBe('quarantine.empty.bodyNeither');
    expect(quarantineEmptyBodyKey({ autoQuarantine: false, leftoverDestination: 'recycle' })).toBe('quarantine.empty.bodyNeither');
  });

  it('Delete now always wins over Auto-Quarantine for Deep Clean\'s own half of the question', () => {
    expect(quarantineEmptyBodyKey({ deepCleanRemoval: 'delete', autoQuarantine: false })).toBe('quarantine.empty.bodyUninstallOnly');
  });
});
