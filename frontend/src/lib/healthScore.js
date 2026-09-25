/** Highest score a drive that reports uncorrected or media errors can show.
 * Sits inside healthBand()'s lowest band (below 50) on purpose: a drive that
 * is losing data is a problem however much wear life it has left, and a
 * fresh SSD with bad blocks must not read as green. */
const ERRORS_SCORE_CAP = 40;

/** The drive's own life-remaining percent when one exists (the common
 * case for NVMe, readable without elevation -- see
 * backend/src/services/diskHealth.js's getNvmeSmart()). Otherwise a
 * tone-based fallback matching Dashboard.jsx's own driveVerdict()
 * classification. Null when there is no verdict yet, and also for `muted`
 * (a real "unknown"): the caller tells those apart by the status word it
 * shows in place of a number. */
function driveComponent(driveVerdict) {
  if (!driveVerdict) return null;
  if (driveVerdict.percent != null) return driveVerdict.percent;
  // `muted` is a real answer that genuinely doesn't know. It has no number:
  // inventing one (this used to be 75) would put a healthy-looking figure on
  // a drive nobody has measured. The ring shows the status word instead.
  const toneScore = { success: 100, warning: 50, danger: 0 };
  return toneScore[driveVerdict.tone] ?? null;
}

/** Binary, not scaled: a single uncorrected error or bad media block is
 * already a real, actionable signal (the same reasoning Dashboard.jsx's
 * own SmartAttributes component already applies by highlighting either
 * red on sight), not something to average away. Null when there's no
 * disk to report on at all. */
function errorsComponent(primaryDisk) {
  if (!primaryDisk) return null;
  const mediaErrors = primaryDisk.smart?.mediaErrors ?? 0;
  const readErrors = primaryDisk.readErrorsUncorrected ?? 0;
  const writeErrors = primaryDisk.writeErrorsUncorrected ?? 0;
  return (mediaErrors > 0 || readErrors > 0 || writeErrors > 0) ? 0 : 100;
}

/** The Dashboard's drive-health score: 0-100, about the drive and nothing
 * else. Prune is a storage tool; free space and broken apps have their own
 * cards, and folding them in made a healthy SSD on a full disk read as
 * unhealthy (see docs/superpowers/specs/2026-09-18-system-health-score-
 * design.md). The score is the drive's life-remaining percent (or its
 * status tone when the drive will not give a percent), capped at
 * ERRORS_SCORE_CAP when it reports uncorrected or media errors.
 *
 * `breakdown` holds the two inputs on their own 0-100 scale: `drive` and
 * `errors` (100 = clean, 0 = the drive reports errors).
 *
 * `score` is null until the drive has actually answered. Before that there
 * is nothing true to show, and a default here would put a healthy-looking
 * number on screen at exactly the moment nothing has been read -- the
 * invented figure HealthGauge and driveVerdict() already refuse to show. */
export function computeHealthScore({ driveVerdict, primaryDisk }) {
  const breakdown = {
    drive: driveComponent(driveVerdict),
    errors: errorsComponent(primaryDisk)
  };

  if (breakdown.drive == null) return { score: null, breakdown };

  const score = breakdown.errors === 0
    ? Math.min(breakdown.drive, ERRORS_SCORE_CAP)
    : breakdown.drive;
  return { score: Math.round(score), breakdown };
}

/** Which colour band a score falls in: 75 and up is good, 50 and up is
 * caution, anything below is a problem. Null in, null out -- there is no
 * band for a score that has not arrived, and the caller must not invent one
 * (the same rule that keeps the score itself null until real data lands).
 *
 * The bands are the score's OWN, deliberately not the drive verdict's: a
 * drive with errors is capped into the lowest band even when its wear life
 * looks fine, so the ring never paints green over a number that says
 * otherwise. */
export function healthBand(score) {
  if (typeof score !== 'number' || !Number.isFinite(score)) return null;
  if (score >= 75) return 'good';
  if (score >= 50) return 'caution';
  return 'problem';
}
