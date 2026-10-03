import { readFileSync, openSync, writeSync, closeSync } from 'node:fs';
import { runMftJob } from './mftJob.js';
import { classifyScanError, SCAN_TOO_LARGE, SCAN_TOO_LARGE_MESSAGE } from '../scanErrors.js';

/** The worker's whole job, with the raw volume handle injected (the worker
 * script passes a real `\\.\X:`; the benchmark and tests pass a synthetic one).
 *
 * Output is NEWLINE-DELIMITED JSON, written as each drive finishes. It used to
 * be ONE JSON document holding every drive: a drive with millions of files
 * made that a string past V8's limit and the worker died with "Invalid string
 * length". Now no string is larger than one drive's tree (itself bounded:
 * files are folded, see lib/foldFiles.js), the worker never holds two drives'
 * trees, and the reader never has to parse a tree to pass it on.
 *
 * A drive that was read is TWO lines: a small header
 *   {"driveLetter":"C","stats":{...},"hasTree":true}
 * and the tree itself, alone, on the next line. A drive that was not is one
 * line: {"driveLetter":"D","error":"...","code":"..."}. A failure of the job
 * is {"__error":"...","__code":"..."}: the unelevated parent cannot see this
 * process's stderr (it runs at a higher integrity level), so an error that is
 * not written to the file is an error nobody ever sees.
 *
 * Returns the exit code the script should end with. */
export function runWorker(argv, { openVolume }) {
  const [jobPath, outPath] = argv;
  let fd = null;
  const writeText = (text) => {
    // Opened on the first write, so a run that dies before it has anything to
    // say leaves NO file, which the elevated shim turns into a failure line
    // (a prompt that was declined also leaves none, and is told apart by the
    // shim never having run).
    fd ??= openSync(outPath, 'w');
    // A loop, not one call: writeSync may take less than it was given.
    const bytes = Buffer.from(`${text}\n`, 'utf8');
    for (let done = 0; done < bytes.length;) done += writeSync(fd, bytes, done);
  };
  const writeDrive = (drive) => {
    if (!drive.tree) {
      writeText(JSON.stringify(drive));
      return;
    }
    let treeText;
    try {
      treeText = JSON.stringify(drive.tree);
    } catch (err) {
      // The one drive that cannot be written says so, instead of taking the
      // other drives down with it.
      writeText(JSON.stringify({ driveLetter: drive.driveLetter, error: SCAN_TOO_LARGE_MESSAGE, code: classifyScanError(err) ?? SCAN_TOO_LARGE }));
      return;
    }
    writeText(JSON.stringify({ driveLetter: drive.driveLetter, stats: drive.stats, hasTree: true }));
    writeText(treeText);
  };

  try {
    const job = JSON.parse(readFileSync(jobPath, 'utf8'));
    runMftJob(job, { openVolume, onDrive: writeDrive });
    return 0;
  } catch (err) {
    try {
      const code = classifyScanError(err);
      writeText(JSON.stringify({ __error: code ? SCAN_TOO_LARGE_MESSAGE : err.message, ...(code ? { __code: code } : {}) }));
    } catch { /* nothing left to try */ }
    return 1;
  } finally {
    if (fd !== null) { try { closeSync(fd); } catch { /* best-effort */ } }
  }
}
