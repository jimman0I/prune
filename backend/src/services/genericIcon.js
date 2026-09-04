/** Throwing out an icon that turns out to identify nothing.
 *
 * Measured on this machine: nineteen programs -- every Visual C++
 * redistributable, every .NET runtime and SDK, the Windows SDK, the ADK
 * and PowerShell 7 -- rendered as one byte-identical picture, so each row
 * claimed to be the other eighteen. All nineteen have a perfectly real
 * DisplayIcon; it just points into C:\ProgramData\Package Cache, at the
 * WiX bootstrapper that installed them, and a bootstrapper with no icon
 * of its own falls back to WiX's default setup glyph.
 *
 * This is the same objection iconSource.js already raises against
 * msiexec.exe -- "it hands every MSI-installed program the same generic
 * Windows Installer glyph, which reads as a bug rather than a fallback" --
 * and the same one that keeps .exe and .msi off the file-type fallback.
 * An icon's whole job is to say which program this is.
 *
 * Refusing the Package Cache outright was the obvious fix and the wrong
 * one. Twenty-two programs here take their icon from there and they
 * produce THREE pictures: the WiX default nineteen times, the real Python
 * icon twice, and Viber's once. Those bootstrappers embedded the product's
 * own icon, none of the twenty-two has any other source, and a blanket
 * refusal would have traded nineteen bad icons for three good ones lost.
 *
 * So two signals, and both must fire:
 *
 *   1. The picture came from an installer rather than from a product.
 *   2. It is demonstrably not any one product's icon -- the programs
 *      sharing it are not versions or architectures of the same thing.
 *
 * A picture that fails either test is kept. That direction matters: this
 * removes icons, so an uncertain case must end with the icon still there.
 * Vendor branding shared across genuinely different products is the case
 * that has to survive, and it does -- NVIDIA's logo sits on three
 * unrelated NVIDIA products here, taken from NVIDIA's own install folder,
 * so the first test never lets it near the second.
 */

/** Whether this file is an installer bundle rather than an application.
 *
 * C:\ProgramData\Package Cache is where WiX/Burn keeps the bootstrapper
 * .exe it was installed from, one GUID-named folder per bundle. Matched
 * as a whole path segment so a directory merely NAMED something similar
 * cannot qualify. */
export function isBootstrapperPath(path) {
  return /[\\/]Package Cache[\\/]/i.test(String(path || ''));
}

/** Tokens that say which build this is rather than which program it is. */
const VERSION_TOKEN = /^v?\d+(\.\d+)*$/;
const ARCHITECTURE_TOKEN = /^(x64|x86|amd64|arm64|win32|32-bit|64-bit)$/;

/** The product a name belongs to, with version and architecture removed.
 *
 * Used only to answer one question -- do the programs sharing a picture
 * belong to one product or several -- so it does not need to be a perfect
 * name, only stable across the versions and architectures of a single
 * product and different between two products. "Python 3.14.5 (64-bit)"
 * and "Python 3.12.3 (64-bit)" must agree; "Microsoft Visual C++
 * Redistributable" and "Microsoft Windows Desktop Runtime" must not.
 *
 * Version-ness is digits and dots ONLY. ".NET" and "ASP.NET" are dotted
 * and are products, and treating them as versions would collapse the .NET
 * SDK, ASP.NET Core and the Desktop Runtime into one family -- which
 * would then look like a single product legitimately sharing one icon,
 * and quietly defeat the whole check. */
export function productFamily(name) {
  const text = String(name || '').trim();
  if (!text) return '';

  // Everything after " - " is a version or an edition suffix on every
  // real name seen here: "... Redistributable (x64) - 12.0.40664",
  // "... Desktop Runtime - 6.0.36 (x64)".
  const withoutSuffix = text.split(/\s+-\s+/)[0];

  const tokens = withoutSuffix
    // Parenthesised architecture and edition notes.
    .replace(/\([^)]*\)/g, ' ')
    .toLowerCase()
    .split(/\s+/)
    // "7.6.5.0-x64" arrives as one token: split a version welded to an
    // architecture before either can be tested.
    .flatMap((token) => token.split(/-(?=(?:x64|x86|amd64|arm64|win32)$)/))
    .filter(Boolean)
    .filter((token) => !VERSION_TOKEN.test(token) && !ARCHITECTURE_TOKEN.test(token));

  const family = tokens.join(' ').trim();
  // A name that is nothing BUT a version would collapse to '', and every
  // such program would land together in one enormous false family that
  // then looks like several products sharing an icon.
  return family || text.toLowerCase();
}

/** The ids whose icon should be thrown away, as a Set.
 *
 * `entries` are { id, name, path, picture }, where `picture` is anything
 * that compares equal for two identical images -- the data URI itself is
 * what the caller has and works fine. */
export function genericIconIds(entries) {
  const groups = new Map();
  for (const entry of entries || []) {
    if (!entry?.picture) continue;
    if (!groups.has(entry.picture)) groups.set(entry.picture, []);
    groups.get(entry.picture).push(entry);
  }

  const rejected = new Set();
  for (const members of groups.values()) {
    if (members.length < 2) continue;

    // One member holding this picture from its own install directory
    // makes it that product's real icon; the bootstrappers just carry a
    // copy of it.
    if (!members.every((member) => isBootstrapperPath(member.path))) continue;

    const families = new Set(members.map((member) => productFamily(member.name)));
    if (families.size < 2) continue;

    for (const member of members) rejected.add(member.id);
  }

  return rejected;
}
