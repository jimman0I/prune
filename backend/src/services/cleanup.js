import * as fs from 'node:fs';
import { join } from 'node:path';
import { runPowerShellJson } from './powershell.js';

// Root path resolvers -- functions, not constants, read at call time and
// overridable via env vars, same pattern quarantine.js's quarantineRoot()
// already establishes -- so tests use a real tmp fixture and never touch
// this machine's real Temp/LocalAppData/browser caches.
export function tempRoot() {
  return process.env.UNREVO_TEMP_ROOT || process.env.TEMP || process.env.TMP || '';
}
export function windowsTempRoot() {
  return process.env.UNREVO_WINDOWS_TEMP_ROOT || 'C:\\Windows\\Temp';
}
export function localAppDataRoot() {
  return process.env.UNREVO_LOCALAPPDATA_ROOT || process.env.LOCALAPPDATA || '';
}

/** Recursively sums the byte size of everything under `dirPath`. An entry
 * that can't be listed/stat'd (permission error, gone by the time it's
 * visited, the root itself missing) contributes 0 rather than failing the
 * whole sum -- same partial-over-total-failure philosophy leftoverScan.js
 * already uses for its own independent checks. */
async function dirSize(dirPath) {
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return 0;
  }
  let total = 0;
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      total += await dirSize(full);
    } else {
      try {
        total += (await fs.promises.stat(full)).size;
      } catch { /* gone/inaccessible -- skip */ }
    }
  }
  return total;
}

/** Deletes every entry DIRECTLY INSIDE `dirPath` -- `dirPath` itself always
 * survives, only its contents go. A locked/in-use file (EPERM/EBUSY, the
 * real "file is open in another program" case) is caught PER ENTRY,
 * skipped, and recorded rather than aborting the rest of the cleanup. */
async function clearDirContents(dirPath) {
  let entries;
  try {
    entries = await fs.promises.readdir(dirPath, { withFileTypes: true });
  } catch {
    return { freedBytes: 0, skipped: [] };
  }
  let freedBytes = 0;
  const skipped = [];
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    try {
      const size = entry.isDirectory() ? await dirSize(full) : (await fs.promises.stat(full)).size;
      await fs.promises.rm(full, { recursive: true, force: false });
      freedBytes += size;
    } catch (err) {
      skipped.push({ path: full, reason: err.code || err.message });
    }
  }
  return { freedBytes, skipped };
}

const THUMBCACHE_PATTERN = /^thumbcache_.*\.db$/i;

function thumbnailCacheDir() {
  return join(localAppDataRoot(), 'Microsoft', 'Windows', 'Explorer');
}

/** Full paths of every thumbcache_*.db file -- NOT the whole Explorer
 * folder, which holds plenty of files (jump lists, icon cache) that must
 * survive. */
