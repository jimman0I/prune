/** Matching an installed program to the install monitor's record of it.
 *
 * By the program's own Add/Remove registry key first -- the monitor recorded
 * the key the installer created, which is exact -- and by display name only
 * when the program has no key to compare. A name alone can collide (two
 * versions side by side), so it is never used when a key exists. */
const canonical = (key) => String(key || '')
  .toLowerCase()
  .replace(/^hkey_local_machine/, 'hklm').replace(/^hkey_current_user/, 'hkcu')
  .replace(/^(hklm|hkcu):/, '$1')
  .replace(/[\\/]+/g, '\\')
  .replace(/\\+$/, '');

export function traceForProgram(program, traces) {
  if (!program || !Array.isArray(traces) || traces.length === 0) return null;
  if (program.registryKey) {
    const key = canonical(program.registryKey);
    return traces.find((trace) => trace.registryKey && canonical(trace.registryKey) === key) ?? null;
  }
  const name = String(program.name || '').trim().toLowerCase();
  return name ? traces.find((trace) => trace.programName && trace.programName.trim().toLowerCase() === name) ?? null : null;
}

/** Whether a recorded install's program is on this PC: some installed program
 * links to it by the same rule as above. Null when it cannot be said -- the
 * trace names no program (a portable install), or the program list has not
 * arrived. An imported trace from another PC is the usual "not installed
 * here"; it is kept, because installing the program later is when it counts. */
export function traceInstalledHere(trace, programs) {
  if (!trace?.programName || !Array.isArray(programs) || programs.length === 0) return null;
  return programs.some((program) => traceForProgram(program, [trace]) === trace);
}

/** The file name an export is saved under: the program's name for one trace,
 * the date for all of them. Only letters, digits, spaces, dots, dashes and
 * underscores survive, so a program name can never make a path. */
export const TRACE_FILE_EXTENSION = '.prunetraces';
export function traceFileName(programName, date = new Date()) {
  const day = date.toISOString().slice(0, 10);
  if (programName === undefined) return `prune-install-traces-${day}${TRACE_FILE_EXTENSION}`;
  const safe = String(programName ?? '').normalize('NFC')
    .replace(/[^\p{L}\p{N} ._-]+/gu, ' ').replace(/\s+/g, ' ').replace(/^[\s.]+|[\s.]+$/g, '').slice(0, 80).trim();
  return `prune-install-trace-${safe || day}${TRACE_FILE_EXTENSION}`;
}