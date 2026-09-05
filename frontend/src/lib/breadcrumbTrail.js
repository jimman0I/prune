/** A path, as clickable segments.
 *
 * The Disk Map could drill DOWN and not back up. `handleDrillDown` set a
 * new path and nothing anywhere set a shorter one, so four clicks into
 * AppData the only way out was to leave the screen and come back --
 * which, since the scan is cached per path, also meant re-deciding how to
 * scan the drive. A one-way tree view is a navigation dead end rather
 * than a missing nicety.
 *
 * Each crumb carries BOTH a label and the full path it leads to. They are
 * different strings -- you read "jimmanol" and go to
 * "C:\Users\jimmanol" -- and a crumb that only knows its own name cannot
 * navigate.
 */

/** A UNC share is one location, not a host plus a folder.
 *
 * `\\server\share\folder` split naively gives two empty segments, then
 * "server", then "share". Clicking either half goes somewhere that does
 * not exist: `\\server` alone is not a path you can list. The share is
 * the root here, exactly as `C:\` is on a local drive. */
const UNC = /^[\\/]{2}([^\\/]+)[\\/]([^\\/]+)(.*)$/;

export function breadcrumbTrail(path) {
  const text = String(path ?? '').trim();
  if (!text) return [];

  const unc = UNC.exec(text);
  if (unc) {
    const [, host, share, rest] = unc;
    const root = `\\\\${host}\\${share}`;
    return [{ label: root, path: root }, ...segmentsUnder(rest, root)];
  }

  // Everything before the first separator is the drive. Normalised to
  // "C:\" as its path -- "C:" alone means "the current directory on C:"
  // to Windows, which is not what a crumb pointing at the root means.
  const [drive, ...rest] = text.split(/[\\/]+/);
  if (!drive) return [];

  return [
    { label: drive, path: `${drive}\\` },
    ...segmentsUnder(rest.join('\\'), `${drive}\\`)
  ];
}

/** The parts below a root, each accumulating the ones before it. */
function segmentsUnder(remainder, root) {
  const parts = String(remainder ?? '').split(/[\\/]+/).filter(Boolean);
  const crumbs = [];
  // Trailing separators and doubled ones both produce empty parts, which
  // `filter(Boolean)` drops -- an empty crumb is unclickable and reads as
  // a rendering fault.
  let current = root.replace(/[\\/]+$/, '');
  for (const part of parts) {
    current = `${current}\\${part}`;
    crumbs.push({ label: part, path: current });
  }
  return crumbs;
}
