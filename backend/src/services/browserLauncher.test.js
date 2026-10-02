import { describe, it, expect, vi } from 'vitest';
import { buildManagePlan, manageExtension, parseAppPathsOutput, knownBrowserPaths, isChromiumId, findBrowserExe } from './browserLauncher.js';

const CHROME_ID = 'a'.repeat(32);

describe('isChromiumId', () => {
  it('accepts exactly 32 letters a to p, which is what an extension id is', () => {
    expect(isChromiumId(CHROME_ID)).toBe(true);
    expect(isChromiumId('abcdefghijklmnopabcdefghijklmnop')).toBe(true);
  });

  it('refuses everything else, including anything that could carry more arguments or a URL', () => {
    for (const bad of [
      '', 'short', 'a'.repeat(31), 'a'.repeat(33), 'z'.repeat(32), 'A'.repeat(32), `${'a'.repeat(31)}&`,
      `${'a'.repeat(32)}&url=evil`, `${'a'.repeat(32)} --flag`, `${'a'.repeat(31)}/`, '../' + 'a'.repeat(29), null, undefined, 5, {}
    ]) expect(isChromiumId(bad), String(bad)).toBe(false);
  });
});

describe('buildManagePlan', () => {
  it.each([
    ['Chrome', 'chrome.exe', `chrome://extensions/?id=${CHROME_ID}`],
    ['Edge', 'msedge.exe', `edge://extensions/?id=${CHROME_ID}`],
    ['Brave', 'brave.exe', `brave://extensions/?id=${CHROME_ID}`],
    ['Vivaldi', 'vivaldi.exe', `vivaldi://extensions/?id=${CHROME_ID}`],
    ['Opera', 'opera.exe', `opera://extensions/?id=${CHROME_ID}`]
  ])('opens the right page for %s', (browser, exe, url) => {
    const plan = buildManagePlan({ browser, extensionId: CHROME_ID, profile: 'Default' });
    expect(plan.ok).toBe(true);
    expect(plan.exeName).toBe(exe);
    expect(plan.args).toEqual(['--profile-directory=Default', url]);
  });

  it('opens about:addons for the Gecko browsers, whatever the add-on', () => {
    for (const [browser, exe] of [['Firefox', 'firefox.exe'], ['LibreWolf', 'librewolf.exe'], ['Waterfox', 'waterfox.exe'], ['Zen', 'zen.exe'], ['SeaMonkey', 'seamonkey.exe']]) {
      const plan = buildManagePlan({ browser, extensionId: 'addon@example.org', profile: 'C:\\Users\\me\\AppData\\Roaming\\Mozilla\\Firefox\\Profiles\\x.default' });
      expect(plan).toMatchObject({ ok: true, exeName: exe, args: ['-new-tab', 'about:addons'] });
    }
  });

  it('names the profile for a Chromium browser only when it is a real profile folder name', () => {
    expect(buildManagePlan({ browser: 'Chrome', extensionId: CHROME_ID, profile: 'Profile 3' }).args[0]).toBe('--profile-directory=Profile 3');
    for (const profile of ['..\\x', 'Default --evil', '', undefined, 'C:\\somewhere']) {
      expect(buildManagePlan({ browser: 'Chrome', extensionId: CHROME_ID, profile }).args, String(profile)).toEqual([`chrome://extensions/?id=${CHROME_ID}`]);
    }
  });

  it('refuses a browser it does not know, and an id that is not one', () => {
    expect(buildManagePlan({ browser: 'Netscape', extensionId: CHROME_ID }).ok).toBe(false);
    expect(buildManagePlan({ browser: 'Chrome', extensionId: 'nope' }).ok).toBe(false);
    expect(buildManagePlan({ browser: 'Chrome', extensionId: `${CHROME_ID}&x` }).ok).toBe(false);
    expect(buildManagePlan({}).ok).toBe(false);
  });

  it('never builds a shell string: the URL is one argv element', () => {
    const plan = buildManagePlan({ browser: 'Chrome', extensionId: CHROME_ID, profile: 'Default' });
    expect(Array.isArray(plan.args)).toBe(true);
    expect(plan.args.every((a) => typeof a === 'string')).toBe(true);
    expect(plan.args.join('')).not.toMatch(/[|&;<>`$]/);
  });
});

describe('parseAppPathsOutput', () => {
  it('reads the default value of an App Paths key from reg query output', () => {
    const output = '\r\nHKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe\r\n    (Default)    REG_SZ    C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe\r\n    Path    REG_SZ    C:\\Program Files\\Google\\Chrome\\Application\r\n';
    expect(parseAppPathsOutput(output)).toBe('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
  });

  it('strips quotes, and gives nothing for output without a default value', () => {
    expect(parseAppPathsOutput('    (Default)    REG_SZ    "C:\\A B\\x.exe"')).toBe('C:\\A B\\x.exe');
    expect(parseAppPathsOutput('ERROR: The system was unable to find the specified registry key or value.')).toBeNull();
    expect(parseAppPathsOutput('')).toBeNull();
  });
});

describe('knownBrowserPaths', () => {
  it('lists the usual install locations for each browser', () => {
    const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\U\\AppData\\Local' };
    expect(knownBrowserPaths('chrome.exe', env)).toContain('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe');
    expect(knownBrowserPaths('msedge.exe', env)).toContain('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe');
    expect(knownBrowserPaths('opera.exe', env)).toContain('C:\\U\\AppData\\Local\\Programs\\Opera\\opera.exe');
    expect(knownBrowserPaths('firefox.exe', env)).toContain('C:\\Program Files\\Mozilla Firefox\\firefox.exe');
    expect(knownBrowserPaths('unknown.exe', env)).toEqual([]);
  });
});

describe('manageExtension', () => {
  const target = { browser: 'Chrome', extensionId: CHROME_ID, profile: 'Default' };

  it('launches the browser found by the registry with the page as an argument', async () => {
    const launch = vi.fn(async () => {});
    const result = await manageExtension(target, { findExe: async () => 'C:\\Chrome\\chrome.exe', launch });
    expect(launch).toHaveBeenCalledWith('C:\\Chrome\\chrome.exe', ['--profile-directory=Default', `chrome://extensions/?id=${CHROME_ID}`]);
    expect(result).toMatchObject({ ok: true, browser: 'Chrome' });
  });

  it('says honestly when the browser cannot be found, and launches nothing', async () => {
    const launch = vi.fn();
    const result = await manageExtension(target, { findExe: async () => null, launch });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Chrome/);
    expect(launch).not.toHaveBeenCalled();
  });

  it('refuses a bad target before looking for anything', async () => {
    const findExe = vi.fn();
    const result = await manageExtension({ browser: 'Chrome', extensionId: 'bad' }, { findExe, launch: vi.fn() });
    expect(result.ok).toBe(false);
    expect(findExe).not.toHaveBeenCalled();
  });

  it('reports a launch failure', async () => {
    const result = await manageExtension(target, { findExe: async () => 'C:\\c.exe', launch: async () => { throw new Error('spawn EACCES'); } });
    expect(result).toMatchObject({ ok: false });
    expect(result.error).toMatch(/EACCES/);
  });

});

describe('findBrowserExe', () => {
  const roots = ['HKCU', 'HKLM'];

  it('takes the first App Paths answer that names a file that exists', async () => {
    const queryReg = vi.fn(async (hive) => (hive === 'HKCU' ? '    (Default)    REG_SZ    C:\\stale\\chrome.exe' : '    (Default)    REG_SZ    C:\\real\\chrome.exe'));
    const exists = (p) => p === 'C:\\real\\chrome.exe';
    expect(await findBrowserExe('chrome.exe', { queryReg, exists, env: {} })).toBe('C:\\real\\chrome.exe');
    expect(queryReg.mock.calls.map((c) => c[0])).toEqual(roots);
  });

  it('falls back to the usual install folders', async () => {
    const env = { ProgramFiles: 'C:\\Program Files', 'ProgramFiles(x86)': 'C:\\Program Files (x86)', LOCALAPPDATA: 'C:\\L' };
    const found = await findBrowserExe('chrome.exe', {
      queryReg: async () => '', env, exists: (p) => p === 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
    });
    expect(found).toBe('C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe');
  });

  it('is null when it is nowhere, and only ever asks the registry about a bare executable name', async () => {
    const queryReg = vi.fn(async () => '');
    expect(await findBrowserExe('chrome.exe', { queryReg, exists: () => false, env: {} })).toBeNull();
    expect(await findBrowserExe('..\\evil.exe', { queryReg, exists: () => true, env: {} })).toBeNull();
    expect(queryReg.mock.calls.every(([, name]) => name === 'chrome.exe')).toBe(true);
  });
});
