/** Fills in sizes for programs whose registry entry never recorded one.
 *
 * 40 of the 130 entries on this machine have no EstimatedSize at all --
 * it's an optional value and plenty of installers skip it -- so those
 * rows showed a blank exactly where the interesting number goes. The
 * backend measures their install folders and this merges the result in.
 *
 * A registry-reported size is never overwritten. That number is what the
 * installer itself declared, a folder walk can legitimately disagree with
 * it, and quietly replacing figures the user has already read is a change
 * nobody asked for. Only blanks get filled.
 *
 * `sizeMeasured` marks the ones that came from a folder walk, so the UI
 * can distinguish them if it ever needs to. */
export function mergeMeasuredSizes(programs, sizes) {
  if (!sizes || Object.keys(sizes).length === 0) return programs;

  return programs.map((program) => {
    if (typeof program.sizeBytes === 'number') return program;
    const measured = sizes[program.id];
    if (typeof measured !== 'number') return program;
    return { ...program, sizeBytes: measured, sizeMeasured: true };
  });
}
