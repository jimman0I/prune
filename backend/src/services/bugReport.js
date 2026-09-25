import os from 'node:os';
import { execFile } from 'node:child_process';
import { appVersion } from './updateCheck.js';

/** "Report a bug": a prefilled GitHub issue, opened in the user's browser.
 *
 * Nothing is sent by Prune. This file builds an address and hands it to the
 * browser; the user reads the whole report on GitHub's own page and posts it
 * (or doesn't) themselves. What goes into it is the text they wrote plus
 * three facts about this machine -- Prune's version, Windows' version and
 * the architecture -- and nothing else: no paths, no scan results, no
 * username.
 *
 * As with the update check, the address is built here from checked pieces
 * and is never taken from a request.
 */

export const ISSUE_BASE = 'https://github.com/jimman0I/prune/issues/new?';
const ISSUE_URL = /^https:\/\/github\.com\/jimman0I\/prune\/issues\/new\?/;

const MAX_TITLE = 120;
const MAX_DESCRIPTION = 4000;
// Browsers and GitHub's own front end start refusing very long addresses a
// little past this; staying under it keeps the link working everywhere.
export const MAX_URL = 7000;

/** What the report will say about this machine. Read from Node's own `os`
 * module, so it is exactly what the user is shown before they send it. */
export function bugReportInfo() {
  return { version: appVersion(), windows: `${os.type()} ${os.release()}`, arch: os.arch() };
}

const urlFor = (title, description, info) => {
  const params = new URLSearchParams({
    title,
    body: `${description}\n\n---\nPrune ${info.version} · ${info.windows} · ${info.arch}`
  });
  return `${ISSUE_BASE}${params}`;
};

/** The address of a new issue with the report filled in.
 *
 * Throws a plain-language Error for input it cannot make a report from.
 * The description is shortened, with an ellipsis, rather than refused when
 * the encoded address would be too long: "&" alone costs three characters,
 * so the limit has to be measured on the finished URL. The footer is never
 * the part that is cut. */
export function buildIssueUrl(input) {
  if (!input || typeof input !== 'object') throw new Error('Describe what went wrong first.');
  const { title = '', description } = input;
  if (typeof title !== 'string') throw new Error('The title must be text.');
  if (typeof description !== 'string' || description.trim() === '') {
    throw new Error('Describe what went wrong first.');
  }

  const info = bugReportInfo();
  const cleanTitle = title.trim().slice(0, MAX_TITLE);
  let text = description.trim().slice(0, MAX_DESCRIPTION);

  let url = urlFor(cleanTitle, text, info);
  if (url.length > MAX_URL) {
    // Binary search for the longest prefix that fits with the ellipsis.
    let low = 0;
    let high = text.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      if (urlFor(cleanTitle, `${text.slice(0, mid)}…`, info).length <= MAX_URL) low = mid;
      else high = mid - 1;
    }
    text = `${text.slice(0, low)}…`;
    url = urlFor(cleanTitle, text, info);
  }
  return url;
}

/** Builds the report's address and opens it in the default browser.
 *
 * Re-checks the address before it reaches the opener, like
 * openReleasePage: this is the function that hands a URL to the system.
 * `opener` is a parameter so tests never launch a browser. Invalid input
 * throws, before anything is opened. */
export async function openBugReport(input, opener = execFile) {
  const url = buildIssueUrl(input);
  if (!ISSUE_URL.test(url)) return { ok: false, error: 'Not a Prune issue page.' };
  return new Promise((resolve) => {
    // rundll32's FileProtocolHandler, not explorer.exe. Handed this address
    // (it has a query string), explorer.exe opened the user's Documents
    // folder and never reached the browser; the release page has no query
    // string, which is the only reason openReleasePage gets away with it.
    // No shell is involved, so the address is a single argument and the
    // '&' between its parameters is not interpreted.
    opener('rundll32.exe', ['url.dll,FileProtocolHandler', url], (error) => {
      // The handler's exit code says nothing about whether the page opened.
      resolve({ ok: true, opened: url, spawnError: error?.code === 'ENOENT' ? 'rundll32.exe not found' : null });
    });
  });
}
