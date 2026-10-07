import { describe, it, expect } from 'vitest';
import { startupRemovalTarget } from './startupRemovalTarget.js';

describe('startupRemovalTarget', () => {
  it('removes a dead registry Run value by its key path and value name', () => {
    const item = {
      source: 'registry', exists: false,
      registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
      approvedName: 'SomeOldApp'
    };
    expect(startupRemovalTarget(item)).toEqual({
      files: [],
      registryKeys: [{ path: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'SomeOldApp' }]
    });
  });

  it('removes a dead Startup-folder shortcut by its file path', () => {
    const item = { source: 'folder', exists: false, command: 'C:\\Users\\jim\\Startup\\Old.lnk' };
    expect(startupRemovalTarget(item)).toEqual({ files: ['C:\\Users\\jim\\Startup\\Old.lnk'], registryKeys: [] });
  });

  it('refuses a live entry -- exists true, false only for confirmed-gone', () => {
    expect(startupRemovalTarget({ source: 'registry', exists: true, registryKey: 'k', approvedName: 'n' })).toBeNull();
  });

  it('refuses an entry nothing could check -- exists null', () => {
    expect(startupRemovalTarget({ source: 'registry', exists: null, registryKey: 'k', approvedName: 'n' })).toBeNull();
  });

  it('refuses sources this app cannot write -- task, service, appx, even when dead', () => {
    for (const source of ['task', 'service', 'appx']) {
      expect(startupRemovalTarget({ source, exists: false, registryKey: 'k', approvedName: 'n', command: 'c' })).toBeNull();
    }
  });

  it('refuses a registry entry missing either half of its address', () => {
    expect(startupRemovalTarget({ source: 'registry', exists: false, registryKey: null, approvedName: 'n' })).toBeNull();
    expect(startupRemovalTarget({ source: 'registry', exists: false, registryKey: 'k', approvedName: '' })).toBeNull();
  });

  it('refuses a folder entry missing its file path', () => {
    expect(startupRemovalTarget({ source: 'folder', exists: false, command: '' })).toBeNull();
  });

  it('refuses null/undefined outright', () => {
    expect(startupRemovalTarget(null)).toBeNull();
    expect(startupRemovalTarget(undefined)).toBeNull();
  });
});
