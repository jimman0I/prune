/** Turns a registry DisplayName into something worth searching the
 * filesystem for.
 *
 * Real bug this fixes, found dogfooding (2026-09-02): a forced uninstall
 * searched for the DisplayName verbatim. That name is "TriClaude 0.1.0",
 * and nothing on disk is called that -- so a dead program with 1.1 GB of
 * leftovers across five folders scanned completely clean. Installers name
 * their folders after the product, never after the product plus its
 * version.
 *
 * Strips only TRAILING noise, and only repeatedly from the end: a version
 * ("0.1.0", "22.01"), a bracketed qualifier ("(x64)", "(64-bit)"), or a
 * literal "version 1.2" phrase. A number inside the name is left alone --
 * "Microsoft 365 Apps" and "7-Zip" are called that, and trimming the digits
 * would search for a different product.
 *
 * The result is a STARTING POINT the user can edit, not a final answer.
 * Name matching is a heuristic, and the one thing it must never do is
 * return an empty pattern -- that matches every directory under Program
 * Files -- so a name that is entirely version-like falls back to itself. */
export function deriveSearchTerm(displayName) {
  if (typeof displayName !== 'string') return '';
  const original = displayName.trim();
  if (!original) return '';

  let term = original;
  let previous;
  do {
    previous = term;
    term = term
      .replace(/\s*\([^)]*\)\s*$/, '')           // (x64), (64-bit), (user)
      .replace(/\s+(?:version\s+)?v?\d+(?:\.\d+)+[a-z]?\s*$/i, '')  // 1.2, v3.4.5, version 1.2
      .trim();
  } while (term !== previous);

  return term || original;
}
