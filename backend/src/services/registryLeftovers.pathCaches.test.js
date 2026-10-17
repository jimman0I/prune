import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { buildRegistryScript, normalizeRegistryItems } from './registryLeftovers.js';

const execFileAsync = promisify(execFile);

/** Real PowerShell against real HKCU keys, for the same reason as
 * registryLeftovers.script.test.js: a quoting slip in the generated script
 * returns nothing, which looks exactly like "no leftovers".
 *
 * Windows keeps a program's executable path in a handful of caches that
 * outlive it -- found comparing a real Notepad++ uninstall, where only the
 * UFH\SHC entry was missed. Each cache is pointed at a scratch key here so
 * the fixtures never touch the machine's real ones. */
// Under Microsoft, which the name-based vendor passes never enter, so a hit
// can only come from the cache passes under test.
const ROOT = 'HKCU\\Software\\Microsoft\\PrunePathCacheFixture9137';
const PS_ROOT = `HKCU:\\Software\\Microsoft\\PrunePathCacheFixture9137`;
const APP = 'C:\\PruneFixtureApps\\Zephyr';
const OTHER = 'C:\\PruneFixtureApps\\Unrelated';

const rot13 = (s) => s.replace(/[a-z]/gi, (c) => {
  const base = c <= 'Z' ? 65 : 97;
  return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
});
// FOLDERID_LocalAppData: UserAssist stores paths under a known folder as its GUID.
const LOCAL_APPDATA_GUID = '{F1B32785-6FBA-4FCF-9D55-7B8E7F157091}';
const LOCAL_APP = `${process.env.LOCALAPPDATA}\\PruneFixtureZephyr`;

async function reg(args) {
  return execFileAsync('reg', args, { timeout: 15000 });
}

const roots = {
  ufh: [`${PS_ROOT}\\UFH`],
  muiCache: [`${PS_ROOT}\\MuiCache`],
  appCompat: [`${PS_ROOT}\\Layers`],
  userAssist: [`${PS_ROOT}\\UserAssist`],
  audioPolicy: [`${PS_ROOT}\\PropertyStore`],
  installerFolders: [`${PS_ROOT}\\InstallerFolders`],
  tracing: [`${PS_ROOT}\\Tracing`],
  radar: [`${PS_ROOT}\\DiagnosedApplications`]
};

beforeAll(async () => {
  await reg(['delete', ROOT, '/f']).catch(() => {});
  await reg(['add', `${ROOT}\\UFH`, '/v', '0', '/t', 'REG_MULTI_SZ', '/d', `C:\\ProgramData\\Start Menu\\Zephyr.lnk\\0${APP}\\zephyr.exe`, '/f']);
  await reg(['add', `${ROOT}\\UFH`, '/v', '1', '/t', 'REG_MULTI_SZ', '/d', `C:\\ProgramData\\Start Menu\\Other.lnk\\0${OTHER}\\other.exe`, '/f']);
  await reg(['add', `${ROOT}\\MuiCache`, '/v', `${APP}\\zephyr.exe.FriendlyAppName`, '/t', 'REG_SZ', '/d', 'Zephyr', '/f']);
  await reg(['add', `${ROOT}\\MuiCache`, '/v', `${OTHER}\\other.exe.FriendlyAppName`, '/t', 'REG_SZ', '/d', 'Other', '/f']);
  await reg(['add', `${ROOT}\\Layers`, '/v', `${APP}\\zephyr.exe`, '/t', 'REG_SZ', '/d', '~ RUNASADMIN', '/f']);
  await reg(['add', `${ROOT}\\UserAssist\\{GUIDA}\\Count`, '/v', rot13(`${APP}\\zephyr.exe`), '/t', 'REG_BINARY', '/d', '00', '/f']);
  await reg(['add', `${ROOT}\\UserAssist\\{GUIDA}\\Count`, '/v', rot13(`${LOCAL_APPDATA_GUID}\\PruneFixtureZephyr\\zephyr.exe`), '/t', 'REG_BINARY', '/d', '00', '/f']);
  await reg(['add', `${ROOT}\\UserAssist\\{GUIDA}\\Count`, '/v', rot13(`${OTHER}\\other.exe`), '/t', 'REG_BINARY', '/d', '00', '/f']);
  await reg(['add', `${ROOT}\\PropertyStore\\a1`, '/ve', '/t', 'REG_SZ', '/d', '\\Device\\HarddiskVolume3\\PruneFixtureApps\\Zephyr\\zephyr.exe%b{0000}', '/f']);
  await reg(['add', `${ROOT}\\PropertyStore\\b2`, '/ve', '/t', 'REG_SZ', '/d', '\\Device\\HarddiskVolume3\\PruneFixtureApps\\Unrelated\\other.exe%b{0000}', '/f']);
  await reg(['add', `${ROOT}\\InstallerFolders`, '/v', `${APP}\\`, '/t', 'REG_SZ', '/d', '', '/f']);
  await reg(['add', `${ROOT}\\Tracing\\Zephyr_RASAPI32`, '/f']);
  await reg(['add', `${ROOT}\\Tracing\\Other_RASAPI32`, '/f']);
  await reg(['add', `${ROOT}\\DiagnosedApplications\\Zephyr.exe`, '/f']);
}, 60000);

