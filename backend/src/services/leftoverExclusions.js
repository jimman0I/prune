import { normalizePath, toExcludePattern } from '../lib/cleanGuards.js';
import { canonicalKeyPath } from './registryLeftovers.js';

/** What the user said never to touch, applied to a leftover scan.
 *
 * Revo keeps exclusion lists for its leftover scan, one for folders and one
 * for registry keys, so something the person has declared off limits is never
 * offered -- ticked by default -- after an uninstall whose name happens to
 * match it. Prune's Settings had the folder list (it also guards Deep Clean
 * and the Disk Map); the leftover scan honoured it only on the normal
 * uninstall path, and the forced-uninstall scan did not read it at all. This is
 * the one place both routes now apply it, and it adds the registry list.
 *
 * Both are prefix matches on a separator-wrapped path, so `D:\Keep` excludes
 * `D:\Keep\x` and never `D:\Keeper`, and `HKCU\Software\Vendor` excludes that
 * key, everything under it and every value inside it, and never
 * `HKCU\Software\VendorTwo`. The registry side is compared canonically
 * (case, hive spelling and `HKCU:` versus `HKEY_CURRENT_USER` do not matter),
 * the way the scan itself compares keys.
 *
 * The counts travel with the result so the review can say something was held
 * back: a leftover the user expected to see is not simply missing. */

/** A registry exclusion as the form it is compared in: canonical, with a
 * trailing separator. Anything that is not a key path (no hive, or a hive on
 * its own, which would exclude the whole registry) yields null. */
export function registryExclusionPattern(key) {
  if (typeof key !== 'string') return null;
  const canonical = canonicalKeyPath(key);
  if (!/^(HKLM|HKCU|HKCR|HKU|HKCC)\\[^\\]/.test(canonical)) return null;
  return `${canonical}\\`;
}

export function isRegistryPathExcluded(path, patterns) {
  if (!Array.isArray(patterns) || patterns.length === 0) return false;
  const canonical = canonicalKeyPath(path);
  if (!canonical) return false;
  const wrapped = `${canonical}\\`;
  return patterns.some((pattern) => wrapped.startsWith(pattern));
}

/** The scan with everything excluded taken out of its files and registry
 * groups. Other groups (tasks, services) are left as they are: there is no
 * exclusion list for them. A group that failed to scan has no items array and
 * passes through untouched. */
export function withoutExcluded(result, { excludeFolders, excludeRegistryKeys } = {}) {
  const folderPatterns = (Array.isArray(excludeFolders) ? excludeFolders : []).map(toExcludePattern).filter(Boolean);
  const keyPatterns = (Array.isArray(excludeRegistryKeys) ? excludeRegistryKeys : []).map(registryExclusionPattern).filter(Boolean);
  let out = result;

  const files = result?.files?.items;
  if (folderPatterns.length > 0 && Array.isArray(files)) {
    const kept = files.filter((item) => !folderPatterns.some((pattern) => normalizePath(item.path).startsWith(pattern)));
    out = { ...out, files: { ...out.files, items: kept, excluded: files.length - kept.length } };
  }

  const keys = result?.registryKeys?.items;
  if (keyPatterns.length > 0 && Array.isArray(keys)) {
    const kept = keys.filter((item) => !isRegistryPathExcluded(item.path, keyPatterns));
    out = { ...out, registryKeys: { ...out.registryKeys, items: kept, excluded: keys.length - kept.length } };
  }

  return out;
}
