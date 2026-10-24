import { startupRemovalTarget, disabledRemovalTarget } from './startupRemovalTarget.js';
import { escapeCsvField } from './exportCsv.js';

/** Pure helpers behind the startup screen's search, bulk removal, export
 * and per-entry menu -- kept out of the component so each rule is tested
 * on its own rather than through the DOM. */

/** The entries matching a free-text query on name, launch path, publisher,
 * description or location. Blank matches everything. */
export function filterStartupItems(items, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return items || [];
  return (items || []).filter((item) =>
    [item.name, item.command, item.publisher, item.description, item.location]
      .some((field) => typeof field === 'string' && field.toLowerCase().includes(needle)));
}

/** Every invalid entry Prune can remove, as ONE Quarantine batch, so a
 * single Undo puts them all back. */
export function invalidRemovalBatch(items) {
  return removalBatch(items, startupRemovalTarget);
}

/** Every switched-off entry Prune can remove, as ONE Quarantine batch, the
 * same way -- "Remove N disabled". An entry that is both dead and switched
 * off is in this batch and the invalid one; whichever runs first removes
 * it, and the re-read list drops it from the other. */
export function disabledRemovalBatch(items) {
  return removalBatch(items, disabledRemovalTarget);
}

function removalBatch(items, targetOf) {
  const batch = { ids: [], names: [], files: [], registryKeys: [] };
  for (const item of items || []) {
    const target = targetOf(item);
    if (!target) continue;
    batch.ids.push(item.id);
    batch.names.push(item.name);
    batch.files.push(...target.files);
    batch.registryKeys.push(...target.registryKeys);
  }
  return batch;
}

const escapeHtml = (text) => String(text ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const stamp = (now) => {
  const d = new Date(now);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** The list as a file: 'csv', 'html' or 'txt'. `labels` are the translated
 * column names (plus `title`), `status(item)` the translated status word. */
export function startupExport(items, format, { labels, status, now = Date.now() }) {
  const rows = (items || []).map((item) => [
    item.name || '', item.command || '', item.publisher || '', item.location || '', status(item)
  ]);
  const header = [labels.name, labels.command, labels.publisher, labels.location, labels.status];
  const base = `prune-startup-${stamp(now)}`;

  if (format === 'csv') {
    // The byte-order mark makes Excel read the file as UTF-8 (see exportCsv.js).
    const lines = [header, ...rows].map((row) => row.map(escapeCsvField).join(','));
    return { content: `﻿${lines.join('\r\n')}\r\n`, filename: `${base}.csv`, type: 'text/csv;charset=utf-8' };
  }
  if (format === 'html') {
    const head = `<tr>${header.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
    const body = rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('\n');
    const content = `<!doctype html>
<html><head><meta charset="utf-8"><title>${escapeHtml(labels.title)}</title>
<style>body{font:13px system-ui,sans-serif;margin:24px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:4px 8px;text-align:left;vertical-align:top}th{background:#f3f3f3}td:nth-child(2){font-family:Consolas,monospace;word-break:break-all}</style>
</head><body><h1>${escapeHtml(labels.title)}</h1>
<table>
${head}
${body}
</table></body></html>
`;
    return { content, filename: `${base}.html`, type: 'text/html;charset=utf-8' };
  }
  const blocks = rows.map((row) => row.map((cell, i) => (i === 0 ? cell : `  ${header[i]}: ${cell}`)).join('\r\n'));
  return { content: `${blocks.join('\r\n\r\n')}\r\n`, filename: `${base}.txt`, type: 'text/plain;charset=utf-8' };
}

/** Which per-entry commands apply, in menu order. An action with nothing to
 * act on is left out rather than shown disabled, as a context menu should. */
export function startupActionsFor(item) {
  const actions = [];
  const hasProgram = item?.exists !== false && Boolean(item?.command);
  const processable = ['registry', 'folder', 'task', 'service'].includes(item?.source);
  if (processable && hasProgram) actions.push(item.running ? 'end' : 'run');
  actions.push('location');
  if (hasProgram && item?.source !== 'appx') actions.push('folder');
  if (item?.command) actions.push('copy');
  if (startupRemovalTarget(item)) actions.push('remove');
  return actions;
}
