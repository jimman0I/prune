/** The letter on the tile a program falls back to when it has no icon.
 *
 * Measured on this machine: of the forty-six lettered tiles in the
 * Applications list, twenty-six were "M". That is not a coincidence and
 * not fixable by finding more icons -- a program with no icon of its own
 * is overwhelmingly a system component, and system components are named
 * after their vendor. Twenty-six identical coral squares carry no more
 * information than twenty-six blank ones.
 *
 * The vendor word is also the least useful part of the name to keep,
 * because the Company column two across already says it. Dropping it puts
 * the first word that actually distinguishes the program on the tile:
 * Visual C++, Windows Desktop Runtime, ASP.NET Core and GameInput become
 * V, W, A and G instead of four more Ms.
 *
 * Only when the publisher confirms it. "Windows Software Development Kit"
 * keeps its W -- the publisher is Microsoft, so "Windows" here is part of
 * the product name rather than a vendor prefix, and guessing otherwise
 * would strip a real word.
 */

/** What the program list substitutes when the registry has no publisher.
 * Matching its first word against a program named "Unknown ..." would
 * strip a word on the strength of a placeholder. */
const PLACEHOLDER_PUBLISHER = 'unknown publisher';

/** Letters and digits only: publishers carry commas and full stops
 * ("Epic Games, Inc.", "GitHub, Inc.") that are not part of the name. */
function firstWord(text) {
  const match = /[A-Za-z0-9]+/.exec(String(text || ''));
  return match ? match[0].toLowerCase() : '';
}

function firstCharacter(text) {
  const match = /[A-Za-z0-9]/.exec(String(text || ''));
  return match ? match[0].toUpperCase() : null;
}

export function tileLetter(name, publisher) {
  const text = String(name || '').trim();
  const fallback = firstCharacter(text) ?? '?';

  const publisherWord = firstWord(publisher);
  if (!publisherWord || String(publisher).trim().toLowerCase() === PLACEHOLDER_PUBLISHER) {
    return fallback;
  }

  const nameWord = firstWord(text);
  if (!nameWord || nameWord !== publisherWord) return fallback;

  // Everything after that first word. If nothing is left, the program is
  // named exactly after its publisher -- Discord, Viber, Dropbox -- and
  // the vendor word IS the name.
  const rest = text.slice(text.toLowerCase().indexOf(nameWord) + nameWord.length);
  return firstCharacter(rest) ?? fallback;
}
