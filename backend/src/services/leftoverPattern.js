/** Builds the regex every leftover scan searches with.
 *
 * One definition of "belongs to this program", shared by the file, registry
 * and scheduled-task scans, so a leftover cannot be found by one of them
 * and missed by another for no better reason than which file it lives in.
 *
 * The rule is a name match, and its whole risk is being too generous: every
 * item a scan returns arrives in the review already ticked, so a false
 * positive is something the user deletes by pressing the obvious button.
 * Found live (2026-09-04) once the registry scan started reading
 * HKCU:\Software\Classes -- uninstalling Steam offered `msteams` and
 * `msteamscanary`, which belong to Microsoft Teams and simply happen to end
 * with the letters "steam".
 *
 * Hence the leading boundary: a term has to start a word, not merely appear
 * inside one. That keeps everything genuinely Steam's -- `steam`,
 * `steamlink`, `Steamsteamglobal` all begin with it -- and drops the
 * Teams keys. There is deliberately no boundary on the trailing end,
 * because a program's own keys extend its name far more often than not.
 *
 * A lookbehind, rather than \b: \b would match at the "s" in "msteams"
 * only if the preceding character were a non-word one, which is the same
 * test, but \b before a term that itself begins with a non-word character
 * (a leading "." or "(") silently means the opposite. Spelling out "not
 * preceded by a letter or digit" says what is meant whatever the term is. */
const WORD_START = '(?<![A-Za-z0-9])';

/** A term this short has to end a word too, not just start one.
 *
 * Also found live (2026-09-04), and the sharper half of the same problem:
 * TriClaude's publisher is the three letters "jim", and the registry scan
 * reads a startup entry's command line as well as its name. Every command
 * line on this machine lives under C:\Users\jimmanol, so a leading
 * boundary alone still matched all of them -- uninstalling TriClaude
 * offered Discord's and Roblox's startup entries, ticked.
 *
 * Closing the end is not free: it is exactly what would stop "Steam"
 * matching "steamlink", which is Steam's. So it applies only where a term
 * is too short to be evidence of anything on its own. Three characters is
 * the line: it covers the initialisms that make up nearly every short
 * publisher -- AMD, IBM, HP -- which still match their own keys exactly
 * and stop matching the middle of unrelated words. */
const SHORT_TERM_LENGTH = 3;
const WORD_END = '(?![A-Za-z0-9])';

function escapeForRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The pattern for one program, or null when there is nothing to search on.
 *
 * Null rather than an empty string, because an empty pattern matches every
 * key and every directory on the machine -- it would offer the whole
 * computer as removable leftovers. Callers must check it. */
export function buildSearchPattern(...terms) {
  const usable = terms.filter((term) => typeof term === 'string' && term.trim() !== '');
  if (usable.length === 0) return null;
  return usable
    .map((term) => term.trim())
    .map((term) => {
      const body = `${WORD_START}${escapeForRegex(term)}`;
      return term.length <= SHORT_TERM_LENGTH ? `${body}${WORD_END}` : body;
    })
    .join('|');
}
