import { listInstalledPrograms } from './programs.js';
import { iconSourceForProgram, iconSourceFromUninstaller } from './iconSource.js';
import { findMainExecutable } from './findMainExecutable.js';
import { extractIcons } from './iconExtract.js';
import { getFileTypeIcons } from './fileTypeIcons.js';
import { typeIconExtension } from './iconTypeFallback.js';
import { productCodeFrom, getMsiProductIcons } from './msiProductIcon.js';

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

  // Windows Installer's own record, looked up once for the whole list
  // rather than per program. Every MSI product code in the list goes in;
  // the ones with no ProductIcon simply come back absent.
  const productIcons = await getMsiProductIcons(
    list.map((program) => productCodeFrom(program.uninstallString)).filter(Boolean)
  );

  const keyForProgram = new Map();
  const pending = new Map();

  for (const program of list) {
    // Four sources, in descending order of how likely they are to be the
    // icon a person would recognise:
    //
    //   1. DisplayIcon -- what the vendor explicitly registered.
    //   2. The real binary in InstallLocation. This is what rescues the
    //      recognisable names: Discord and Epic Games Launcher both
    //      register no DisplayIcon, and their actual icon-bearing
    //      executables sit in there.
    //   3. The uninstaller, as a last resort.
    //   4. Windows Installer's ProductIcon.
    //
    // The order matters more than it looks. With the uninstaller ranked
    // second, Discord got no icon at all: Squirrel's Update.exe is an
    // absolute non-MSI path, so it satisfied the fallback and stopped the
    // search, and then turned out to carry no icon.
    //
    // ProductIcon is last for the same reason, from the other direction.
    // It is a perfectly good source -- it is what Windows Installer
    // recorded when the package went on -- but it is only ever consulted
    // for programs the first three declined, so ranking it above them
    // could only change icons that already work, and could only change
    // them for the worse.
    let source = iconSourceForProgram(program);

    if (!source && program.installLocation) {
      const executable = await findMainExecutable(program.installLocation, program.name);
      if (executable) source = { path: executable, index: 0 };
    }

    if (!source) source = iconSourceFromUninstaller(program);

    if (!source) {
      const code = productCodeFrom(program.uninstallString);
      if (code) source = productIcons[code] || null;
    }

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
  const needsType = new Map();
  for (const [programId, key] of keyForProgram) {
    const dataUri = cache.get(key);
    if (dataUri) {
      icons[programId] = dataUri;
      continue;
    }
    // Same last resort the startup list uses, and the same rule: only
    // where the type says something the file's own icon cannot. That
    // excludes .exe and .msi, which is most of what lands here -- an
    // executable's icon lives inside it, so failing to read it means
    // there is no icon, and the shell's generic answer for "an
    // application" or "an installer package" is one picture shared by
    // everything that failed.
    const extension = typeIconExtension(key.slice(0, key.lastIndexOf('|')));
    if (extension) needsType.set(programId, extension);
  }

  if (needsType.size > 0) {
    const typeIcons = await getFileTypeIcons([...new Set(needsType.values())]);
    for (const [programId, extension] of needsType) {
      if (typeIcons[extension]) icons[programId] = typeIcons[extension];
    }
  }

  return icons;
}

/** Testing seam -- the cache is process-wide and would otherwise leak
 * between test cases. */
export function clearIconCache() {
  cache.clear();
}
