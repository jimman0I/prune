import { describe, it, expect } from 'vitest';
import { leftoverItemNote } from './LeftoverReview.jsx';

describe('leftoverItemNote', () => {
  it('says a value is removed on its own, because its key is shared', () => {
    // A startup entry is one value inside HKCU\...\Run. Shown as a bare
    // path the row would read as "this whole key is going", which for that
    // key would mean every program's startup entry.
    expect(
      leftoverItemNote({
        path: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
        valueName: 'DeadUpdater'
      })
    ).toBe('Only the value "DeadUpdater" — the key it sits in is shared and stays');
  });

  it('calls out the Add/Remove Programs entry', () => {
    // Worth naming: this is the key that makes Windows list the program at
    // all, and the reason a dead entry never goes away on its own.
    expect(leftoverItemNote({ path: 'HKLM:\\SOFTWARE\\...\\Uninstall\\{GUID}', isUninstallEntry: true }))
      .toBe('Add/Remove Programs entry');
  });

  it('prefers the value note when an entry is somehow both', () => {
    // Nothing produces this today. If something ever does, which value is
    // being removed is the more urgent of the two facts.
    const note = leftoverItemNote({ path: 'HKCU:\\A', valueName: 'X', isUninstallEntry: true });
    expect(note).toMatch(/Only the value/);
  });

  it('says nothing about an ordinary key or file', () => {
    expect(leftoverItemNote({ path: 'HKCU:\\Software\\Dead' })).toBeNull();
    expect(leftoverItemNote({ path: 'C:\\Program Files\\Dead', sizeBytes: 100 })).toBeNull();
    expect(leftoverItemNote(null)).toBeNull();
  });
});
