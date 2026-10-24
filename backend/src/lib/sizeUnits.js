/** How the backend writes a size in the few places it writes one itself:
 * the tray icon's tooltip, the low-disk notification and the command line.
 * Everything a screen shows is formatted by the window (frontend
 * src/lib/formatBytes.js); this is the same three rules, kept here because
 * the two are separate packages with no code path between them, and
 * frontend formatBytes.test.js imports this file to check they agree.
 *
 * The choice lives in settings.json as `sizeUnits`:
 *   'windows' (default) -- 1024-based, labelled KB/MB/GB, as File Explorer does;
 *   'binary'            -- 1024-based, labelled KiB/MiB/GiB;
 *   'decimal'           -- 1000-based, labelled KB/MB/GB, as drive makers do.
 * The label always goes with the arithmetic. Its own small file, like
 * lowDiskChoices.js, so settings.js can validate the choice without importing
 * anything that reads a disk. */
export const SIZE_UNITS = ['windows', 'binary', 'decimal'];
export const DEFAULT_SIZE_UNITS = 'windows';

/** Exactly one of the three, else the default -- what Prune always printed. */
export function normalizeSizeUnits(value) {
  return SIZE_UNITS.includes(value) ? value : DEFAULT_SIZE_UNITS;
}

const BASE = { windows: 1024, binary: 1024, decimal: 1000 };
const LABELS = {
  windows: ['B', 'KB', 'MB', 'GB', 'TB'],
  binary: ['B', 'KiB', 'MiB', 'GiB', 'TiB'],
  decimal: ['B', 'KB', 'MB', 'GB', 'TB']
};

/** The window's formatBytes, byte for byte: one decimal at most, trailing
 * zero dropped, the largest unit the figure reaches. `missing` is what a
 * value nobody measured reads as (the window uses an em dash; the command
 * line a plain '-', which every console font has). */
export function formatBytes(bytes, units, { missing = '—' } = {}) {
  if (bytes === null || bytes === undefined) return missing;
  if (bytes === 0) return '0 B';
  const mode = normalizeSizeUnits(units);
  const sizes = LABELS[mode];
  const i = Math.max(0, Math.min(sizes.length - 1, Math.floor(Math.log(Math.abs(bytes)) / Math.log(BASE[mode]))));
  return `${parseFloat((bytes / BASE[mode] ** i).toFixed(1))} ${sizes[i]}`;
}

/** A figure always in gigabytes, one decimal at most ("12.4 GB", "250 GB",
 * "11.5 GiB") -- the low-disk notification's shape, which has always said
 * both figures in the same unit so "0.8 GB free of 250 GB" compares at a
 * glance. */
export function formatGigabytes(bytes, units) {
  const mode = normalizeSizeUnits(units);
  return `${parseFloat((bytes / BASE[mode] ** 3).toFixed(1))} ${LABELS[mode][3]}`;
}

/** The same, with exactly one decimal kept ("12.0 GB", "11.2 GiB") -- the
 * tray tooltip's shape, where RAM and disk sit on lines of their own. */
export function formatGigabytesFixed(bytes, units) {
  const mode = normalizeSizeUnits(units);
  return `${(bytes / BASE[mode] ** 3).toFixed(1)} ${LABELS[mode][3]}`;
}