async function thumbnailCacheFiles() {
  if (!localAppDataRoot()) return [];
  const dir = thumbnailCacheDir();
  let entries;
  try {
    entries = await fs.promises.readdir(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.filter(e => e.isFile() && THUMBCACHE_PATTERN.test(e.name)).map(e => join(dir, e.name));
}

async function thumbnailCacheSizeBytes() {
  const files = await thumbnailCacheFiles();
  const sizes = await Promise.all(files.map(async (f) => {
    try { return (await fs.promises.stat(f)).size; } catch { return 0; }
  }));
  return sizes.reduce((a, b) => a + b, 0);
}

/** Firefox profile folder names are randomized (e.g. "abc123.default-
 * release") -- there's no fixed path the way Chrome/Edge have, so this
 * lists whatever profiles actually exist and returns each one's cache2
 * folder, silently skipping a profile that doesn't have one. */
async function firefoxCachePaths() {
  if (!localAppDataRoot()) return [];
  const profilesDir = join(localAppDataRoot(), 'Mozilla', 'Firefox', 'Profiles');
  let entries;
  try {
    entries = await fs.promises.readdir(profilesDir, { withFileTypes: true });
  } catch {
    return [];
  }
  const paths = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const cachePath = join(profilesDir, entry.name, 'cache2');
    if (fs.existsSync(cachePath)) paths.push(cachePath);
  }
  return paths;
}

async function browserCachePaths() {
  if (!localAppDataRoot()) return [];
  const staticPaths = [
    join(localAppDataRoot(), 'Google', 'Chrome', 'User Data', 'Default', 'Cache'),
    join(localAppDataRoot(), 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache')
  ];
  return [...staticPaths, ...(await firefoxCachePaths())];
}

async function browserCacheSizeBytes() {
  const paths = await browserCachePaths();
  const sizes = await Promise.all(paths.map(dirSize));
  return sizes.reduce((a, b) => a + b, 0);
}

/** Real Recycle Bin total, via the same Shell.Application COM object
 * Explorer itself uses -- there's no plain filesystem path that reliably
 * maps to "everything currently in the Recycle Bin" across drives.
 * Returns 0 (never throws) if PowerShell itself is unavailable -- same
 * honest-zero-on-failure convention diskSpace.js's getSystemDriveSpace
 * established, so one PowerShell hiccup doesn't take the whole scan down. */
async function recycleBinSizeBytes() {
  const script = `
    $shell = New-Object -ComObject Shell.Application
    $bin = $shell.NameSpace(0xA)
    $total = 0
    foreach ($item in $bin.Items()) { $total += $item.Size }
    [PSCustomObject]@{ sizeBytes = $total } | ConvertTo-Json -Compress
  `;
  try {
    const raw = await runPowerShellJson(script);
    return typeof raw?.sizeBytes === 'number' ? raw.sizeBytes : 0;
  } catch {
    return 0;
  }
}

async function clearRecycleBin() {
  await runPowerShellJson('Clear-RecycleBin -Force -ErrorAction SilentlyContinue; [PSCustomObject]@{ ok = $true } | ConvertTo-Json -Compress');
}

/** Real, computed junk-category sizes -- each category's own computation
 * is wrapped independently (Promise.all + .catch), so one category
 * failing (a PowerShell hiccup, a permission error) never takes the
 * others down with it. */
export async function scanJunk() {
  const [tempSize, thumbSize, recycleSize, browserSize] = await Promise.all([
    Promise.all([dirSize(tempRoot()), dirSize(windowsTempRoot())]).then(([a, b]) => a + b).catch(() => 0),
    thumbnailCacheSizeBytes().catch(() => 0),
    recycleBinSizeBytes().catch(() => 0),
    browserCacheSizeBytes().catch(() => 0)
  ]);
  return {
    categories: [
      { id: 'tempFiles', label: 'Temp Files', sizeBytes: tempSize, paths: [tempRoot(), windowsTempRoot()] },
      { id: 'thumbnailCache', label: 'Thumbnail Cache', sizeBytes: thumbSize, paths: [thumbnailCacheDir()] },
      { id: 'recycleBin', label: 'Recycle Bin', sizeBytes: recycleSize, paths: [] },
      { id: 'browserCache', label: 'Browser Cache', sizeBytes: browserSize, paths: await browserCachePaths() }
    ]
  };
}

/** Deletes the requested junk categories. Unknown category ids are
 * silently ignored (not an error) -- same "caller-supplied id, don't
 * trust it blindly but don't blow up on it either" posture as other
 * routes in this codebase. Returns { freedBytes, skipped }. */
export async function executeCleanup(categoryIds) {
  let freedBytes = 0;
  const skipped = [];

  for (const id of categoryIds) {
    if (id === 'tempFiles') {
      const [a, b] = await Promise.all([clearDirContents(tempRoot()), clearDirContents(windowsTempRoot())]);
      freedBytes += a.freedBytes + b.freedBytes;
      skipped.push(...a.skipped, ...b.skipped);
    } else if (id === 'thumbnailCache') {
      for (const file of await thumbnailCacheFiles()) {
        try {
          const size = (await fs.promises.stat(file)).size;
          await fs.promises.rm(file, { force: false });
          freedBytes += size;
        } catch (err) {
          skipped.push({ path: file, reason: err.code || err.message });
        }
      }
    } else if (id === 'recycleBin') {
      try {
        const before = await recycleBinSizeBytes();
        await clearRecycleBin();
        freedBytes += before;
      } catch (err) {
        skipped.push({ path: 'Recycle Bin', reason: err.message });
      }
    } else if (id === 'browserCache') {
      for (const path of await browserCachePaths()) {
        const result = await clearDirContents(path);
        freedBytes += result.freedBytes;
        skipped.push(...result.skipped);
      }
    }
  }

  return { freedBytes, skipped };
}
