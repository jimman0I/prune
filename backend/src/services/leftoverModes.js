import { join } from 'node:path';

/** How hard the leftover scan looks -- Revo's Safe / Moderate / Advanced.
 *
 * Safe     only what the program itself names: the InstallLocation it
 *          registered and its own registry key. Nothing is guessed, so
 *          nothing in the result can be somebody else's.
 * Moderate the roots Prune has always searched (one level under Program
 *          Files, AppData, ProgramData and the Start Menu, plus the
 *          registry sweep), plus those anchors. The default.
 * Advanced a recursive, depth-limited search of many more places, matching
 *          on the product name, the publisher and the distinctive words in
 *          the name. It finds more and it is wrong more often, which is
 *          why the review tiers what it finds.
 *
 * The mode is chosen in the uninstall dialog and remembered as a setting;
 * the backend acts on the one the request carries, and falls back to
 * Moderate for anything it does not recognise. */
export const SCAN_MODES = ['safe', 'moderate', 'advanced'];
export const DEFAULT_SCAN_MODE = 'moderate';

export function normalizeScanMode(mode) {
  return SCAN_MODES.includes(mode) ? mode : DEFAULT_SCAN_MODE;
}

/** The places the Advanced scan walks, each with how deep it may go.
 *
 * `env` is a parameter so a test can hand it a fake machine. A root whose
 * variable is unset is dropped, never emitted as "undefined\\...": joining
 * onto a missing base would search the current directory instead.
 *
 * Temp is one level deep on purpose: it holds everything, and a program's
 * leftovers there are top-level files and folders it named itself.
 * `shortcuts` roots also match .lnk and .url files, which is what the Start
 * Menu and the desktop hold. */
export function advancedFileRoots(env = process.env) {
  const roots = [];
  const add = (base, parts, options) => {
    if (typeof base !== 'string' || !base) return;
    roots.push({ path: parts.length ? join(base, ...parts) : base, ...options });
  };

  add(env.ProgramFiles, [], { depth: 3 });
  add(env['ProgramFiles(x86)'], [], { depth: 3 });
  add(env.ProgramFiles, ['Common Files'], { depth: 2 });
  add(env['ProgramFiles(x86)'], ['Common Files'], { depth: 2 });
  add(env.ProgramData, [], { depth: 3 });
  add(env.APPDATA, [], { depth: 3 });
  add(env.LOCALAPPDATA, [], { depth: 3 });
  add(env.LOCALAPPDATA, ['Programs'], { depth: 3 });
  add(env.USERPROFILE, ['AppData', 'LocalLow'], { depth: 3 });
  add(env.TEMP, [], { depth: 1 });
  add(env.APPDATA, ['Microsoft', 'Windows', 'Start Menu', 'Programs'], { depth: 3, shortcuts: true });
  add(env.ProgramData, ['Microsoft', 'Windows', 'Start Menu', 'Programs'], { depth: 3, shortcuts: true });
  add(env.USERPROFILE, ['Desktop'], { depth: 1, shortcuts: true });
  add(env.PUBLIC, ['Desktop'], { depth: 1, shortcuts: true });

  // The same folder can be reached by two variables (TEMP sits under
  // LOCALAPPDATA); walking it twice would only report its matches twice.
  const seen = new Set();
  return roots.filter((root) => {
    const key = root.path.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
