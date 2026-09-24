import { randomUUID } from 'node:crypto';

/** Finished disk-scan trees, held briefly so the client can fetch one after
 * the SSE stream's `complete` event.
 *
 * A tree for a big drive is tens of MB, which is why it is not sent inside
 * the stream. In memory only, at most SCAN_RESULT_CAP entries (oldest evicted
 * first), each good for SCAN_RESULT_TTL_MS. Expiry is checked lazily on read
 * and on insert, so there are no timers to keep the process alive. Reading
 * does not delete, so a client retry of the fetch still works.
 *
 * `now` is injectable so tests need no fake timers.
 */
export const SCAN_RESULT_TTL_MS = 120_000;
export const SCAN_RESULT_CAP = 2;

const results = new Map(); // id -> { tree, expiresAt }; insertion order = age

function dropExpired(now) {
  for (const [id, entry] of results) {
    if (entry.expiresAt <= now) results.delete(id);
  }
}

export function putScanResult(tree, now = Date.now()) {
  dropExpired(now);
  const id = randomUUID();
  results.set(id, { tree, expiresAt: now + SCAN_RESULT_TTL_MS });
  while (results.size > SCAN_RESULT_CAP) {
    results.delete(results.keys().next().value);
  }
  return id;
}

export function getScanResult(id, now = Date.now()) {
  dropExpired(now);
  return results.get(id)?.tree;
}
