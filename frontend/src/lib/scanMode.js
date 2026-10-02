/** Which way the user last chose to scan a drive: 'fast' (the file index,
 * administrator) or 'crawl' (folder by folder, no permission).
 *
 * Pure UI memory in localStorage, like fastScanDuration.js and
 * settingsTab.js: nobody needs it synced or in the config file. It decides
 * only which button is emphasised and focused the next time the drive
 * chooser opens -- it never starts a scan by itself, because the fast one
 * can raise a consent dialog and that stays behind a click. */
export const SCAN_MODE_KEY = 'prune.diskScanMode';

const MODES = ['fast', 'crawl'];

export function readScanMode(storage) {
  try {
    const value = storage?.getItem(SCAN_MODE_KEY);
    return MODES.includes(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeScanMode(storage, mode) {
  if (!MODES.includes(mode)) return false;
  try {
    storage?.setItem(SCAN_MODE_KEY, mode);
    return true;
  } catch {
    return false;
  }
}
