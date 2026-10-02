/** How hard the leftover scan looks, as the uninstall dialog offers it.
 * The backend owns the meaning of each mode (services/leftoverModes.js);
 * this is the list, in order of depth, and how a choice is read back. */
export const SCAN_MODES = ['safe', 'moderate', 'advanced'];

/** The remembered mode, or Moderate -- the default -- when settings have not
 * loaded or hold something this version does not know. */
export function scanModeFrom(settings) {
  return SCAN_MODES.includes(settings?.leftoverScanMode) ? settings.leftoverScanMode : 'moderate';
}

/** What the program itself says about where it lives, for the scanner.
 * Only values that are really there: the backend treats an absent anchor as
 * "nothing authoritative", and a blank string is not an anchor. */
export function anchorsFor(program) {
  const anchors = {};
  if (typeof program?.installLocation === 'string' && program.installLocation.trim()) {
    anchors.installLocation = program.installLocation;
  }
  if (typeof program?.registryKey === 'string' && program.registryKey.trim()) {
    anchors.registryKey = program.registryKey;
  }
  return anchors;
}
