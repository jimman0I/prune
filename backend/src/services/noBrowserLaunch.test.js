import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Prune must never start a browser.
 *
 * Microsoft Defender detected an earlier build as
 * Behavior:Win32/WebBrowserCredAccess.E2 (severity 5), terminated Prune.exe
 * and flagged it. That behaviour rule fires on an unsigned process that
 * launches a browser with profile arguments (--profile-directory=...), because
 * that is how a credential stealer opens someone's logged-in profile. The
 * trigger was the browser extension "Manage" button, which spawned chrome.exe
 * with --profile-directory and chrome://extensions/?id=... .
 *
 * A cleaner flagged by antivirus is unusable, so "Manage" now copies the
 * extension page's address instead (services/extensionPage.js), and this test
 * keeps any code that launches a browser from coming back. It scans the
 * shipped backend and Electron main-process sources (not tests) for:
 *
 *   1. a browser debugging/profile flag: --profile-directory, --remote-debugging
 *   2. a browser executable name (chrome.exe, msedge.exe, ...) in a file that
 *      also starts processes (spawn / exec / execFile / shell.openPath ...)
 *
 * Merely naming a browser is fine -- cleaning categories, "is it running"
 * checks and path lists do that. If a file legitimately has to start a process
 * AND name a browser, add it to ALLOWED with the reason; do not launch one. */

const here = dirname(fileURLToPath(import.meta.url));
const backendSrc = join(here, '..');
const electronDir = join(here, '..', '..', '..', 'electron');

/** Sources checked: .js/.cjs/.mjs, minus tests and test support. */
function sourceFiles(dir, { recursive }) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'build') continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (recursive && name !== 'testSupport') found.push(...sourceFiles(full, { recursive }));
      continue;
    }
    if (!/\.(js|cjs|mjs)$/.test(name) || /\.test\.(js|cjs|mjs)$/.test(name)) continue;
    found.push(full);
  }
  return found;
}

const FORBIDDEN_FLAGS = /--profile-directory|--remote-debugging/;
const BROWSER_EXE = /\b(?:chrome|msedge|brave|firefox|vivaldi|opera|librewolf|waterfox|zen|seamonkey|iexplore)\.exe\b/i;
const STARTS_PROCESSES = /\b(?:spawn|spawnSync|execFile|execFileSync|exec|execSync|fork)\s*\(|\bshell\.(?:openPath|openExternal)\s*\(|Start-Process/;

// repo-relative path (forward slashes) -> why that file may name a browser exe and start processes
const ALLOWED = {};

const files = [
  ...sourceFiles(backendSrc, { recursive: true }),
  ...sourceFiles(electronDir, { recursive: false })
];
const rel = (file) => relative(join(here, '..', '..', '..'), file).replaceAll('\\', '/');

/** What a file does that launches a browser, as a list of reasons. The
 * self-tests below prove the rule against the old code's shape. */
function browserLaunchProblems(source) {
  const problems = [];
  if (FORBIDDEN_FLAGS.test(source)) problems.push('uses --profile-directory / --remote-debugging');
  if (BROWSER_EXE.test(source) && STARTS_PROCESSES.test(source)) problems.push('names a browser executable and starts processes');
  return problems;
}

describe('Prune never launches a browser (Defender: Behavior:Win32/WebBrowserCredAccess.E2)', () => {
  it('scans a real set of source files', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => rel(f) === 'electron/main.cjs')).toBe(true);
    expect(files.some((f) => rel(f).startsWith('backend/src/services/'))).toBe(true);
    expect(files.every((f) => !/\.test\./.test(f))).toBe(true);
  });

  it('no shipped source launches a browser or passes it profile / debugging flags', () => {
    const offenders = files
      .map((file) => ({ file: rel(file), problems: browserLaunchProblems(readFileSync(file, 'utf8')) }))
      .filter(({ file, problems }) => problems.length && !(file in ALLOWED));
    expect(offenders).toEqual([]);
  });

  describe('the rule itself', () => {
    it('flags the shape of the code that triggered Defender', () => {
      const old = `
        import { spawn } from 'node:child_process';
        const CHROMIUM = { Chrome: { exe: 'chrome.exe', scheme: 'chrome' } };
        const args = ['--profile-directory=Default', 'chrome://extensions/?id=x'];
        spawn(exe, args, { detached: true });`;
      expect(browserLaunchProblems(old)).toHaveLength(2);
    });

    it('flags a debugging port and an exe launched with execFile', () => {
      expect(browserLaunchProblems(`const a = '--remote-debugging-port=9222';`)).toHaveLength(1);
      expect(browserLaunchProblems(`execFile('C:\\\\Program Files\\\\BraveSoftware\\\\brave.exe', [])`)).toHaveLength(1);
      expect(browserLaunchProblems(`shell.openPath(p); const n = 'msedge.exe';`)).toHaveLength(1);
    });

    it('leaves alone code that only names a browser, or only starts other processes', () => {
      expect(browserLaunchProblems(`const running = ['chrome.exe', 'firefox.exe'].includes(name);`)).toEqual([]);
      expect(browserLaunchProblems(`execFile('powershell.exe', ['-NoProfile']); // Chrome cache paths`)).toEqual([]);
      expect(browserLaunchProblems(`const dirs = ['Google/Chrome/User Data/Default/Cache'];`)).toEqual([]);
    });
  });
});
