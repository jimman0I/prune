import { readFileSync } from 'node:fs';
import { execFile } from 'node:child_process';

/** The opt-in update check: Prune's only outbound request.
 *
 * Everything else in the app talks to its own backend on loopback and
 * nothing more, and the README says so. This is the one exception, and it
 * is built to be the smallest exception that still answers the question:
 *
 *   - It runs only when the user has turned it on (settings.updateCheck,
 *     off by default). The route checks that before calling anything here.
 *   - It asks one fixed address, once a day at most, sending GitHub what
 *     its API requires -- a User-Agent -- and nothing else.
 *   - It downloads nothing and installs nothing. The answer is a version
 *     number and a link the user may choose to open.
 *   - That link is built here from a version number that has been checked
 *     character by character. It is never copied out of the reply, which
 *     is the one input in this app that did not come from this machine.
 */

export const RELEASES_API = 'https://api.github.com/repos/jimman0I/prune/releases/latest';

const releasePage = (version) => `https://github.com/jimman0I/prune/releases/tag/v${version}`;

// Plain x.y.z, optionally with the "v" release tags carry. Anchored at
// both ends, so nothing can ride along after a valid-looking prefix.
const VERSION = /^v?(\d+)\.(\d+)\.(\d+)$/;
const RELEASE_PAGE = /^https:\/\/github\.com\/jimman0I\/prune\/releases\/tag\/v\d+\.\d+\.\d+$/;

const DAY_MS = 24 * 60 * 60 * 1000;
const TIMEOUT_MS = 10_000;

/** -1, 0 or 1, comparing numerically -- "2.10.0" is newer than "2.9.9",
 * which a string comparison gets backwards. Null when either side is not a
 * plain version, so a malformed tag can never read as "newer". */
export function compareVersions(a, b) {
  const pa = VERSION.exec(typeof a === 'string' ? a : '');
  const pb = VERSION.exec(typeof b === 'string' ? b : '');
  if (!pa || !pb) return null;
  for (let i = 1; i <= 3; i++) {
    const diff = Number(pa[i]) - Number(pb[i]);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/** The release in GitHub's reply, or null for anything that is not a
 * published, plain-numbered release. */
export function parseRelease(body) {
  if (!body || typeof body !== 'object' || body.draft || body.prerelease) return null;
  const match = VERSION.exec(typeof body.tag_name === 'string' ? body.tag_name : '');
  if (!match) return null;
  const version = `${match[1]}.${match[2]}.${match[3]}`;
  return { version, url: releasePage(version) };
}

let cachedVersion = null;

/** The running version, from the backend's own package.json -- bumped with
 * every release, and shipped beside the backend in the installed app. */
export function appVersion() {
  if (!cachedVersion) {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    cachedVersion = pkg.version;
  }
  return cachedVersion;
}

/** A checker with its own once-a-day memory.
 *
 * Only a good answer is remembered. Remembering a failure for a day would
 * turn a minute offline into a day with no answer. */
export function createUpdateChecker({ currentVersion, fetchImpl = globalThis.fetch, now = Date.now, ttlMs = DAY_MS }) {
  let cached = null;

  async function check() {
    if (cached && now() - cached.at < ttlMs) return cached.result;

    let res;
    try {
      res = await fetchImpl(RELEASES_API, {
        headers: { Accept: 'application/vnd.github+json', 'User-Agent': `Prune/${currentVersion}` },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (err) {
      return { current: currentVersion, error: `Couldn't reach GitHub: ${err.message}` };
    }
    if (!res.ok) return { current: currentVersion, error: `GitHub answered ${res.status}.` };

    let body = null;
    try { body = await res.json(); } catch { /* handled below as unreadable */ }
    const release = parseRelease(body);
    if (!release) return { current: currentVersion, error: "GitHub's answer was not a release Prune could read." };

    const result = {
      current: currentVersion,
      latest: release.version,
      newer: compareVersions(release.version, currentVersion) === 1,
      url: release.url
    };
    cached = { at: now(), result };
    return result;
  }

  return { check, lastResult: () => cached?.result ?? null };
}

export const updateChecker = createUpdateChecker({ currentVersion: appVersion() });

/** Opens a Prune release page in the user's default browser.
 *
 * Re-checks the address even though the only caller passes one this file
 * built: this is the function that hands a URL to the shell, so it is the
 * one place a wrong one must not get past. explorer.exe is what resolves
 * an https URL to the default browser, the same way revealPath.js opens a
 * ms-settings: page. */
export function openReleasePage(url) {
  if (typeof url !== 'string' || !RELEASE_PAGE.test(url)) {
    return Promise.resolve({ ok: false, error: 'Not a Prune release page.' });
  }
  return new Promise((resolve) => {
    execFile('explorer.exe', [url], (error) => {
      // explorer.exe exits non-zero even when it worked -- see revealPath.js.
      resolve({ ok: true, opened: url, spawnError: error?.code === 'ENOENT' ? 'explorer.exe not found' : null });
    });
  });
}
