/** Fills in install dates for programs whose registry entry never declared
 * one.
 *
 * 67 of the 129 entries on this machine record no InstallDate -- more than
 * half the list -- so the Installed column read as mostly dashes. Revo
 * fills every row, and it does it from the uninstall key's own last-write
 * time; the backend reads the same thing.
 *
 * A declared InstallDate is never overwritten. The key's write time is
 * when the entry last CHANGED, which an update does too, so it is strictly
 * the weaker source: good enough to fill a blank, not good enough to
 * replace what the installer itself recorded.
 *
 * `installDateApproximate` marks the filled ones, so the UI can say which
 * dates are inferred rather than declared. */
export function mergeInstallDates(programs, installDates) {
  if (!installDates || Object.keys(installDates).length === 0) return programs;

  return programs.map((program) => {
    if (program.installDate) return program;
    const found = installDates[program.id];
    if (typeof found !== 'string' || !found) return program;
    return { ...program, installDate: found, installDateApproximate: true };
  });
}
