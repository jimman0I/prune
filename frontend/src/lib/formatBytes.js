/** Bytes as the app writes them everywhere: one decimal at most, and a dash
 * -- never a zero -- for a value nobody measured.
 *
 * Which thousand a "K" is, and what it is called, is the person's choice
 * (Settings > General > Size units), because the two conventions are both
 * real and they disagree by 7% at a gigabyte and 10% at a terabyte:
 *
 *   'windows' (the default) -- 1024-based, labelled KB, MB, GB. Exactly what
 *     File Explorer prints, so a folder Prune calls 29.4 GB is the folder
 *     Explorer's Properties sheet calls 29.4 GB. This is what Prune always
 *     printed; nothing changes for anyone who never opens the setting.
 *   'binary' -- the same 1024-based numbers, labelled with the IEC names
 *     KiB, MiB, GiB, which say outright which thousand they mean.
 *   'decimal' -- 1000-based, labelled KB, MB, GB: the drive maker's
 *     gigabyte, the one printed on the box (and the one macOS uses), so a
 *     "1 TB" drive reads 1 TB rather than 931 GB.
 *
 * The label always goes with the arithmetic -- there is no mode that prints
 * an IEC name over a 1000-based figure or the reverse.
 *
 * App-wide without a prop through every screen: the current choice is held
 * here, set by LanguageProvider from the settings query (the same place the
 * language comes from, and the same "remember it locally for the first
 * paint" treatment), and every screen that prints a size reads it through
 * this one function. The backend keeps its own copy of the rules for the
 * text it writes itself -- the tray tooltip, the low-disk notification and
 * the command line -- in backend/src/lib/sizeUnits.js; formatBytes.test.js
 * checks the two agree. */
export const SIZE_UNITS = ['windows', 'binary', 'decimal'];

export const DEFAULT_SIZE_UNITS = 'windows';

/** Anything that is not one of the three -- missing, a typo, a value from a
 * newer version -- reads as the default, which is what Prune always did. */
export function normalizeSizeUnits(value) {
  return SIZE_UNITS.includes(value) ? value : DEFAULT_SIZE_UNITS;
}

const BASE = { windows: 1024, binary: 1024, decimal: 1000 };
const LABELS = {
  windows: ['B', 'KB', 'MB', 'GB', 'TB'],
  binary: ['B', 'KiB', 'MiB', 'GiB', 'TiB'],
  decimal: ['B', 'KB', 'MB', 'GB', 'TB']
};

let current = DEFAULT_SIZE_UNITS;

/** Called by LanguageProvider while it renders, before any screen under it
 * does, so a screen never paints with the previous choice. */
export function setSizeUnits(units) {
  current = normalizeSizeUnits(units);
}

export function getSizeUnits() {
  return current;
}

/** How many bytes one unit at `power` is (1 for B, 1024 or 1000 for K...). */
export function unitBytes(power, units = current) {
  return BASE[normalizeSizeUnits(units)] ** power;
}

/** The name of the unit at `power` in the given mode: 3 is 'GB' or 'GiB'. */
export function unitLabel(power, units = current) {
  return LABELS[normalizeSizeUnits(units)][power];
}

export function formatBytes(bytes, units = current) {
  if (bytes === null || bytes === undefined) return '—';
  if (bytes === 0) return '0 B';
  const mode = normalizeSizeUnits(units);
  const sizes = LABELS[mode];
  // Clamped both ways: below 1 byte (a fraction from an average) is still
  // bytes, and past the last unit the figure grows rather than the label
  // running off the end of the list into "undefined".
  const i = Math.max(0, Math.min(sizes.length - 1, Math.floor(Math.log(Math.abs(bytes)) / Math.log(BASE[mode]))));
  return `${parseFloat((bytes / BASE[mode] ** i).toFixed(1))} ${sizes[i]}`;
}
