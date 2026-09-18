/** How much of the composite score each signal is worth. Drive wear
 * matters most (real data-loss risk); free space and broken apps are
 * real but recoverable annoyances; hardware errors are rare but serious
 * when present. See docs/superpowers/specs/2026-09-18-system-health-
 * score-design.md for the full reasoning behind these weights. */
const WEIGHTS = { drive: 40, storage: 25, apps: 20, errors: 15 };

function clamp01(x) {
  return Math.max(0, Math.min(1, x));
}

/** The drive's own life-remaining percent when one exists (the common
 * case for NVMe, readable without elevation -- see
 * backend/src/services/diskHealth.js's getNvmeSmart()). Otherwise a
 * tone-based fallback matching Dashboard.jsx's own driveVerdict()
 * classification. `muted` -- a REAL answer that genuinely doesn't know,
 * not a loading state -- scores neutral rather than failing: an unknown
 * is not a known problem. Null only when there is no verdict at all
 * (nothing has loaded yet); see this file's caller for how that's kept
 * distinct from a real "unknown" answer. */
function driveComponent(driveVerdict) {
  if (!driveVerdict) return null;
  if (driveVerdict.percent != null) return driveVerdict.percent;
  const toneScore = { success: 100, warning: 50, danger: 0, muted: 75 };
  return toneScore[driveVerdict.tone] ?? null;
}

/** Full credit at 20% free or above, scaling linearly down to 0 at 2%
 * free or below -- roughly Windows' own low-disk-space warning range. */
function storageComponent(diskSpace) {
  if (!diskSpace || typeof diskSpace.freeBytes !== 'number' || typeof diskSpace.totalBytes !== 'number' || diskSpace.totalBytes <= 0) {
    return null;
  }
  const freePercent = (diskSpace.freeBytes / diskSpace.totalBytes) * 100;
  return clamp01((freePercent - 2) / 18) * 100;
}

/** brokenCount is always a real number (Dashboard.jsx computes it
 * synchronously from the programs prop, defaulting to 0), never a
 * loading state -- so this never returns null. -25 per broken app,
 * floored at 0. */
function appsComponent(brokenCount) {
  const count = typeof brokenCount === 'number' ? brokenCount : 0;
  return Math.max(0, 100 - 25 * count);
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

/** The Dashboard's composite "how healthy is this PC" score: 0-100,
 * combining drive health, free disk space, broken/orphaned apps and
 * hardware errors. Each `breakdown` entry is that component's own 0-100
 * normalized value (not its weighted points), so the UI can show
 * "Drive 92 · Storage 78 · Apps 100 · Errors 100" as comparable
 * percentages; the weights only apply when combining them into `score`.
 *
 * `score` is null until BOTH `breakdown.drive` and `breakdown.storage`
 * are known -- those are the only two components with genuine async
 * loading uncertainty (apps and errors either come from data that's
 * already loaded by the time this runs, or are excluded the same way).
 * Without this gate, the very first render (before any real disk data
 * has arrived) would show a fabricated "100% healthy" from the apps
 * component's own always-available default -- exactly the invented
 * number this app's HealthGauge and driveVerdict() already refuse to
 * show elsewhere. */
export function computeHealthScore({ driveVerdict, primaryDisk, diskSpace, brokenCount }) {
  const breakdown = {
    drive: driveComponent(driveVerdict),
    storage: storageComponent(diskSpace),
    apps: appsComponent(brokenCount),
    errors: errorsComponent(primaryDisk)
  };

  if (breakdown.drive == null || breakdown.storage == null) {
    return { score: null, breakdown };
  }

  let weightedSum = 0;
  let totalWeight = 0;
  for (const key of Object.keys(WEIGHTS)) {
    const value = breakdown[key];
    if (value == null) continue;
    weightedSum += value * WEIGHTS[key];
    totalWeight += WEIGHTS[key];
  }

  const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  return { score, breakdown };
}
