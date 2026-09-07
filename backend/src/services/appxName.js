/** The readable half of a Store package identity.
 *
 * The registry names these by package family -- "Microsoft.GamingApp",
 * "40459File-New-Project.EarTrumpet" -- and ten rows of that is a list
 * nobody reads. The publisher prefix is also the least useful part of it,
 * the same argument iconTileLetter.js makes for dropping a vendor word
 * from a program name.
 *
 * Deliberately NOT the manifest's DisplayName. That is the prettiest
 * answer and it lives behind an ms-resource: indirection that has to be
 * resolved per package and per language, which is a lot of work to
 * sometimes still come back as a placeholder. This makes the identity
 * Windows itself uses readable and invents nothing.
 */
export function appxDisplayName(packageName) {
  const text = String(packageName || '');
  const lastDot = text.lastIndexOf('.');
  if (lastDot === -1) return text;

  const tail = text.slice(lastDot + 1);
  // A trailing dot would leave nothing behind; an ugly name beats no name.
  return tail || text;
}
