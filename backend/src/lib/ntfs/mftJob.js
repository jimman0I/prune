import { scanVolume } from './scanVolume.js';

/** Letters the job may name: one ASCII letter, optionally followed by a
 * colon and/or a backslash ("c", "C:", "D:\"). Anything else is dropped
 * rather than guessed at -- this value ends up in a raw device path. */
function normaliseLetter(value) {
  const match = /^([a-z]):?[\\/]?$/i.exec(String(value ?? '').trim());
  return match ? match[1].toUpperCase() : null;
}

/** The whole elevated job, minus the one thing only an Administrator can do.
 *
 * `openVolume(letter)` returns { readAt, close } for a raw volume handle and
 * is injected: the worker passes a real `\\.\X:` reader, and the tests pass
 * a synthetic NTFS image. Everything between -- picking the drives, scanning
 * each, keeping one failure from sinking the rest -- is therefore tested
 * without elevation.
 *
 * Several drives in ONE job is the reason this exists in this shape. Each
 * separate elevated process is a separate UAC prompt; reading C: and D: in
 * the same process is one.
 *
 * A drive that cannot be read (FAT32 stick, a locked volume, an I/O error)
 * becomes `{ driveLetter, error }` for that drive alone. The user just
 * approved an elevation prompt for these scans, and throwing the good ones
 * away because the last drive was exFAT would waste it. */
export function runMftJob(job, { openVolume }) {
  const letters = [...new Set((Array.isArray(job?.drives) ? job.drives : []).map(normaliseLetter).filter(Boolean))];
  if (letters.length === 0) throw new Error('No drive letter was given.');

  const maxDepth = Number(job?.maxDepth) || 12;

  const drives = letters.map((letter) => {
    let volume;
    try {
      volume = openVolume(letter);
    } catch (err) {
      return { driveLetter: letter, error: err.message };
    }
    try {
      return {
        driveLetter: letter,
        ...scanVolume({ readAt: volume.readAt, driveLabel: `${letter}:`, maxDepth })
      };
    } catch (err) {
      return { driveLetter: letter, error: err.message };
    } finally {
      try { volume.close?.(); } catch { /* nothing useful to do about a failed close */ }
    }
  });

  return { drives };
}
