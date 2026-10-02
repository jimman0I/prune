/** What an entry may carry -- the one place that decides it, kept apart from
 * the log's file I/O so the route can use it without the file layer.
 *
 * The log started as { programName, publisher,
 * sizeBytes, timestamp }; it now records what happened too -- the scan mode,
 * how many leftovers were found and removed, where they went, and which
 * safety nets existed -- so the History view can say more than a name.
 * Everything arrives from a request body, so only these fields, only of the
 * right type, are ever written. */
const STRING_FIELDS = [
  'programName', 'publisher', 'version', 'scanMode', 'destination', 'outcome', 'kind',
  'quarantineBatch', 'registryBackup'
];
const NUMBER_FIELDS = ['sizeBytes', 'leftoversFound', 'leftoversRemoved', 'bytesFreed', 'tasksRemoved', 'failedCount'];
const MAX_TEXT = 500;

export function cleanEntryFields(input) {
  const out = {};
  if (!input || typeof input !== 'object') return out;
  for (const field of STRING_FIELDS) {
    if (typeof input[field] === 'string') out[field] = input[field].slice(0, MAX_TEXT);
  }
  for (const field of NUMBER_FIELDS) {
    if (typeof input[field] === 'number' && Number.isFinite(input[field])) out[field] = input[field];
  }
  const restore = input.restorePoint;
  if (restore && typeof restore === 'object' && typeof restore.created === 'boolean') {
    out.restorePoint = { created: restore.created };
    if (typeof restore.reason === 'string') out.restorePoint.reason = restore.reason.slice(0, MAX_TEXT);
  }
  return out;
}

