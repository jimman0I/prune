import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/** A command-based rule (e.g. `ipconfig /flushdns`) has nothing to look
 * for on disk, so it's always applicable. */
export function scan() {
  return { sizeBytes: null, fileCount: null, accessible: true };
}

export async function execute(action) {
  try {
    await execFileAsync(action.command.split(' ')[0], action.command.split(' ').slice(1));
    return { ranCommand: true, freedBytes: 0, skipped: [] };
  } catch (err) {
    return { ranCommand: true, freedBytes: 0, skipped: [], error: err.message };
  }
}
