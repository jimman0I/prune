import { execFile, spawn } from 'node:child_process';
import { existsSync } from 'node:fs';

/** "Manage" for a browser extension: open the browser on that extension's own
 * page, where the person can disable or remove it.
 *
 * Prune cannot remove a browser extension for the person, and does not try:
 * a Chromium browser keeps its extensions in profile files it rewrites and
 * signs, and editing them from outside leaves a profile the browser repairs
 * by switching the extension back on or resetting the profile. What it can do
 * honestly is take the person to the page where the browser does it itself.
 *
 * The browser is started by its executable with an argument vector -- the
 * extension page is ONE element of it, never part of a shell string -- and
 * the only variable inputs are an extension id that must be exactly 32
 * letters a-p, and a profile folder name that must look like one. */

/** Chromium extension ids are 32 characters from a to p (a hex encoding of a
 * hash with the digits shifted into letters). Nothing else is an id. */
export function isChromiumId(value) {
  return typeof value === 'string' && /^[a-p]{32}$/.test(value);
}

const CHROMIUM = {
  Chrome: { exe: 'chrome.exe', scheme: 'chrome' },
  Edge: { exe: 'msedge.exe', scheme: 'edge' },
  Brave: { exe: 'brave.exe', scheme: 'brave' },
  Vivaldi: { exe: 'vivaldi.exe', scheme: 'vivaldi' },
  Opera: { exe: 'opera.exe', scheme: 'opera' }
};

const GECKO = {
  Firefox: 'firefox.exe',
  LibreWolf: 'librewolf.exe',
  Waterfox: 'waterfox.exe',
  Zen: 'zen.exe',
  SeaMonkey: 'seamonkey.exe'
};

/** What to launch and with what, or why not. Pure; launches nothing. */
export function buildManagePlan({ browser, extensionId, profile } = {}) {
  if (Object.hasOwn(CHROMIUM, browser)) {
    if (!isChromiumId(extensionId)) return { ok: false, error: 'That is not a valid extension id.' };
    const { exe, scheme } = CHROMIUM[browser];
    const args = [];
    // The profile the extension lives in, so the page opens in the right one.
    if (typeof profile === 'string' && /^(Default|Profile \d+)$/.test(profile)) args.push(`--profile-directory=${profile}`);
    args.push(`${scheme}://extensions/?id=${extensionId}`);
    return { ok: true, browser, exeName: exe, args };
  }
  if (Object.hasOwn(GECKO, browser)) {
    // The add-ons page lists them all; Gecko has no per-add-on address.
    return { ok: true, browser, exeName: GECKO[browser], args: ['-new-tab', 'about:addons'] };
  }
  return { ok: false, error: 'Prune does not know how to open that browser.' };
}

/** The default value out of `reg query ... App Paths\x.exe` output. */
export function parseAppPathsOutput(output) {
  const match = /\(Default\)\s+REG_(?:EXPAND_)?SZ\s+(.+)/i.exec(String(output || ''));
  if (!match) return null;
  const value = match[1].trim().replace(/^"+|"+$/g, '');
  return value || null;
}

/** Where each browser is usually installed, for when App Paths says nothing. */
export function knownBrowserPaths(exeName, env = process.env) {
  const pf = env.ProgramFiles || 'C:\\Program Files';
  const pf86 = env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
  const local = env.LOCALAPPDATA;
  const both = (...parts) => [pf, pf86].map((root) => [root, ...parts].join('\\'));
  const table = {
    'chrome.exe': both('Google', 'Chrome', 'Application', 'chrome.exe'),
    'msedge.exe': both('Microsoft', 'Edge', 'Application', 'msedge.exe'),
    'brave.exe': both('BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe'),
    'vivaldi.exe': [...both('Vivaldi', 'Application', 'vivaldi.exe'), ...(local ? [`${local}\\Vivaldi\\Application\\vivaldi.exe`] : [])],
    'opera.exe': [...(local ? [`${local}\\Programs\\Opera\\opera.exe`] : []), ...both('Opera', 'opera.exe')],
    'firefox.exe': both('Mozilla Firefox', 'firefox.exe'),
    'librewolf.exe': both('LibreWolf', 'librewolf.exe'),
    'waterfox.exe': both('Waterfox', 'waterfox.exe'),
    'zen.exe': both('Zen Browser', 'zen.exe'),
    'seamonkey.exe': both('SeaMonkey', 'seamonkey.exe')
  };
  return table[exeName] ?? [];
}

function defaultQueryReg(hive, exeName) {
  return new Promise((resolve) => {
    execFile('reg', ['query', `${hive}\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${exeName}`, '/ve'],
      { windowsHide: true, timeout: 10000 }, (err, stdout) => resolve(err ? '' : stdout));
  });
}

/** The browser's executable: the registry's App Paths entry (which is what
 * Windows itself uses to find it) if it names a file that exists, else the
 * usual install folders. Null when neither. */
export async function findBrowserExe(exeName, { queryReg = defaultQueryReg, exists = existsSync, env = process.env } = {}) {
  // Only a bare executable name is ever put in a registry path.
  if (typeof exeName !== 'string' || !/^[a-z0-9.-]+\.exe$/i.test(exeName)) return null;
  for (const hive of ['HKCU', 'HKLM']) {
    const found = parseAppPathsOutput(await queryReg(hive, exeName));
    if (found && exists(found)) return found;
  }
  return knownBrowserPaths(exeName, env).find((candidate) => exists(candidate)) ?? null;
}

function defaultLaunch(exe, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { detached: true, stdio: 'ignore', windowsHide: false });
    child.once('error', reject);
    child.once('spawn', () => { child.unref(); resolve(); });
  });
}

/** Opens the browser on the extension's page. Resolves { ok, ... } and never
 * throws: an unknown browser, a browser that is not installed any more, and a
 * launch that fails are each a sentence the screen can show. */
export async function manageExtension(target, { findExe = findBrowserExe, launch = defaultLaunch } = {}) {
  const plan = buildManagePlan(target);
  if (!plan.ok) return plan;
  const exe = await findExe(plan.exeName);
  if (!exe) return { ok: false, error: `Prune could not find ${plan.browser} on this PC, so it cannot open its extensions page.` };
  try {
    await launch(exe, plan.args);
    return { ok: true, browser: plan.browser };
  } catch (err) {
    return { ok: false, error: `${plan.browser} could not be started: ${err.message}` };
  }
}
