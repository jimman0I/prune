import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

/** The opt-in update check.
 *
 * Prune's one outbound request, so the tests are mostly about what it is
 * NOT allowed to do: send anything beyond what GitHub needs to answer,
 * trust a URL it was handed, or turn a failure into an exception that
 * reaches a screen. Nothing here touches the network -- fetch is
 * injected.
 */

const execFile = vi.fn((cmd, args, cb) => cb?.(null));
vi.mock('node:child_process', () => ({ execFile: (...a) => execFile(...a) }));

const {
  compareVersions, parseRelease, createUpdateChecker, appVersion, openReleasePage, RELEASES_API
} = await import('./updateCheck.js');

const release = (over = {}) => ({
  tag_name: 'v2.3.5',
  html_url: 'https://github.com/jimman0I/prune/releases/tag/v2.3.5',
  draft: false,
  prerelease: false,
  ...over
});
const reply = (body, { ok = true, status = 200 } = {}) => ({ ok, status, json: async () => body });

beforeEach(() => { vi.clearAllMocks(); });

describe('compareVersions', () => {
  it('orders versions by number, not by text', () => {
    expect(compareVersions('2.3.5', '2.3.4')).toBe(1);
    expect(compareVersions('2.3.4', '2.3.5')).toBe(-1);
    expect(compareVersions('2.3.4', '2.3.4')).toBe(0);
    // "2.10.0" sorts before "2.9.9" as a string, and is the newer one.
    expect(compareVersions('2.10.0', '2.9.9')).toBe(1);
  });

  it('accepts a leading v, as release tags have', () => {
    expect(compareVersions('v2.3.4', '2.3.4')).toBe(0);
  });

  it('refuses anything that is not a plain x.y.z', () => {
    expect(compareVersions('2.3', '2.3.4')).toBeNull();
    expect(compareVersions('2.3.5-beta', '2.3.4')).toBeNull();
    expect(compareVersions(undefined, '2.3.4')).toBeNull();
  });
});

describe('parseRelease', () => {
  it('reads the version from the tag', () => {
    expect(parseRelease(release())).toEqual({
      version: '2.3.5',
      url: 'https://github.com/jimman0I/prune/releases/tag/v2.3.5'
    });
  });

  it('builds the link itself and never uses the one in the reply', () => {
    /* The page opened from here is opened in the user's browser, so it is
     * derived from a version number that has been checked character by
     * character -- not copied out of a network reply, which is the one
     * input in this app that did not come from this machine. */
    const parsed = parseRelease(release({ html_url: 'https://evil.example.com/prune-2.3.5.exe' }));
    expect(parsed.url).toBe('https://github.com/jimman0I/prune/releases/tag/v2.3.5');
  });

  it('refuses a tag that is not a plain release version', () => {
    expect(parseRelease(release({ tag_name: 'v2.3.5-beta' }))).toBeNull();
    expect(parseRelease(release({ tag_name: 'latest' }))).toBeNull();
    expect(parseRelease(release({ tag_name: 'v2.3.5/../../x' }))).toBeNull();
  });

  it('refuses drafts and pre-releases', () => {
    expect(parseRelease(release({ draft: true }))).toBeNull();
    expect(parseRelease(release({ prerelease: true }))).toBeNull();
  });

  it('refuses a reply that is not a release at all', () => {
    expect(parseRelease(null)).toBeNull();
    expect(parseRelease({ message: 'Not Found' })).toBeNull();
  });
});

