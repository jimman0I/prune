import { readdir, stat } from 'node:fs/promises';
import { join, basename } from 'node:path';

/** How far down an install directory to look, and how many directories to
 * open in total.
 *
 * Both bounds are load-bearing. `C:\Program Files\Epic Games\` is an
 * InstallLocation and it also contains every game installed through the
 * launcher -- an unbounded walk looking for a 4 KB icon would traverse
 * tens of gigabytes of game assets. Depth 4 is enough to reach the real
 * binary in the layouts that actually occur (Epic's is
 * Launcher\Portal\Binaries\Win64\EpicGamesLauncher.exe); the visit budget
 * catches everything else. */
const MAX_DEPTH = 4;
const MAX_DIRECTORIES = 120;

/** Executables that are in nearly every install directory and never carry
 * the application's own icon. Picking one hands the row a generic
 * installer glyph, which reads as more wrong than the letter it
 * replaced. Only ever applied to the size-based fallback -- an exact name
 * match always wins, so a program genuinely called "Update" still finds
 * its own binary. */
const NOT_THE_APP = /^(unins|uninstall|setup|install|update|upgrade|crashpad|crashreporter|vcredist|dxsetup|dotnet|vc_redist|helper|node|python|7z)/i;

/** Normalizes a name for comparison: "Epic Games Launcher" and
 * "EpicGamesLauncher.exe" are the same thing, and so are "CPUID CPU-Z
 * 2.20" and "CPU-Z.exe". */
function normalize(value) {
  return value.toLowerCase().replace(/\.exe$/, '').replace(/[^a-z0-9]/g, '');
}

/** Finds the executable an install directory is actually built around, so
 * its icon can be used for the program.
 *
 * The registry is the first choice for an icon, but 36 of the 129 entries
 * on this machine set no DisplayIcon, and for many of those the
 * uninstaller is useless as a source too -- msiexec (which would give
 * every MSI program the same Windows Installer glyph) or a Squirrel
 * Update.exe that carries no icon at all. Discord and Epic Games Launcher
 * are both in that position while their real, icon-bearing binaries sit
 * right there in InstallLocation.
 *
 * Name match first, largest-executable second. The name match is what
 * finds Discord.exe inside a versioned `app-1.0.9255` folder and
 * EpicGamesLauncher.exe four levels down; the size fallback covers
 * everything whose binary simply isn't named after the product. */
export async function findMainExecutable(installLocation, programName) {
  if (typeof installLocation !== 'string' || !installLocation.trim()) return null;

  const target = normalize(programName || '');
  const queue = [{ dir: installLocation.replace(/[\\/]+$/, ''), depth: 0 }];
  let visited = 0;
  let best = null; // largest plausible executable seen so far

  while (queue.length > 0 && visited < MAX_DIRECTORIES) {
    const { dir, depth } = queue.shift();
    visited++;

    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue; // unreadable or gone -- not an error, just no candidates here
    }

    for (const entry of entries) {
      const full = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (depth < MAX_DEPTH) queue.push({ dir: full, depth: depth + 1 });
        continue;
      }
      if (!entry.isFile() || !/\.exe$/i.test(entry.name)) continue;

      // An exact name match is the answer; nothing later will beat it.
      if (target && normalize(entry.name) === target) return full;

      if (NOT_THE_APP.test(basename(entry.name))) continue;
      try {
        const { size } = await stat(full);
        if (!best || size > best.size) best = { path: full, size };
      } catch { /* vanished between readdir and stat */ }
    }
  }

  return best ? best.path : null;
}
