/** The Disk Map's CSV export: the rows of the view on screen, as a file a
 * spreadsheet opens correctly.
 *
 * Three things are easy to get wrong and each was decided on purpose:
 *
 *  - Escaping is RFC 4180: a field with a comma, a quote or a line break is
 *    quoted and its quotes doubled. File names can hold all three.
 *  - A name that starts with = + - @ (or a tab) would be run as a FORMULA by
 *    Excel, so text like that gets a leading apostrophe. Numbers are not
 *    text and are left alone, so a real negative number stays one.
 *  - A byte-order mark leads the file. Without it Excel reads UTF-8 as the
 *    local code page and turns every non-ASCII name to mojibake. */
export const CSV_COLUMNS = ['path', 'size', 'allocated', 'files', 'folders', 'modified'];

const FORMULA_START = /^[=+\-@\t\r]/;

export function escapeCsvField(value) {
  if (value === null || value === undefined) return '';
  let text = String(value);
  if (typeof value === 'string' && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const iso = (ms) => (typeof ms === 'number' && Number.isFinite(ms) ? new Date(ms).toISOString() : '');

/** `rows` are the view's rows: { fullPath | name, size, allocated, files,
 * folders, modified }. Missing figures are written empty, never as zero --
 * an unmeasured value and a measured zero are different facts. */
export function rowsToCsv(rows) {
  const lines = [CSV_COLUMNS.join(',')];
  for (const row of rows ?? []) {
    lines.push([
      escapeCsvField(row.fullPath || row.name),
      escapeCsvField(row.size),
      escapeCsvField(row.allocated),
      escapeCsvField(row.files),
      escapeCsvField(row.folders),
      escapeCsvField(iso(row.modified))
    ].join(','));
  }
  return `﻿${lines.join('\r\n')}\r\n`;
}

/** prune-<folder>-<date>.<ext>, safe to save on Windows. */
export function exportFileName(path, extension, now = new Date()) {
  const parts = String(path ?? '').split(/[\\/]+/).filter(Boolean);
  const last = parts.at(-1) ?? '';
  const label = (last.replace(/:$/, '') || 'diskmap').replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_');
  return `prune-${label}-${now.toISOString().slice(0, 10)}.${extension}`;
}
