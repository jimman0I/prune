/** Longer than any real version, short enough to exclude prose. The
 * longest genuine one on this machine is Riot Vanguard's 24-character
 * `1.19.0-6+20260826.181057`. */
const MAX_LENGTH = 32;

/** A version field holding nothing but hex is a commit hash. Teamfight
 * Tactics ships `6a95c09f1c731857808b405d` there. Twelve characters is
 * past any real dotless version (`138` or `2026` stay well under it)
 * while still catching the short SHAs some builds use. */
const HASH = /^[0-9a-f]{12,}$/i;

/** What the MSVC linker writes when the build never set a version. */
const PLACEHOLDER = new Set(['1.0.0.0', '0.0.0.0', '1.0.0', '0.0.0', '0']);

/** Cleans up an executable's reported version, or returns null when it
 * isn't reporting one.
 *
 * Only ever called for programs whose registry entry recorded no
 * DisplayVersion, so everything here is a fallback. That matters for what
 * gets rejected: a program genuinely at 1.0.0.0 nearly always declares it
 * in the registry, so a binary reaching this function AND reporting
 * exactly 1.0.0.0 is far more likely to be carrying the linker's default
 * than its own version.
 *
 * The bar is deliberately high. This column sits next to the size and the
 * install date, and a reader has no way to tell a real version from a
 * placeholder or a build hash. A blank says "not recorded", which is
 * true; `1.0.0.0` on a game that is nowhere near 1.0 is a claim, and a
 * false one. */
export function normalizeFileVersion(raw) {
  if (typeof raw !== 'string') return null;

  let value = raw.trim();
  if (!value) return null;

  // Windows renders VS_FIXEDFILEINFO as "0, 734, 0, 7340917" when the
  // string table has no version of its own. The numbers are correct and
  // only the punctuation is wrong, so this is a formatting fix rather
  // than a guess.
  if (/^\d+(\s*,\s*\d+)+$/.test(value)) {
    value = value.split(',').map((part) => part.trim()).join('.');
  }

  value = value.replace(/^v(?=\d)/i, '').replace(/^version\s+/i, '').trim();

  if (!value || value.length > MAX_LENGTH) return null;
  if (!/\d/.test(value)) return null;
  if (HASH.test(value)) return null;
  if (PLACEHOLDER.has(value)) return null;

  // A version starts with a number. Anything else is a caption that
  // happens to contain a digit.
  if (!/^\d/.test(value)) return null;

  return value;
}
