import { readFile, writeFile, rename, rm, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

/** The last answer to a slow question, kept on disk between launches.
 *
 * Prune's icons and its Store-app list cost seconds to compute (a PowerShell
 * scan that measures every package folder, a search for each program's main
 * executable) and change very little from one launch to the next. Computing
 * them again on every launch is why the icons appeared a while after the
 * window did. This keeps the finished answer beside settings.json so the next
 * launch can show it at once and refresh it quietly behind the scenes.
 *
 * Best-effort throughout, like folderSizeStore: an unreadable or corrupt file
 * is no snapshot, and a failed save is ignored -- the cost is only that the
 * next launch computes again. With no path (a bare `node src/index.js`, and
 * every test) it keeps nothing, so behaviour there is unchanged. */
export function createSnapshotStore({ path, version = 1 } = {}) {
  return {
    /** The saved value, or null when there is none or it cannot be read. */
    async read() {
      if (!path) return null;
      try {
        const parsed = JSON.parse(await readFile(path, 'utf8'));
        if (parsed?.version !== version || parsed.value === undefined || parsed.value === null) return null;
        return parsed.value;
      } catch {
        return null;
      }
    },

    /** Saves the value atomically: written beside the target, then renamed, so
     * a crash mid-write leaves the previous snapshot rather than half of one. */
    async write(value) {
      if (!path || value === undefined || value === null) return;
      const tmp = `${path}.${process.pid}.tmp`;
      try {
        await mkdir(dirname(path), { recursive: true });
        await writeFile(tmp, JSON.stringify({ version, at: Date.now(), value }), 'utf8');
        await rename(tmp, path);
      } catch {
        await rm(tmp, { force: true }).catch(() => {});
      }
    }
  };
}

/** A snapshot beside settings.json, only when the app has told the backend
 * where that lives (UNREVO_SETTINGS_PATH, set by Electron's main process). */
export function defaultSnapshotStore(fileName) {
  const settings = process.env.UNREVO_SETTINGS_PATH;
  return createSnapshotStore({ path: settings ? join(dirname(settings), fileName) : null });
}
