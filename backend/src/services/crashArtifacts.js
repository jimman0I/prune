import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { measureDirectory } from './leftoverWalk.js';

/** Files Windows writes about a program's executable and keeps after the
 * program is gone: its Prefetch trace, its Windows Error Reporting folders
 * and its crash dumps. Each is named for the executable, which is the only
 * thing that ties it to the program, so they are matched by that name in the
 * Advanced scan.
 *
 * Two of the three live under C:\Windows or ...\Microsoft\Windows, which the
 * leftover guard refuses wholesale (osComponentRefusal). crashArtifactExe is
 * that guard's single, exact exception: the precise file or folder SHAPE of
 * each artifact, directly inside its one folder -- never the folder itself,
 * nor anything else next to it. Windows regenerates a Prefetch trace when a
 * program runs and never reads a report or dump for a program again. */

const norm = (path) => String(path).replace(/[/\\]+/g, '\\').replace(/\\+$/, '').toLowerCase();

/** Each kind: its folders (from the environment), what an entry there must
 * look like, and how to read the executable out of the name. */
function kinds(env) {
  const systemRoot = env?.SystemRoot || env?.windir;
  const werDirs = [env?.ProgramData, env?.LOCALAPPDATA]
    .filter(Boolean)
    .flatMap((base) => ['ReportArchive', 'ReportQueue'].map((leaf) => join(base, 'Microsoft', 'Windows', 'WER', leaf)));
  return [
    // NOTEPAD++.EXE-1A2B3C4D.pf: the name, then an 8-hex-digit path hash.
    { dirs: systemRoot ? [join(systemRoot, 'Prefetch')] : [], shape: /^(.+)-[0-9a-f]{8}\.pf$/i, directory: false },
    // AppCrash_notepad++.exe_<long hex hash>_<more>: one folder per report.
    { dirs: werDirs, shape: /^App(?:Crash|Hang)_(.+?)_[0-9a-f]{16,}_/i, directory: true },
    // notepad++.exe.12345.dmp: the name, then the crashed process's id.
    { dirs: env?.LOCALAPPDATA ? [join(env.LOCALAPPDATA, 'CrashDumps')] : [], shape: /^(.+)\.\d+\.dmp$/i, directory: false }
  ];
}

const exeBase = (name) => name.replace(/\.exe$/i, '').toLowerCase();

/** The executable a path is an artifact OF, lower-cased without ".exe", or
 * null when the path is not exactly one of the shapes above. */
export function crashArtifactExe(path, env = process.env) {
  if (typeof path !== 'string') return null;
  const full = norm(path);
  const cut = full.lastIndexOf('\\');
  if (cut < 0) return null;
  const parent = full.slice(0, cut);
  const leaf = path.replace(/[/\\]+$/, '').split(/[/\\]/).pop();
  for (const kind of kinds(env)) {
    if (!kind.dirs.some((dir) => norm(dir) === parent)) continue;
    const match = kind.shape.exec(leaf);
    if (match) return exeBase(match[1]);
  }
  return null;
}

/** Every artifact whose executable `matches(exeName)` accepts. A folder that
 * cannot be read -- Prefetch, without elevation -- is simply empty here: not
 * finding a Prefetch trace is no reason to fail the rest of the scan. */
export async function scanCrashArtifacts({ matches, env = process.env }) {
  const items = [];
  for (const kind of kinds(env)) {
    for (const dir of kind.dirs) {
      let entries;
      try {
        entries = await readdir(dir, { withFileTypes: true });
      } catch {
        continue;
      }
      for (const entry of entries) {
        if (entry.isDirectory() !== kind.directory) continue;
        const match = kind.shape.exec(entry.name);
        if (!match || !matches(exeBase(match[1]))) continue;
        const path = join(dir, entry.name);
        items.push({ path, sizeBytes: await measureDirectory(path, kind.directory ? {} : { maxEntries: 1 }) });
      }
    }
  }
  return { ok: true, items };
}
