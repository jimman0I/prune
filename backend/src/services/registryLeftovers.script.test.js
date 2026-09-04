import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildRegistryScript, normalizeRegistryItems } from './registryLeftovers.js';

const execFileAsync = promisify(execFile);

/** This runs REAL PowerShell against REAL registry keys, on purpose.
 *
 * registryLeftovers.test.js mocks runPowerShellJson, which is right for
 * testing the JS around the call and completely blind to the call itself.
 * The scan is one long generated script; a quoting mistake anywhere in it
 * is a parse error that returns nothing, and "nothing" is
 * indistinguishable from "this program left nothing behind". That is
 * exactly how the file scan shipped broken for a week -- "App Paths" has a
 * space in it for the same reason "Start Menu" did.
 *
 * So the fixture below plants a key of each shape the scan is supposed to
 * find, in HKCU where no elevation is needed, and asserts the scan finds
 * every one of them. Everything is removed again in afterAll, whether the
 * assertions passed or not. */
const MARKER = 'PruneScanFixture9137';
const FIXTURES = [
  // A vendor key named for the program: what the original scan found.
  `HKCU\\Software\\${MARKER}`,
  // A product key under a vendor key that does NOT match, which is what
  // the second level exists for.
  `HKCU\\Software\\PruneVendorFixture\\${MARKER}`
];
const UNINSTALL_KEY = `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{${MARKER}}`;
const RUN_KEY = 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run';

async function reg(args) {
  return execFileAsync('reg', args, { timeout: 15000 });
}

beforeAll(async () => {
  for (const key of FIXTURES) await reg(['add', key, '/f']);
  // A GUID-named key whose only trace of the program is its DisplayName --
  // the shape every MSI-installed program takes.
  await reg(['add', UNINSTALL_KEY, '/v', 'DisplayName', '/t', 'REG_SZ', '/d', MARKER, '/f']);
  // A startup entry whose VALUE NAME carries the program name.
  await reg(['add', RUN_KEY, '/v', MARKER, '/t', 'REG_SZ', '/d', 'C:\\nowhere\\fixture.exe', '/f']);
  // And one whose value name does not, so only its command line can match.
  await reg(['add', RUN_KEY, '/v', 'PruneFixtureByCommand', '/t', 'REG_SZ', '/d', `C:\\nowhere\\${MARKER}.exe`, '/f']);
}, 60000);

afterAll(async () => {
  const cleanups = [
    ...FIXTURES.map((key) => ['delete', key, '/f']),
    ['delete', 'HKCU\\Software\\PruneVendorFixture', '/f'],
    ['delete', UNINSTALL_KEY, '/f'],
    ['delete', RUN_KEY, '/v', MARKER, '/f'],
    ['delete', RUN_KEY, '/v', 'PruneFixtureByCommand', '/f']
  ];
  // Every one of these is attempted regardless of the others: a fixture
  // left behind is a stray startup entry on a real machine.
  for (const args of cleanups) await reg(args).catch(() => {});
}, 60000);

async function runScan(pattern) {
  const { stdout, stderr } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', buildRegistryScript(pattern)],
    { timeout: 90000, maxBuffer: 32 * 1024 * 1024 }
  );
  const trimmed = stdout.trim();
  const parsed = trimmed ? JSON.parse(trimmed) : null;
  return { stderr, items: normalizeRegistryItems(parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : []) };
}

describe('buildRegistryScript (real PowerShell, real registry)', () => {
  it('parses, runs clean, and finds every shape of leftover it plants', async () => {
    const { stderr, items } = await runScan(MARKER);
    expect(stderr).toBe('');

    const paths = items.map((i) => i.path.toUpperCase());
    const has = (needle) => paths.some((p) => p.includes(needle.toUpperCase()));

    // A vendor key one level down.
    expect(has(`\\Software\\${MARKER}`)).toBe(true);
    // A product key two levels down, under a vendor that does not match.
    expect(has(`PruneVendorFixture\\${MARKER}`)).toBe(true);
    // The Add/Remove Programs entry, matched only by its DisplayName.
    const uninstall = items.find((i) => i.path.toUpperCase().includes('UNINSTALL'));
    expect(uninstall).toBeTruthy();
    expect(uninstall.isUninstallEntry).toBe(true);

    // Both startup entries: one named for the program, one that only its
    // command line gives away.
    const values = items.filter((i) => i.valueName);
    expect(values.map((v) => v.valueName).sort()).toEqual(['PruneFixtureByCommand', MARKER]);
    for (const value of values) expect(value.path.toUpperCase()).toContain('CURRENTVERSION\\RUN');
  }, 120000);

  it('never offers a key that belongs to Windows rather than to a program', async () => {
    // "Microsoft" is a publisher, and HKLM:\Software\Microsoft matches it
    // exactly. Deleting that key would take most of Windows with it.
    const { items } = await runScan('Microsoft');
    const paths = items.filter((i) => !i.valueName).map((i) => i.path.toUpperCase().replace(/\//g, '\\'));
    for (const forbidden of [
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\MICROSOFT',
      'HKEY_CURRENT_USER\\SOFTWARE\\MICROSOFT',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\WOW6432NODE\\MICROSOFT',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\MICROSOFT\\WINDOWS',
      'HKEY_LOCAL_MACHINE\\SOFTWARE\\MICROSOFT\\WINDOWS NT'
    ]) {
      expect(paths).not.toContain(forbidden);
    }
    // And it still found real things, so the check above is not passing
    // because the scan returned nothing.
    expect(items.length).toBeGreaterThan(0);
  }, 120000);

  it('finds nothing at all for a program that was never installed', async () => {
    const { stderr, items } = await runScan('Zzq-No-Such-Program-4471');
    expect(stderr).toBe('');
    expect(items).toEqual([]);
  }, 120000);
});