afterAll(async () => {
  await reg(['delete', ROOT, '/f']).catch(() => {});
}, 60000);

async function runScan(pattern, { advanced }) {
  const script = buildRegistryScript(pattern, {
    advanced, anchors: [APP, LOCAL_APP], pathCacheRoots: roots,
    // The fixture never plants these; pointing them at nothing keeps the
    // real machine's entries out of the result.
    sharedDllRoots: [], firewallRoots: [], msconfigRoots: [], eventLogRoots: []
  });
  const { stdout } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script],
    { timeout: 120000, maxBuffer: 32 * 1024 * 1024 }
  );
  const trimmed = stdout.trim();
  const parsed = trimmed ? JSON.parse(trimmed) : null;
  return normalizeRegistryItems(parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : [])
    .filter((i) => i.path.includes('PrunePathCacheFixture9137'));
}

const leaf = (i) => `${i.path.split('\\').slice(-1)[0]}${i.valueName ? ` :: ${i.valueName}` : ''}`;

describe('path caches', () => {
  it('finds every cache entry that points into the program\'s folder, and none that do not', async () => {
    const items = await runScan('Zephyr', { advanced: false });
    const found = items.map(leaf).sort();
    expect(found).toEqual([
      `InstallerFolders :: ${APP}\\`,
      `Layers :: ${APP}\\zephyr.exe`,
      `MuiCache :: ${APP}\\zephyr.exe.FriendlyAppName`,
      `Count :: ${rot13(`${APP}\\zephyr.exe`)}`,
      `Count :: ${rot13(`${LOCAL_APPDATA_GUID}\\PruneFixtureZephyr\\zephyr.exe`)}`,
      'UFH :: 0',
      'a1'
    ].sort());
    expect(items.every((i) => i.anchored === true)).toBe(true);
    // UserAssist names are ROT13; the review shows the decoded path, with the
    // known-folder GUID spelled out, while removal keeps the raw name.
    const labels = items.filter((i) => i.path.endsWith('Count')).map((i) => i.valueLabel).sort();
    expect(labels).toEqual([`${APP}\\zephyr.exe`, `${LOCAL_APP}\\zephyr.exe`].sort());
  }, 120000);

  it('Advanced also finds the per-executable keys named for the program', async () => {
    const items = await runScan('Zephyr', { advanced: true });
    const found = items.map(leaf);
    expect(found).toContain('Zephyr_RASAPI32');
    expect(found).toContain('Zephyr.exe');
    expect(found).not.toContain('Other_RASAPI32');
  }, 120000);
});
