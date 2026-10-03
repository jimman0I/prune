import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Prune must never read the keyboard or poll the pointer.
 *
 * The lesson of the Defender detection (Behavior:Win32/WebBrowserCredAccess.E2,
 * see noBrowserLaunch.test.js): an unsigned program is judged by what it LOOKS
 * like it does. Polling the key state to see whether a button is down, or
 * reading the pointer position on a timer, is exactly how a keylogger or a
 * click-stealer is written, and the old Hunter did both from PowerShell.
 *
 * Hunter is now a draggable crosshair: Electron reports where it was dropped
 * and the backend answers about that one fixed point. Nothing in the shipped
 * code may call the Win32 functions that poll input, which are named below.
 * If a feature truly needs one, it does not belong in a cleaner that has to
 * stay clean to antivirus. Tests are exempt (they may name these to assert
 * their absence); everything shipped is scanned, comments included, so the
 * names cannot creep back in a pasted script. */

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..', '..');
const backendSrc = join(root, 'backend', 'src');
const electronDir = join(root, 'electron');

function sourceFiles(dir, { recursive }) {
  const found = [];
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name === 'build') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      if (recursive) found.push(...sourceFiles(full, { recursive }));
      continue;
    }
    if (!/\.(js|cjs|mjs)$/.test(name) || /\.test\.(js|cjs|mjs)$/.test(name)) continue;
    found.push(full);
  }
  return found;
}

const POLLING_APIS = /GetAsyncKeyState|GetCursorPos/;
const files = [...sourceFiles(backendSrc, { recursive: true }), ...sourceFiles(electronDir, { recursive: false })];
const rel = (file) => relative(root, file).replaceAll('\\', '/');

describe('Prune never polls the keyboard or the pointer (Defender lesson)', () => {
  it('scans a real set of source files', () => {
    expect(files.length).toBeGreaterThan(100);
    expect(files.some((f) => rel(f) === 'electron/main.cjs')).toBe(true);
    expect(files.some((f) => rel(f) === 'backend/src/services/hunter.js')).toBe(true);
    expect(files.every((f) => !/\.test\./.test(f))).toBe(true);
  });

  it('no shipped source names GetAsyncKeyState or GetCursorPos', () => {
    const offenders = files.filter((file) => POLLING_APIS.test(readFileSync(file, 'utf8'))).map(rel);
    expect(offenders).toEqual([]);
  });

  it('the rule catches the shape of the old Hunter script', () => {
    expect(POLLING_APIS.test('[DllImport("user32.dll")] public static extern short GetAsyncKeyState(int key);')).toBe(true);
    expect(POLLING_APIS.test('[void][PruneHunter]::GetCursorPos([ref]$point)')).toBe(true);
    expect(POLLING_APIS.test('WindowFromPoint(POINT point); GetAncestor(IntPtr w, uint f);')).toBe(false);
  });
});
