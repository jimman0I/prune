import { describe, it, expect } from 'vitest';
import { normalizeStartupItem, attachEnabledState } from './startupItems.js';

const base = {
  name: 'KeePassXC',
  command: '"C:\\Program Files\\KeePassXC\\KeePassXC.exe"',
  scope: 'user',
  location: 'Run',
  source: 'registry',
  registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'
};

describe('normalizeStartupItem', () => {
  it('pulls the executable out of a quoted command', () => {
    expect(normalizeStartupItem(base).executable).toBe('C:\\Program Files\\KeePassXC\\KeePassXC.exe');
  });

  it('pulls it out of an unquoted command with arguments', () => {
    // The same shape the uninstall strings have, read with the same
    // parser: cut at the first switch, not the first space, or
    // "C:\Program Files\..." truncates to "C:\Program".
    const item = normalizeStartupItem({
      ...base,
      command: 'C:\\Program Files (x86)\\Dropbox\\Client\\Dropbox.exe /systemstartup'
    });
    expect(item.executable).toBe('C:\\Program Files (x86)\\Dropbox\\Client\\Dropbox.exe');
  });

  it('reports a missing file as broken', () => {
    const item = normalizeStartupItem({ ...base, command: 'C:\\nope\\not-here\\ghost.exe' });
    expect(item.exists).toBe(false);
  });

  // The reason this list is worth having next to an uninstaller: a program
  // removed carelessly leaves its Run key behind, and Windows goes on
  // trying to launch a file that is not there at every sign-in.
  it('reports a file that is really there as present', () => {
    const item = normalizeStartupItem({ ...base, command: process.execPath });
    expect(item.exists).toBe(true);
  });

  it('says nothing rather than guessing about a PATH command', () => {
    // Resolved through PATH at launch, so "does this file exist" has no
    // answer -- the same distinction programHealth.js already draws.
    expect(normalizeStartupItem({ ...base, command: 'notepad.exe' }).exists).toBeNull();
  });

  it('marks a Startup-folder shortcut', () => {
    const item = normalizeStartupItem({
      ...base,
      command: 'C:\\Users\\x\\Start Menu\\Programs\\Startup\\Thing.lnk',
      source: 'folder',
      location: 'Startup folder'
    });
    expect(item.isShortcut).toBe(true);
  });

  it('names the scope in words a reader can use', () => {
    expect(normalizeStartupItem({ ...base, scope: 'machine' }).scope).toBe('All users');
    expect(normalizeStartupItem({ ...base, scope: 'user' }).scope).toBe('This user');
  });

  it('gives every entry a key unique across the places it can come from', () => {
    // The same name legitimately appears in the machine and user hives --
    // Discord is in both on this machine -- and they are different
    // entries that must not collapse into one row.
    const machine = normalizeStartupItem({ ...base, name: 'Discord', scope: 'machine' });
    const user = normalizeStartupItem({ ...base, name: 'Discord', scope: 'user' });
    expect(machine.id).not.toBe(user.id);
  });

  it('refuses an entry with nothing in it', () => {
    expect(normalizeStartupItem({ ...base, command: '   ' })).toBeNull();
    expect(normalizeStartupItem({ ...base, name: '' })).toBeNull();
    expect(normalizeStartupItem(null)).toBeNull();
  });
});

describe('attachEnabledState', () => {
  const entry = (over = {}) => ({
    name: 'Discord',
    approvedName: 'Discord',
    source: 'registry',
    location: 'Run',
    rawScope: 'user',
    registryKey: 'HKCU:\SOFTWARE\Microsoft\Windows\CurrentVersion\Run',
    ...over
  });

  it('reads an entry Windows has switched off as disabled', () => {
    const [item] = attachEnabledState([entry()], { 'user|Run|Discord': [3, 0, 0, 0] });
    expect(item.enabled).toBe(false);
  });

  it('reads an entry Windows has no record of as enabled', () => {
    expect(attachEnabledState([entry()], {})[0].enabled).toBe(true);
    expect(attachEnabledState([entry()], null)[0].enabled).toBe(true);
  });

  it('leaves no note on an entry the user can switch', () => {
    // The note IS the disabled reason for the control. Present means the
    // checkbox must not be a checkbox.
    expect(attachEnabledState([entry()], {})[0].toggleNote).toBeNull();
  });

  it('notes why a RunOnce entry has no switch', () => {
    const [item] = attachEnabledState([entry({ location: 'RunOnce' })], {});
    expect(item.toggleNote).toMatch(/RunOnce/);
    // And it still reads as enabled, because Windows does run it.
    expect(item.enabled).toBe(true);
  });
});
