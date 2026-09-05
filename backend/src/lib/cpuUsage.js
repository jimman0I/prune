/** CPU load, from the only thing the platform actually offers.
 *
 * os.cpus() returns CUMULATIVE tick counts since boot, per core. There is
 * no "current CPU usage" to read, so a percentage is always the change
 * between two readings -- and the single most common way to get this
 * wrong is to divide one reading by itself, which reports the machine's
 * average load since it was switched on and calls it live. On a desktop
 * that has been up for a week it is a number that barely moves.
 */

/** Every core's ticks, added into one pair. */
export function cpuTotals(cpus) {
  let idle = 0;
  let total = 0;
  for (const cpu of cpus || []) {
    const times = cpu?.times ?? {};
    for (const value of Object.values(times)) total += Number(value) || 0;
    idle += Number(times.idle) || 0;
  }
  return { idle, total };
}

/** The share of elapsed ticks that were not idle, 0-100, or null.
 *
 * Null, never zero, whenever there is no answer: a first reading with
 * nothing to compare against, two readings inside the same tick, or
 * counters that went backwards. Zero would be a lie in every one of those
 * cases -- it draws an idle machine, which on this screen is exactly the
 * moment someone decides it is safe to start a scan.
 *
 * Counters CAN go backwards. A core parking or a suspend and resume both
 * do it, and the naive subtraction then yields a negative percentage,
 * which renders as an arc sweeping the wrong way. */
export function cpuPercentBetween(before, after) {
  if (!before || !after) return null;

  const idleDelta = after.idle - before.idle;
  const totalDelta = after.total - before.total;

  if (!Number.isFinite(totalDelta) || totalDelta <= 0) return null;
  if (idleDelta < 0) return null;

  const busy = totalDelta - idleDelta;
  const percent = Math.round((busy / totalDelta) * 100);
  return Math.min(100, Math.max(0, percent));
}
