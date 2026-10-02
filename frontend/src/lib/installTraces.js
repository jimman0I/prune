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
