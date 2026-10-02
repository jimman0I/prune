import { normalizePath, toExcludePattern } from './cleanGuards.js';
import { matchesExtension } from './exclusionInput.js';

/** The user's Settings -> exclusions, as a function the Disk Map's two
 * scanners can both ask: "is this path to be left out?".
 *
 * One definition, used by the folder walk and the MFT reader alike, because
 * the setting is only honest if both obey it the same way. It used to be
 * honoured by the walk alone, so a folder excluded in Settings was still
 * counted -- and, worse, still offered for removal -- as soon as the fast
 * scan was used.
 *
 * Only the USER's exclusions, not cleanGuards' built-in defaults. Those stop
 * a cleaner taking files out of places like WinSxS; they are not a statement
 * that the disk map should pretend WinSxS is empty. A disk map that hid the
 * component store would be lying about where the space went.
 *
 * Returns null when nothing is excluded, so the caller can skip the work
 * entirely: on a volume with millions of files, building a path string per
 * entry just to compare it against an empty list is not free. */
export function createExclusionMatcher(exclusions) {
  const folders = (exclusions?.excludeFolders ?? []).map(toExcludePattern).filter(Boolean);
  const extensions = exclusions?.excludeExtensions ?? [];
  if (folders.length === 0 && extensions.length === 0) return null;

  return function isExcluded(entryPath) {
    if (matchesExtension(entryPath, extensions)) return true;
    if (folders.length === 0) return false;
    const haystack = normalizePath(entryPath);
    if (haystack === '') return false;
    return folders.some((pattern) => haystack.includes(pattern));
  };
}

/** One-shot form, for callers that ask once per entry with the raw lists. */
export function isExcludedEntry(entryPath, exclusions) {
  const matcher = createExclusionMatcher(exclusions);
  return matcher ? matcher(entryPath) : false;
}
