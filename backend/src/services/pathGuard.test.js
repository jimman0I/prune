import { describe, it, expect } from 'vitest';
import { isProtectedPath, protectionReason } from './pathGuard.js';

const opts = {
  systemRoot: 'C:\\Windows',
  programFiles: 'C:\\Program Files',
  programFilesX86: 'C:\\Program Files (x86)',
  usersRoot: 'C:\\Users',
  quarantineRoot: 'C:\\Users\\jim\\AppData\\Local\\Prune\\quarantine'
};
const guarded = (p) => isProtectedPath(p, opts);

describe('isProtectedPath', () => {
  it('allows an ordinary user folder', () => {
    // The whole point of the feature. A 40 GB shader cache under AppData
    // is exactly what someone opens a disk map to find.
    expect(guarded('C:\\Users\\jim\\AppData\\Local\\SomeGame\\ShaderCache')).toBe(false);
    expect(guarded('D:\\Games\\Something')).toBe(false);
    expect(guarded('C:\\ProgramData\\SomeVendor\\cache')).toBe(false);
  });

  it('refuses a drive root', () => {
    // "Delete" on the outermost block of a treemap is the whole drive.
    for (const p of ['C:\\', 'C:', 'D:\\', 'c:\\', 'Z:/']) {
      expect(guarded(p), p).toBe(true);
    }
  });

  it('refuses Windows and everything under it', () => {
    expect(guarded('C:\\Windows')).toBe(true);
    expect(guarded('C:\\Windows\\System32')).toBe(true);
    expect(guarded('C:\\windows\\system32\\drivers')).toBe(true);
  });

  it('refuses the program installation trees', () => {
    // An installed program is uninstalled, never deleted. Deleting it
    // from a picture leaves the registry entry, the uninstaller and the
    // startup keys behind -- which is the exact mess this app exists to
    // clean up.
    expect(guarded('C:\\Program Files')).toBe(true);
    expect(guarded('C:\\Program Files\\KeePassXC')).toBe(true);
    expect(guarded('C:\\Program Files (x86)\\Steam')).toBe(true);
  });

  it('refuses the users root and a whole profile, but not inside one', () => {
    expect(guarded('C:\\Users')).toBe(true);
    expect(guarded('C:\\Users\\jim')).toBe(true);
    expect(guarded('C:\\Users\\jim\\Downloads')).toBe(false);
  });

  it('refuses the quarantine folder and anything containing it', () => {
    // Moving the quarantine into itself, or deleting the folder holding
    // every undo the app has.
    expect(guarded(opts.quarantineRoot)).toBe(true);
    expect(guarded('C:\\Users\\jim\\AppData\\Local\\Prune')).toBe(true);
    expect(guarded(`${opts.quarantineRoot}\\1234-App`)).toBe(true);
  });

  it('refuses a relative path or one that climbs', () => {
    // A path with .. in it cannot be reasoned about by prefix matching --
    // "C:\\Users\\jim\\..\\..\\Windows" is C:\\Windows wearing a hat.
    expect(guarded('Downloads')).toBe(true);
    expect(guarded('C:\\Users\\jim\\..\\..\\Windows')).toBe(true);
    expect(guarded('..\\..\\thing')).toBe(true);
  });

  it('refuses anything that is not a usable string', () => {
    for (const p of ['', '   ', null, undefined, 42, {}]) {
      expect(isProtectedPath(p, opts), String(p)).toBe(true);
    }
  });

  it('is not fooled by a prefix that is not a path boundary', () => {
    // "C:\\Windows Update Logs" is not inside "C:\\Windows". A plain
    // startsWith would refuse it, and a startsWith is also how the
    // opposite bug gets written.
    expect(guarded('C:\\Windows Update Logs')).toBe(false);
    expect(guarded('C:\\Program Files Custom\\thing')).toBe(false);
  });

  it('ignores a trailing separator either way', () => {
    expect(guarded('C:\\Windows\\')).toBe(true);
    expect(guarded('C:\\Users\\jim\\Downloads\\')).toBe(false);
  });

  it('treats forward slashes the same as backslashes', () => {
    // The disk map builds paths by joining and a mixed separator reaching
    // here must not become a way past the guard.
    expect(guarded('C:/Windows/System32')).toBe(true);
    expect(guarded('C:/Users/jim')).toBe(true);
  });
});

describe('protectionReason', () => {
  it('says why, in words a person can act on', () => {
    expect(protectionReason('C:\\Windows\\System32', opts)).toMatch(/Windows/i);
    expect(protectionReason('C:\\Program Files\\App', opts)).toMatch(/uninstall/i);
    expect(protectionReason('C:\\', opts)).toMatch(/whole drive/i);
  });

  it('has nothing to say about a path that is allowed', () => {
    expect(protectionReason('D:\\Games\\Something', opts)).toBeNull();
  });

  it('gives the most specific reason when several apply', () => {
    // The quarantine lives inside the user profile, so every one of these
    // is ALSO "contains the quarantine". Answering C:\Users with that was
    // true and useless -- refusing correctly for a confusing reason is
    // still a bug when the reason is the whole point of the feature.
    expect(protectionReason('C:\\Users', opts)).toMatch(/every user account/i);
    expect(protectionReason('C:\\Users\\jim', opts)).toMatch(/whole user profile/i);
    // And the quarantine reason still wins where nothing more specific
    // applies.
    expect(protectionReason('C:\\Users\\jim\\AppData\\Local\\Prune', opts)).toMatch(/quarantine/i);
  });
});
