/** Remembers which screens have been opened at least once.
 *
 * Every screen used to be torn down the moment another tab was clicked --
 * `{screen === 'diskmap' && <DiskMap />}` unmounts the component, taking
 * its state with it -- so coming back re-ran the work from nothing. On
 * the Disk Map that means scanning the drive again, which is seconds of
 * waiting and, on the MFT path, a fresh UAC prompt for a result we
 * already had. Deep Clean lost its scan results the same way, and the
 * quarantine list reloaded itself for no reason.
 *
 * Returning the SAME set when the screen is already known is not a
 * micro-optimisation: this feeds component state, and handing back a new
 * Set every time would set state on every render and spin. The identical
 * shape of bug already cost this project an infinite render loop once. */
export function rememberVisited(visited, screen) {
  if (!screen) return visited;
  if (visited.has(screen)) return visited;

  const next = new Set(visited);
  next.add(screen);
  return next;
}