describe('the checker', () => {
  const make = (fetchImpl, now = () => 0) =>
    createUpdateChecker({ currentVersion: '2.3.4', fetchImpl, now });

  it('asks GitHub for the latest release, and sends nothing else', async () => {
    const fetchImpl = vi.fn(async () => reply(release()));
    await make(fetchImpl).check();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, options] = fetchImpl.mock.calls[0];
    expect(url).toBe(RELEASES_API);
    expect(RELEASES_API).toBe('https://api.github.com/repos/jimman0I/prune/releases/latest');
    // GitHub requires a User-Agent. That and Accept are all it gets: no
    // body, no query string, no machine or user detail.
    expect(Object.keys(options.headers).sort()).toEqual(['Accept', 'User-Agent']);
    expect(options.headers['User-Agent']).toBe('Prune/2.3.4');
    expect(options.method ?? 'GET').toBe('GET');
    expect(options.body).toBeUndefined();
  });

  it('gives up on a slow reply instead of hanging', async () => {
    const fetchImpl = vi.fn(async () => reply(release()));
    await make(fetchImpl).check();
    expect(fetchImpl.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
  });

  it('reports a newer release', async () => {
    const result = await make(async () => reply(release())).check();
    expect(result).toEqual({
      current: '2.3.4',
      latest: '2.3.5',
      newer: true,
      url: 'https://github.com/jimman0I/prune/releases/tag/v2.3.5'
    });
  });

  it('reports no update when the latest release is this one, or older', async () => {
    const same = await make(async () => reply(release({ tag_name: 'v2.3.4' }))).check();
    expect(same.newer).toBe(false);
    const older = await make(async () => reply(release({ tag_name: 'v2.3.3' }))).check();
    expect(older.newer).toBe(false);
  });

  it('turns a network failure into an answer, not an exception', async () => {
    const result = await make(async () => { throw new Error('getaddrinfo ENOTFOUND api.github.com'); }).check();
    expect(result.current).toBe('2.3.4');
    expect(result.error).toMatch(/ENOTFOUND/);
    expect(result.newer).toBeUndefined();
  });

  it('says so when GitHub refuses', async () => {
    const result = await make(async () => reply({ message: 'rate limited' }, { ok: false, status: 403 })).check();
    expect(result.error).toMatch(/403/);
  });

  it('says so when the reply is not a release it can read', async () => {
    const result = await make(async () => reply(release({ tag_name: 'nightly' }))).check();
    expect(result.error).toBeTruthy();
    expect(result.newer).toBeUndefined();
  });

  it('asks at most once a day', async () => {
    let clock = 0;
    const fetchImpl = vi.fn(async () => reply(release()));
    const checker = make(fetchImpl, () => clock);

    await checker.check();
    clock = 23 * 60 * 60 * 1000;
    await checker.check();
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    clock = 25 * 60 * 60 * 1000;
    await checker.check();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('does not hold on to a failure for a day', async () => {
    // Offline for a minute should not mean no answer until tomorrow.
    const fetchImpl = vi.fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(reply(release()));
    const checker = make(fetchImpl);

    expect((await checker.check()).error).toBeTruthy();
    expect((await checker.check()).newer).toBe(true);
  });

  it('remembers the last good answer, and nothing before a check', async () => {
    const checker = make(async () => reply(release()));
    expect(checker.lastResult()).toBeNull();
    await checker.check();
    expect(checker.lastResult().latest).toBe('2.3.5');
  });
});

describe('appVersion', () => {
  it('is the version in the backend package.json, which every release bumps', () => {
    const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'));
    expect(appVersion()).toBe(pkg.version);
  });
});

describe('openReleasePage', () => {
  it('opens a Prune release page in the default browser', async () => {
    const url = 'https://github.com/jimman0I/prune/releases/tag/v2.3.5';
    const result = await openReleasePage(url);
    expect(execFile).toHaveBeenCalledWith('explorer.exe', [url], expect.any(Function));
    expect(result.ok).toBe(true);
  });

  it('refuses any other address, even one that looks close', async () => {
    for (const url of [
      'https://evil.example.com/',
      'https://github.com/jimman0I/prune.evil/releases/tag/v2.3.5',
      'https://github.com/jimman0I/prune/releases/tag/v2.3.5?x=1',
      'file:///C:/Windows/System32/calc.exe'
    ]) {
      const result = await openReleasePage(url);
      expect(result.ok).toBe(false);
    }
    expect(execFile).not.toHaveBeenCalled();
  });
});
