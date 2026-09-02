/** One separator style, lowercase, no trailing slash. The registry and
 * the launchers disagree constantly: Epic writes forward slashes, GOG
 * writes either, Windows writes backslashes, and several record a
 * trailing one. */
function normalizePath(value) {
  return String(value || '').replace(/\//g, '\\').replace(/\\+$/, '').toLowerCase();
}

/** Strips everything that display names differ on. "The Witcher 3: Wild
 * Hunt" in the registry against "The Witcher 3 Wild Hunt" from GOG is the
 * normal case rather than an edge one. */
function normalizeName(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

/** Finds the launcher's record for an installed program, or null.
 *
 * Location first, because two records naming the same folder are the same
 * installation whatever they call it. Name only as a fallback, and only
 * on an exact normalized match.
 *
 * That exactness matters more than the coverage it costs. A wrong match
 * puts one game's size on another game's row, and a confidently wrong
 * number is worse than the blank it replaced -- so "Fortnite" must not
 * match "Fortnite Festival Companion", and a prefix must never be
 * treated as a hit. */
export function matchLauncherApp(program, apps) {
  if (!program || !apps || apps.length === 0) return null;

  const location = normalizePath(program.installLocation);
  if (location) {
    const byLocation = apps.find((app) => normalizePath(app.installLocation) === location);
    if (byLocation) return byLocation;
  }

  const name = normalizeName(program.name);
  if (!name) return null;

  return apps.find((app) => {
    const appName = normalizeName(app.displayName || app.name);
    return appName && appName === name;
  }) || null;
}
