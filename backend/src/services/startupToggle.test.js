import { describe, it, expect } from 'vitest';
import {
  toggleRefusal,
  approvedKeyPath,
  toggleBytes,
  buildToggleScript
} from './startupToggle.js';

const runEntry = (over = {}) => ({
  name: 'IDMan',
  approvedName: 'IDMan',
  source: 'registry',
  location: 'Run',
  rawScope: 'user',
  registryKey: 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
  ...over
});

/** The little-endian FILETIME decoder, written independently of the
 * encoder so a byte-order bug in one is not blessed by the other. */
function decodeFileTime(bytes) {
  let value = 0n;
  for (let i = 7; i >= 0; i--) value = (value << 8n) | BigInt(bytes[4 + i]);
  return Number(value / 10000n) - 11644473600000;
}

describe('toggleRefusal', () => {
  it('allows an ordinary Run value', () => {
    expect(toggleRefusal(runEntry())).toBeNull();
  });

  it('allows a Startup-folder shortcut', () => {
    expect(toggleRefusal(runEntry({
      source: 'folder',
      location: 'Startup folder',
      name: 'Peace',
      approvedName: 'Peace.lnk',
      registryKey: null
    }))).toBeNull();
  });

  it('refuses a RunOnce entry and says why', () => {
    // Windows keeps no StartupApproved subkey for RunOnce -- verified on
    // this machine, where both hives hold only Run, Run32 and
    // StartupFolder. Writing a decision for one would land in the Run
    // subkey and either do nothing or, worse, switch off a DIFFERENT
    // entry that happens to share the name.
    const refusal = toggleRefusal(runEntry({ location: 'RunOnce' }));
    expect(refusal).toMatch(/RunOnce/);
  });

  it('refuses an entry with no name to file the decision under', () => {
    expect(toggleRefusal(runEntry({ name: '', approvedName: '' }))).toBeTruthy();
  });

  it('refuses nothing at all rather than throwing', () => {
    expect(toggleRefusal(null)).toBeTruthy();
  });
});

describe('approvedKeyPath', () => {
  it('files a per-user Run value under HKCU StartupApproved\\Run', () => {
    expect(approvedKeyPath(runEntry())).toBe(
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run'
    );
  });

  it('files a 32-bit machine Run value under HKLM StartupApproved\\Run32', () => {
    expect(approvedKeyPath(runEntry({
      rawScope: 'machine',
      location: 'Run (32-bit)',
      registryKey: 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'
    }))).toBe(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\Run32'
    );
  });

  it('files an all-users shortcut under HKLM StartupApproved\\StartupFolder', () => {
    expect(approvedKeyPath(runEntry({
      source: 'folder',
      rawScope: 'machine',
      location: 'Startup folder',
      registryKey: null
    }))).toBe(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder'
    );
  });

  it('has no key for a RunOnce entry', () => {
    expect(approvedKeyPath(runEntry({ location: 'RunOnce' }))).toBeNull();
  });
});

describe('toggleBytes', () => {
  const NOW = Date.UTC(2026, 5, 28, 18, 25, 45);

  it('writes exactly the twelve bytes Windows writes when enabling', () => {
    expect(toggleBytes(true, null, NOW)).toEqual([2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('stamps the time of the change when disabling', () => {
    const bytes = toggleBytes(false, null, NOW);
    expect(bytes).toHaveLength(12);
    expect(bytes.slice(0, 4)).toEqual([3, 0, 0, 0]);
    expect(decodeFileTime(bytes)).toBe(NOW);
  });

  it('writes the timestamp little-endian, high byte last', () => {
    // The one assertion that catches a reversed encoder: every plausible
    // date this decade has 0x01 as the top byte of its FILETIME, and a
    // big-endian bug would move that 1 to the front where Windows reads
    // the state flag.
    const bytes = toggleBytes(false, null, NOW);
    expect(bytes[11]).toBe(1);
    expect(bytes[4]).toBeGreaterThan(1);
  });

  it('clears the timestamp again when re-enabling', () => {
    // Every enabled value on this machine has eight zero bytes there, and
    // leaving a stale disable time behind would make the registry claim
    // something that is on was switched off at a particular moment.
    const disabled = toggleBytes(false, null, NOW);
    expect(toggleBytes(true, disabled, NOW).slice(4)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('keeps an unfamiliar state byte and flips only its low bit', () => {
    // 0x06/0x07 appear on some machines alongside 0x02/0x03. Windows reads
    // the low bit; the rest of the byte is its own record and overwriting
    // it with our own idea of "2" would discard something we do not
    // understand for no gain.
    expect(toggleBytes(false, [6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0], NOW)[0]).toBe(7);
    expect(toggleBytes(true, [7, 0, 0, 0, 1, 2, 3, 4, 5, 6, 7, 8], NOW)[0]).toBe(6);
  });

  it('is unchanged by a previous value it cannot read', () => {
    expect(toggleBytes(true, 'nonsense', NOW)[0]).toBe(2);
    expect(toggleBytes(false, [], NOW)[0]).toBe(3);
  });

  it('produces bytes that are all real bytes', () => {
    for (const byte of toggleBytes(false, null, NOW)) {
      expect(Number.isInteger(byte)).toBe(true);
      expect(byte).toBeGreaterThanOrEqual(0);
      expect(byte).toBeLessThanOrEqual(255);
    }
  });
});

describe('buildToggleScript', () => {
  const script = (item, enabled, bytes) =>
    buildToggleScript(item, enabled, bytes ?? [3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);

  it('writes to the StartupApproved key, never to the Run key itself', () => {
    const text = script(runEntry(), false);
    expect(text).toContain('StartupApproved\\Run');
    // The whole point of StartupApproved is that the Run value stays put.
    // A script that touched it would be deleting the entry, not disabling
    // it, and the user could never switch it back on.
    expect(text).not.toMatch(/Remove-ItemProperty|Remove-Item\b/);
  });

  it('names the entry as Windows files it, extension and all', () => {
    const text = script(runEntry({
      source: 'folder',
      location: 'Startup folder',
      name: 'Peace',
      approvedName: 'Peace.lnk'
    }), false);
    expect(text).toContain("'Peace.lnk'");
  });

  it('escapes a quote in the value name', () => {
    // Registry value names are close to arbitrary text. An unescaped
    // apostrophe would end the PowerShell string early and hand the rest
    // of the name to the parser as code.
    const text = script(runEntry({ name: "Bob's App", approvedName: "Bob's App" }), false);
    expect(text).toContain("'Bob''s App'");
  });

  it('creates the subkey when Windows has never recorded a decision here', () => {
    // Most machines have no Run32 subkey at all until something is
    // disabled there, and writing a property into a key that does not
    // exist fails.
    expect(script(runEntry(), false)).toContain('New-Item');
  });

  it('carries the exact bytes it was given', () => {
    expect(script(runEntry(), false, [3, 0, 0, 0, 222, 105, 64, 137, 43, 7, 221, 1]))
      .toContain('3,0,0,0,222,105,64,137,43,7,221,1');
  });

  it('reads the value back so the result reports what is really there', () => {
    // A write that silently did nothing and a write that worked look
    // identical from the caller's side otherwise.
    expect(script(runEntry(), false)).toContain('Get-ItemProperty');
  });
});
