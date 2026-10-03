/** The shares of a drive the low-disk warning can be set to, in percent. 0 is
 * Off. Its own small file so settings.js can validate the choice without
 * importing the code that reads disks. */
export const PERCENT_CHOICES = [0, 5, 10, 15];
export const DEFAULT_PERCENT = 10;

/** Exactly one of the offered shares, else the default. Never Off from a
 * fallback: switching a warning off is something a person does. */
export function normalizeLowDiskPercent(value) {
  return PERCENT_CHOICES.includes(value) ? value : DEFAULT_PERCENT;
}
