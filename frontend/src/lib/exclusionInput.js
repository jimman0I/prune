/** Turning what someone typed into an exclusion into what it means.
 *
 * The settings screen offers ONE field, because "add an exclusion" is one
 * idea to a user -- but the two kinds are stored separately. A folder is
 * matched as a path prefix and an extension as a filename suffix, and a
 * single list that had to guess which at match time would guess wrong on
 * exactly the interesting cases: "C:\node.js" is a folder, "*.iso" is not.
 * Deciding once, at the point where the user's intent is clearest, is
 * cheaper than deciding on every file of every scan.
 *
 * Ambiguity is refused rather than guessed. A bare "Downloads" could be a
 * folder name or a mistyped extension; excluding every path containing
 * that word and excluding nothing are both wrong, and neither is
 * something the user would be told about.
 */

/** Anything with a separator or a drive letter is a location. */
const LOOKS_LIKE_PATH = /[\\/]|^[a-z]:/i;

/** An extension is letters, digits and the odd dash -- and no separator.
 * "*.is/o" is written as an extension and is not one; it is refused
 * rather than quietly stored as a folder with a strange name. */
const EXTENSION_BODY = /^[a-z0-9][a-z0-9_-]{0,15}$/i;

/** The start of a registry key: a hive, in its short or long spelling, with an
 * optional colon (PowerShell's HKCU:\), followed by a separator or nothing. */
const REGISTRY_HIVE = /^(?:HKLM|HKCU|HKCR|HKU|HKCC|HKEY_(?:LOCAL_MACHINE|CURRENT_USER|CLASSES_ROOT|USERS|CURRENT_CONFIG)):?(?:[\\/]|$)/i;

export function classifyExclusion(input) {
  if (typeof input !== 'string') return null;
  const text = input.trim();
  if (!text) return null;

  // Extension intent is checked FIRST and by its marker, not by shape.
  // Order matters: "*.is/o" contains a separator, so a path check placed
  // above this would file it as a folder called "*.is/o" -- storing
  // nonsense that silently matches nothing.
  if (/^\*?\./.test(text)) {
    const body = text.replace(/^\*/, '').replace(/^\./, '');
    return EXTENSION_BODY.test(body) ? { kind: 'extension', value: `.${body.toLowerCase()}` } : null;
  }

  // A registry key, written the way regedit shows it: a hive, then at least one
  // key name. Checked before the folder test because its separators would
  // otherwise make it look like a (very strange) folder. A bare hive is refused
  // rather than stored: excluding "HKCU" would exclude everything under it.
  if (REGISTRY_HIVE.test(text)) {
    const key = text.replace(/[\\/]+/g, '\\').replace(/^([^\\:]+):/, '$1').replace(/\\+$/, '');
    return key.includes('\\') ? { kind: 'registry', value: key } : null;
  }

  if (LOOKS_LIKE_PATH.test(text)) return { kind: 'folder', value: text };

  // A bare word is refused, and that is a deliberate narrowing of what
  // this first accepted.
  //
  // "iso" obviously means an extension and "Downloads" obviously means a
  // folder, and there is no rule separating them that does not also get
  // "temp", "bin" and "src" wrong -- each of which is both a common
  // extension and a common folder name. Guessing has two failure modes
  // and the user is told about neither: guess folder and it excludes
  // nothing, guess extension and it excludes every .temp file on the
  // machine. Refusing is the only answer that can be explained, and the
  // field says to write "*.iso" instead.
  return null;
}
