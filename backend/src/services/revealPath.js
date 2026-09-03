import { execFile } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';

/** Opens File Explorer on a path.
 *
 * Revo puts "Open install folder" behind its More Commands button, and it
 * is the most-used thing there for a reason: the list tells you a program
 * is 55 GB and the obvious next question is where.
 *
 * Goes through the backend because the renderer cannot reach Electron's
 * shell -- the window runs with contextIsolation on, nodeIntegration off
 * and no preload, which is the right way round and not worth weakening
 * for one button.
 *
 */
/** Works out what to open and how, without opening anything.
 *
 * Separated from the spawn so it can be tested. Testing revealPath itself
 * end-to-end means a real Explorer window opening on whoever runs the
 * suite, which is not a side effect a test should have. */
export function resolveReveal(target) {
  if (typeof target !== 'string' || !target.trim()) {
    return { ok: false, error: 'No path given.' };
  }

  const path = target.trim().replace(/^"|"$/g, '');

  // Only somewhere that exists. Explorer given a missing path opens the
  // Documents folder instead, which looks like the button did something
  // random rather than that the folder is gone.
  if (!existsSync(path)) {
    return { ok: false, error: 'That folder is no longer on disk.' };
  }

  let isDirectory;
  try {
    isDirectory = statSync(path).isDirectory();
  } catch {
    return { ok: false, error: 'That path could not be read.' };
  }

  // A directory opens; a file opens its folder with the file selected,
  // which is what "show me this" means for a file.
  return {
    ok: true,
    path,
    selected: !isDirectory,
    args: isDirectory ? [path] : ['/select,', path]
  };
}

/** Opens it.
 *
 * execFile, never exec: the argument vector is passed to CreateProcess
 * directly, so nothing in the path is ever interpreted as shell syntax.
 * A path here is attacker-influenced data in the sense that matters --
 * it comes from the registry, which any installer can write. */
export function revealPath(target) {
  const plan = resolveReveal(target);
  if (!plan.ok) return Promise.resolve(plan);
  const { path, args, selected } = plan;

  return new Promise((resolve) => {
    execFile('explorer.exe', args, (error) => {
      // explorer.exe exits non-zero even when it worked -- it hands the
      // request to the already-running shell process and returns 1. So a
      // non-zero exit is not evidence of failure here, and treating it as
      // one would report an error over a window that just opened.
      resolve({
        ok: true,
        opened: path,
        selected,
        spawnError: error?.code === 'ENOENT' ? 'explorer.exe not found' : null
      });
    });
  });
}
