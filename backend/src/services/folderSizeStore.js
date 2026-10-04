import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** How long a measured install-folder size counts as fresh across launches.
 *
 * Walking the install folders of the programs whose registry entry has no
 * size costs tens of CPU-seconds on a big machine (every file is stat-ed:
 * ~125 GB, ~100,000 files here) and the answer barely moves from one day to
 * the next. Re-measuring on every launch is what made the first minute so
 * expensive, so the last answer is kept on disk and reused for a day. A
 * program that grows or shrinks sooner than that shows the earlier figure
 * until the entry expires -- these are the estimates for programs that report
 * no size of their own, and a day-old estimate is still an honest one. */
export const FOLDER_SIZE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/** Past a day a kept size is stale, but it is still far better than a blank:
 * it is shown straight away and measured again once the app has settled (see
 * refreshStaleSizes in programSizes.js), so the next launch has the new one.
 * Past this, it is too old to show and the folder is measured on the spot. */
export const FOLDER_SIZE_MAX_USABLE_AGE_MS = 30 * 24 * 60 * 60 * 1000;

const FILE_NAME = 'folder-sizes.json';

/** A small on-disk memory of measured folder sizes, keyed by the folder and by
 * which nested folders were left out of the measure (the same folder measured
 * with a different set of exclusions is a different number).
 *
 * Best-effort throughout: an unreadable or corrupt file is an empty store, and
 * a failed save is ignored -- the cost is only that the folders are measured
 * again next time. */
export function createFolderSizeStore({
  path, maxAgeMs = FOLDER_SIZE_MAX_AGE_MS, maxUsableAgeMs = FOLDER_SIZE_MAX_USABLE_AGE_MS, now = Date.now
} = {}) {
  let entries = null;
  let dirty = false;

  const keyOf = (folder) => folder.replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();

  return {
    async load() {
      if (entries) return;
      entries = new Map();
      if (!path) return;
      try {
        const parsed = JSON.parse(await readFile(path, 'utf8'));
        if (parsed?.version !== 1 || typeof parsed.entries !== 'object' || parsed.entries === null) return;
        for (const [key, value] of Object.entries(parsed.entries)) {
          if (Number.isFinite(value?.bytes) && Number.isFinite(value?.at) && typeof value?.ex === 'string') {
            entries.set(key, value);
          }
        }
      } catch {
        // No file yet, or one that cannot be read: measure from scratch.
      }
    },

    /** `{ bytes, fresh }` for a kept size, or undefined when there is none, it
     * is too old to show, or it was measured with a different set of
     * exclusions. `fresh: false` means usable but due to be measured again. */
    lookup(folder, exclusions) {
      const entry = entries?.get(keyOf(folder));
      if (!entry || entry.ex !== exclusions) return undefined;
      const age = now() - entry.at;
      if (age < 0 || age >= maxUsableAgeMs) return undefined;
      return { bytes: entry.bytes, fresh: age < maxAgeMs };
    },

    set(folder, exclusions, bytes) {
      if (!path || !entries || !(bytes > 0)) return; // a zero is not worth remembering
      entries.set(keyOf(folder), { bytes, at: now(), ex: exclusions });
      dirty = true;
    },

    async save() {
      if (!path || !dirty || !entries) return;
      dirty = false;
      // Entries too old to ever be shown are not carried forward.
      const live = {};
      for (const [key, value] of entries) {
        if (now() - value.at < maxUsableAgeMs) live[key] = value;
      }
      const tmp = `${path}.${process.pid}.tmp`;
      try {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(tmp, JSON.stringify({ version: 1, entries: live }), 'utf8');
        await rename(tmp, path);
      } catch {
        await rm(tmp, { force: true }).catch(() => {});
      }
    }
  };
}

/** The store the app uses: beside settings.json, only when the app has told
 * the backend where that lives (UNREVO_SETTINGS_PATH, set by Electron's main
 * process). A bare `node src/index.js`, and the tests, keep nothing on disk. */
export function defaultFolderSizeStore() {
  const settings = process.env.UNREVO_SETTINGS_PATH;
  return createFolderSizeStore({ path: settings ? join(dirname(settings), FILE_NAME) : null });
}
