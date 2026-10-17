import { describe, it, expect, vi } from 'vitest';
import {
  locationPlan, regeditPath, processPlan, validateNewEntry, buildAddEntryScript, addStartupEntry
} from './startupActions.js';

const runEntry = {
  source: 'registry', rawScope: 'user', name: 'Discord',
  registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  command: '"C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe" --processStart Discord.exe',
  executable: 'C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe'
};

describe('regeditPath', () => {
  it('spells a PowerShell drive path the way Registry Editor remembers it', () => {
    expect(regeditPath('HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'))
      .toBe('Computer\\HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run');
    expect(regeditPath('HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'))
      .toBe('Computer\\HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run');
  });
  it('refuses anything that is not a key in one of those two hives', () => {
    expect(regeditPath('C:\\Windows')).toBeNull();
    expect(regeditPath('')).toBeNull();
  });
});

describe('locationPlan', () => {
  it('opens Registry Editor at a Run value\'s key', () => {
    expect(locationPlan(runEntry)).toEqual({ kind: 'regedit', key: 'Computer\\HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run' });
  });
  it('shows a Startup-folder shortcut selected in Explorer', () => {
    const lnk = 'C:\\Users\\me\\AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\FxSound.lnk';
    expect(locationPlan({ source: 'folder', command: lnk, executable: lnk })).toEqual({ kind: 'reveal', path: lnk });
  });
  it('opens the console that owns a task, a service or a Store app\'s startup task', () => {
    expect(locationPlan({ source: 'task' })).toEqual({ kind: 'open', target: 'taskschd.msc' });
    expect(locationPlan({ source: 'service' })).toEqual({ kind: 'open', target: 'services.msc' });
    expect(locationPlan({ source: 'appx' })).toEqual({ kind: 'open', target: 'ms-settings:startupapps' });
  });
});

describe('processPlan', () => {
  it('runs a Run entry\'s own command line, as sign-in would', () => {
    expect(processPlan(runEntry, 'run')).toEqual({ kind: 'start', file: 'C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe', args: '--processStart Discord.exe' });
  });
  it('ends the processes running from the entry\'s executable', () => {
    expect(processPlan(runEntry, 'end')).toEqual({ kind: 'stop', executable: 'C:\\Users\\me\\AppData\\Local\\Discord\\Update.exe' });
  });
  it('starts and stops a task or a service through Windows itself', () => {
    expect(processPlan({ source: 'task', key: '\\Vendor\\Updater' }, 'run')).toEqual({ kind: 'task', key: '\\Vendor\\Updater', action: 'run' });
    expect(processPlan({ source: 'service', key: 'AcmeSvc' }, 'end')).toEqual({ kind: 'service', key: 'AcmeSvc', action: 'end', elevated: true });
  });
  it('has nothing to do for an entry whose program is gone, or an unknown action', () => {
    expect(processPlan({ ...runEntry, exists: false }, 'run')).toBeNull();
    expect(processPlan(runEntry, 'format')).toBeNull();
    expect(processPlan({ source: 'appx' }, 'run')).toBeNull();
  });
});

describe('validateNewEntry', () => {
  const ok = { name: 'Acme Tray', command: 'C:\\Windows\\notepad.exe', scope: 'user', kind: 'run' };
  it('accepts a complete entry whose program exists', () => {
    expect(validateNewEntry(ok)).toBeNull();
    expect(validateNewEntry({ ...ok, command: '"C:\\Windows\\notepad.exe" /A' })).toBeNull();
  });
  it('says what is wrong, in words a person can act on', () => {
    expect(validateNewEntry({ ...ok, name: '  ' })).toMatch(/name/i);
    expect(validateNewEntry({ ...ok, name: 'a\\b' })).toMatch(/name/i);
    expect(validateNewEntry({ ...ok, command: 'C:\\nope\\gone.exe' })).toMatch(/not found|no file/i);
    expect(validateNewEntry({ ...ok, scope: 'everyone' })).toBeTruthy();
    expect(validateNewEntry({ ...ok, kind: 'service' })).toBeTruthy();
  });
});

describe('buildAddEntryScript', () => {
  it('writes a Run or RunOnce value into the right hive, quoting what it was given', () => {
    const user = buildAddEntryScript({ name: "O'Brien", command: 'C:\\Windows\\notepad.exe', scope: 'user', kind: 'runonce' });
    expect(user).toContain("'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'");
    expect(user).toContain("'O''Brien'");
    const machine = buildAddEntryScript({ name: 'Acme', command: 'C:\\Windows\\notepad.exe', scope: 'machine', kind: 'run' });
    expect(machine).toContain("'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'");
  });
  it('makes a shortcut in the right Startup folder', () => {
    const script = buildAddEntryScript({ name: 'Acme', command: '"C:\\Windows\\notepad.exe" /A', scope: 'user', kind: 'folder' });
    expect(script).toContain('CreateShortcut');
    expect(script).toContain("$env:APPDATA");
    expect(script).toContain("'/A'");
  });
  it('never overwrites an entry that already exists', () => {
    expect(buildAddEntryScript({ name: 'Acme', command: 'C:\\Windows\\notepad.exe', scope: 'user', kind: 'run' })).toMatch(/already/);
  });
});

describe('addStartupEntry', () => {
  it('elevates only an all-users entry', async () => {
    const run = vi.fn().mockResolvedValue({ added: true });
    const runElevated = vi.fn().mockResolvedValue({ ok: true, data: { added: true } });
    const entry = { name: 'Acme', command: 'C:\\Windows\\notepad.exe', kind: 'run' };
    expect(await addStartupEntry({ ...entry, scope: 'user' }, { run, runElevated })).toEqual({ ok: true });
    expect(runElevated).not.toHaveBeenCalled();
    expect(await addStartupEntry({ ...entry, scope: 'machine' }, { run, runElevated })).toEqual({ ok: true });
    expect(runElevated).toHaveBeenCalledTimes(1);
  });
  it('refuses an invalid entry before touching anything', async () => {
    const run = vi.fn();
    const result = await addStartupEntry({ name: '', command: 'x', scope: 'user', kind: 'run' }, { run, runElevated: vi.fn() });
    expect(result.ok).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });
  it('reports an existing entry rather than replacing it', async () => {
    const run = vi.fn().mockResolvedValue({ added: false, reason: 'exists' });
    const result = await addStartupEntry({ name: 'Acme', command: 'C:\\Windows\\notepad.exe', scope: 'user', kind: 'run' }, { run, runElevated: vi.fn() });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/already/i);
  });
});
