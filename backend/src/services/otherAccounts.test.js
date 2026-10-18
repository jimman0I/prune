import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { otherProfiles, buildScanScript, accountRows, scanOtherAccounts, clearOtherAccountsScan } from './otherAccounts.js';

const sid = (n) => `S-1-5-21-1-2-3-${n}`;

describe('otherProfiles', () => {
  it('keeps the other people\'s accounts and drops Windows\' own and this one', () => {
    const rows = [
      { sid: 'S-1-5-18', path: 'C:\\WINDOWS\\system32\\config\\systemprofile', loaded: true, me: false },
      { sid: sid(1000), path: 'C:\\Users\\me', loaded: true, me: true },
      { sid: sid(1005), path: 'C:\\Users\\nikos', loaded: false, me: false },
      { sid: sid(1006), path: '', loaded: false, me: false }
    ];
    expect(otherProfiles(rows)).toEqual([{ sid: sid(1005), name: 'nikos', path: 'C:\\Users\\nikos', loaded: false }]);
    expect(otherProfiles({ sid: sid(1007), path: 'C:\\Users\\ana', loaded: true, me: false })).toHaveLength(1);
  });
});

describe('accountRows', () => {
  const profile = { sid: sid(1005), name: 'nikos' };

  it('turns registry entries into rows owned by that account', () => {
    const rows = accountRows({ programs: [
      { keyName: 'Discord', DisplayName: 'Discord', Publisher: 'Discord Inc.', DisplayVersion: '1.0', EstimatedSize: '109438', InstallLocation: 'C:\\Users\\nikos\\AppData\\Local\\Discord', InstallDate: '20260901' }
    ] }, profile);
    expect(rows).toEqual([{
      id: `user:${sid(1005)}:Discord`, name: 'Discord', publisher: 'Discord Inc.', version: '1.0',
      installLocation: 'C:\\Users\\nikos\\AppData\\Local\\Discord', sizeBytes: 109438 * 1024, installDate: '2026-09-01',
      owner: 'nikos', ownerSid: sid(1005), source: 'otherUser'
    }]);
  });

  it('leaves out what the main list leaves out: no name, system components, updates', () => {
    const rows = accountRows({ programs: [
      { keyName: 'a' },
      { keyName: 'b', DisplayName: 'Hidden', SystemComponent: '1' },
      { keyName: 'c', DisplayName: 'Patch', ParentKeyName: 'Thing' },
      { keyName: 'd', DisplayName: 'Fix', ReleaseType: 'Update' },
      { keyName: 'e', DisplayName: 'Real' }
    ] }, profile);
    expect(rows.map((r) => r.name)).toEqual(['Real']);
    expect(rows[0]).toMatchObject({ sizeBytes: null, installDate: null, installLocation: null });
  });
});

describe('buildScanScript', () => {
  it('takes only real user SIDs, quotes paths, and always unloads what it loaded', () => {
    const script = buildScanScript([
      { sid: sid(1005), path: "C:\\Users\\o'brien" },
      { sid: 'S-1-5-21-1; Remove-Item C:\\', path: 'C:\\x' }
    ]);
    expect(script).toContain(`'${sid(1005)}'`);
    expect(script).toContain("'C:\\Users\\o''brien'");
    expect(script).not.toContain('Remove-Item');
    // The unload sits in a finally, after a garbage collect, with retries.
    expect(script).toMatch(/finally \{\s*\[GC\]::Collect\(\)[\s\S]*reg\.exe unload/);
    expect(script).toContain('$stuck += $mount');
  });

  it('parses as PowerShell (nothing is run)', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const root = mkdtempSync(join(tmpdir(), 'prune-accounts-'));
    try {
      const file = join(root, 'scan.ps1');
      writeFileSync(file, buildScanScript([{ sid: sid(1005), path: 'C:\\Users\\nikos' }]), 'utf8');
      const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
      expect(stdout.trim()).toBe('errors=0');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});

describe('scanOtherAccounts', () => {
  beforeEach(() => clearOtherAccountsScan());
  const profiles = [{ sid: sid(1005), name: 'nikos', path: 'C:\\Users\\nikos', loaded: false }];

  it('runs one elevated scan and keeps what it found', async () => {
    const runElevated = vi.fn(async () => ({ ok: true, data: { accounts: [{ sid: sid(1005), programs: [{ keyName: 'x', DisplayName: 'Tool' }] }], stuck: [] } }));
    const result = await scanOtherAccounts({ runElevated, profiles });
    expect(runElevated).toHaveBeenCalledTimes(1);
    expect(result.scan.accounts).toEqual([{ sid: sid(1005), name: 'nikos', count: 1 }]);
    expect(result.scan.programs[0]).toMatchObject({ name: 'Tool', owner: 'nikos' });
  });

  it('passes a cancelled prompt through and reports an account it could not read', async () => {
    expect(await scanOtherAccounts({ runElevated: async () => ({ ok: false, cancelled: true }), profiles })).toEqual({ ok: false, cancelled: true });
    const result = await scanOtherAccounts({ runElevated: async () => ({ ok: true, data: { accounts: [{ sid: sid(1005), programs: [], error: 'Windows would not open this account\'s registry file.' }], stuck: [] } }), profiles });
    expect(result.scan.accounts[0].error).toMatch(/would not open/);
  });

  it('does not elevate when there is no other account', async () => {
    const runElevated = vi.fn();
    expect((await scanOtherAccounts({ runElevated, profiles: [] })).scan.programs).toEqual([]);
    expect(runElevated).not.toHaveBeenCalled();
  });
});
