import { listInstalledPrograms } from './programs.js';
import { iconSourceForProgram, iconSourceFromUninstaller } from './iconSource.js';
import { findMainExecutable } from './findMainExecutable.js';
import { extractIcons } from './iconExtract.js';

/** Extraction is pure function of the file it reads, and those files don't
 * change while the app is open -- so this survives for the process's life
 * and makes every load after the first instant. Keyed by "path|index"
 * rather than by program id: several entries legitimately point at the
 * same executable, and they should share one extraction. */
const cache = new Map();

/** Icons for every installed program, as { programId: dataUri }.
 *
 * Deliberately its own endpoint rather than part of the program list.
 * Extraction spawns PowerShell and reads ~90 executables; making the
 * list wait on that would trade a fast list for a prettier one. The UI
 * renders rows immediately and fills icons in when they arrive.
 *
 * A program with no icon is simply missing from the map, which the UI
 * renders as its existing lettered tile. */
export async function getProgramIcons(programs) {
  const list = programs ?? await listInstalledPrograms();

  const keyForProgram = new Map();
  const pending = new Map();

  for (const program of list) {
    // Three sources, in descending order of how likely they are to be the
    // icon a person would recognise:
    //
    //   1. DisplayIcon -- what the vendor explicitly registered.
    //   2. The real binary in InstallLocation. This is what rescues the
    //      recognisable names: Discord and Epic Games Launcher both
    //      register no DisplayIcon, and their actual icon-bearing
    //      executables sit in there.
    //   3. The uninstaller, as a last resort.
    //
    // The order matters more than it looks. With the uninstaller ranked
    // second, Discord got no icon at all: Squirrel's Update.exe is an
    // absolute non-MSI path, so it satisfied the fallback and stopped the
    // search, and then turned out to carry no icon.
    let source = iconSourceForProgram(program);

    if (!source && program.installLocation) {
      const executable = await findMainExecutable(program.installLocation, program.name);
      if (executable) source = { path: executable, index: 0 };
    }

    if (!source) source = iconSourceFromUninstaller(program);

    if (!source) continue;
    const key = `${source.path}|${source.index}`;
    keyForProgram.set(program.id, key);
    if (!cache.has(key) && !pending.has(key)) {
      pending.set(key, { key, path: source.path, index: source.index });
    }
  }

  if (pending.size > 0) {
    const extracted = await extractIcons([...pending.values()]);
    for (const { key } of pending.values()) {
      // Cached either way: a file with no extractable icon shouldn't be
      // re-opened on every refresh just to fail again.
      cache.set(key, extracted[key] ? `data:image/png;base64,${extracted[key]}` : null);
    }
  }

  const icons = {};
  for (const [programId, key] of keyForProgram) {
    const dataUri = cache.get(key);
    if (dataUri) icons[programId] = dataUri;
  }
  return icons;
}

/** Testing seam -- the cache is process-wide and would otherwise leak
 * between test cases. */
export function clearIconCache() {
  cache.clear();
}
