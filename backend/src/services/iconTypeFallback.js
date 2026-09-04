/** File types whose icon lives inside the file, so the shell's answer for
 * the TYPE is worth nothing.
 *
 * This is not a tidiness rule, it is a measured bug. The shell's icon for
 * ".exe" is a single generic glyph, and on the startup screen it was
 * handed to both Discord's Update.exe and RtkAudUService64.exe -- neither
 * of which carries an icon -- so two unrelated programs rendered as
 * byte-identical pictures, each row claiming to be the other.
 *
 * The same objection was already reached independently in iconSource.js,
 * which refuses msiexec.exe as a source because "it hands every
 * MSI-installed program the same generic Windows Installer glyph, which
 * reads as a bug rather than a fallback". That is also why ".msi" is on
 * this list: its type icon IS that glyph.
 *
 * A lettered tile carries the entry's own initial. A shared glyph carries
 * nothing, and looks like a working icon while carrying it.
 *
 * Scripts are the opposite case and the reason the fallback exists at
 * all: a .cmd has no icon of its own, "what a batch file looks like" IS
 * the answer, and a script running at sign-in is exactly the entry worth
 * recognising on sight. */
const OWN_ICON_TYPES = new Set([
  '.exe', '.dll', '.com', '.scr', '.cpl', '.ocx', '.ico', '.mun',
  '.msi', '.msp'
]);

/** The extension a file-type icon can usefully be asked for, or null.
 *
 * Null rather than a guess when there is no extension: `hosts` has no
 * type and no icon, and handing the row a generic page glyph would be
 * claiming to know something. The lettered tile at least carries the
 * entry's initial. */
export function typeIconExtension(path) {
  const match = /(\.[A-Za-z0-9_-]{1,12})$/.exec(String(path || ''));
  if (!match) return null;
  const extension = match[1].toLowerCase();
  return OWN_ICON_TYPES.has(extension) ? null : extension;
}
