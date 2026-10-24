import { describe, it, expect } from 'vitest';
import {
  filterStartupItems, invalidRemovalBatch, disabledRemovalBatch, startupExport, startupActionsFor
} from './startupListTools.js';

const discord = {
  id: 'r1', name: 'Discord', source: 'registry', command: '"C:\\Users\\me\\Discord\\Update.exe" --start',
  publisher: 'Discord Inc.', description: 'Discord', location: 'Run', scope: 'This user',
  enabled: true, exists: true, running: true, registryKey: 'HKCU:\\Run', approvedName: 'Discord'
};
const gone = {
  id: 'r2', name: 'OldTool', source: 'registry', command: 'C:\\Gone\\old.exe', publisher: '', description: '',
  location: 'Run', scope: 'All users', enabled: true, exists: false, running: false,
  registryKey: 'HKLM:\\Run', approvedName: 'OldTool'
};
const lnk = {
  id: 'f1', name: 'Dead', source: 'folder', command: 'C:\\Startup\\Dead.lnk', location: 'Startup folder',
  scope: 'This user', enabled: false, exists: false, running: false
};
const task = { id: 't1', name: 'Updater', source: 'task', key: '\\Updater', command: 'C:\\u.exe', location: 'Scheduled task', enabled: true, exists: true, running: false };

describe('filterStartupItems', () => {
  it('matches name, launch path, publisher and description, ignoring case', () => {
    const items = [discord, gone, task];
    expect(filterStartupItems(items, 'discord inc').map((i) => i.id)).toEqual(['r1']);
    expect(filterStartupItems(items, 'GONE\\old').map((i) => i.id)).toEqual(['r2']);
    expect(filterStartupItems(items, 'updater').map((i) => i.id)).toEqual(['t1']);
  });
  it('returns everything for an empty or blank query', () => {
    expect(filterStartupItems([discord, gone], '  ')).toHaveLength(2);
  });
});

describe('invalidRemovalBatch', () => {
  it('gathers every invalid entry Prune can remove into one Quarantine batch', () => {
    const batch = invalidRemovalBatch([discord, gone, lnk, task]);
    expect(batch.ids).toEqual(['r2', 'f1']);
    expect(batch.registryKeys).toEqual([{ path: 'HKLM:\\Run', valueName: 'OldTool' }]);
    expect(batch.files).toEqual(['C:\\Startup\\Dead.lnk']);
  });
  it('is empty when nothing is invalid', () => {
    expect(invalidRemovalBatch([discord, task]).ids).toEqual([]);
  });
});

describe('disabledRemovalBatch', () => {
  const off = { ...discord, id: 'r3', name: 'Helper', enabled: false, running: false, registryKey: 'HKCU:\\Run', approvedName: 'Helper' };
  const offTask = { ...task, id: 't2', enabled: false };

  it('gathers every switched-off entry Prune can remove into one Quarantine batch', () => {
    const batch = disabledRemovalBatch([discord, gone, off, lnk, task, offTask]);
    // The dead shortcut is switched off too, so it belongs to both batches;
    // the switched-off task does not, because nothing here can delete one.
    expect(batch.ids).toEqual(['r3', 'f1']);
    expect(batch.names).toEqual(['Helper', 'Dead']);
    expect(batch.registryKeys).toEqual([{ path: 'HKCU:\\Run', valueName: 'Helper' }]);
    expect(batch.files).toEqual(['C:\\Startup\\Dead.lnk']);
  });
  it('is empty when everything is switched on', () => {
    expect(disabledRemovalBatch([discord, gone, task]).ids).toEqual([]);
  });
});

describe('startupExport', () => {
  const labels = { name: 'Name', command: 'Launch path', publisher: 'Publisher', location: 'Location', status: 'Status', title: 'Startup' };
  const status = (i) => (i.exists === false ? 'Invalid' : i.enabled ? 'On' : 'Off');

  it('writes CSV with a header row and quoted fields', () => {
    const { content, filename, type } = startupExport([discord], 'csv', { labels, status });
    expect(type).toMatch(/text\/csv/);
    expect(filename).toMatch(/\.csv$/);
    const lines = content.trim().split(/\r?\n/);
    expect(lines[0]).toBe('Name,Launch path,Publisher,Location,Status');
    expect(lines[1]).toContain('"""C:\\Users\\me\\Discord\\Update.exe"" --start"');
  });

  it('writes an HTML table that escapes what the entries contain', () => {
    const evil = { ...discord, name: '<script>x</script>' };
    const { content, filename } = startupExport([evil], 'html', { labels, status });
    expect(filename).toMatch(/\.html$/);
    expect(content).toContain('&lt;script&gt;x&lt;/script&gt;');
    expect(content).not.toContain('<script>x');
  });

  it('writes plain text, one block per entry', () => {
    const { content, filename } = startupExport([discord, gone], 'txt', { labels, status });
    expect(filename).toMatch(/\.txt$/);
    expect(content).toContain('Discord');
    expect(content).toContain('Status: Invalid');
  });
});

describe('startupActionsFor', () => {
  it('offers End for a running program and Run for one that is not', () => {
    expect(startupActionsFor(discord)).toContain('end');
    expect(startupActionsFor(discord)).not.toContain('run');
    expect(startupActionsFor(task)).toContain('run');
  });
  it('offers nothing to run or end for an entry whose program is gone, but offers Remove', () => {
    const actions = startupActionsFor(gone);
    expect(actions).not.toContain('run');
    expect(actions).not.toContain('end');
    expect(actions).toContain('remove');
  });
  it('always offers the location and the launch path; the folder only when there is a program on disk', () => {
    expect(startupActionsFor(discord)).toEqual(expect.arrayContaining(['location', 'folder', 'copy']));
    expect(startupActionsFor(gone)).not.toContain('folder');
  });
});
