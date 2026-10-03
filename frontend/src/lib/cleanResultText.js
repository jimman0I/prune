import { cleanOutcome } from './cleanOutcome.js';
import { formatBytes } from './formatBytes.js';

/** What a finished clean says, as sentences: deleted bytes as "Freed", moved
 * bytes as "Moved to ...", never "Freed" for files that only changed folders.
 *
 * Shared by Deep Clean and the Dashboard's Clean recommended so the two can
 * never describe the same clean differently. `t` is the language hook's. */
export function cleanResultSentences(result, t) {
  const { freedBytes, movedBytes, movedTo } = cleanOutcome(result);
  const sentences = [];
  const wipe = (result?.results ?? []).map((r) => r?.wiped).find(Boolean);
  // A wipe frees nothing, so "Freed 0 B" beside it would only mislead.
  if (freedBytes > 0 || (movedBytes === 0 && !wipe)) sentences.push(t('deepClean.resultFreed', formatBytes(freedBytes)));
  if (wipe) {
    // Three passes write random data, and the sentence must say so: the
    // zeros wording would be untrue.
    const key = wipe.pattern === 'random'
      ? (wipe.aborted ? 'deepCleanV3.wipe.resultRandomStopped' : 'deepCleanV3.wipe.resultRandom')
      : (wipe.aborted ? 'deepClean.resultWipeStopped' : 'deepClean.resultWiped');
    sentences.push(t(key, formatBytes(wipe.bytesWritten), wipe.passes));
  }
  if (movedBytes > 0) {
    sentences.push(movedTo === 'recycle'
      ? t('deepClean.resultRecycled', formatBytes(movedBytes))
      : t('deepClean.resultMoved', formatBytes(movedBytes)));
  }
  // Locked files handed to Windows to delete at the next restart: still on
  // the disk, so neither freed nor skipped.
  const scheduled = (result?.results ?? []).reduce((n, r) => n + (Number(r?.scheduledForRestart) || 0), 0);
  if (scheduled > 0) sentences.push(t('deepCleanV3.locked.scheduled', scheduled));
  return sentences;
}

/** The sentences joined: "Freed 5 KB. Moved 3 MB to Quarantine. ..." */
export function cleanResultText(result, t) {
  return cleanResultSentences(result, t).map((x) => (/[.!?]$/.test(x) ? x : `${x}.`)).join(' ');
}
