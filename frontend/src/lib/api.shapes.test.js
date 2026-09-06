import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  fetchPrograms, fetchStoreApps, fetchBrowserExtensions, fetchStartupItems,
  fetchUninstallHistory, fetchDeepCleanRules,
  fetchProgramIcons, fetchProgramSizes, fetchProgramVersions,
  fetchProgramInstallDates, fetchRunningPrograms, fetchFileTypeIcons
} from './api.js';

/** What every reader gets when the response is not the shape it expected.
 *
 * Fourteen of these functions ended with a bare `return data.something`.
 * A response missing that key handed back undefined, and the consumer
 * found out by crashing: `history.map is not a function` took the whole
 * Dashboard down, discovered while writing an unrelated test whose stub
 * happened to return an object instead of an array.
 *
 * That is not a hypothetical. It is what a version skew looks like -- an
 * older backend against a newer UI, a route renamed, a field that moved
 * -- and the honest answer to it is an empty list, not a white screen.
 * An empty list renders as "nothing here", which is wrong but survivable
 * and visible. A crash takes out screens that had nothing to do with it.
 */

global.fetch = vi.fn();
beforeEach(() => { vi.resetAllMocks(); });

const respondWith = (body) => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => body });
};

const listReaders = [
  ['fetchPrograms', fetchPrograms],
  ['fetchStoreApps', fetchStoreApps],
  ['fetchBrowserExtensions', fetchBrowserExtensions],
  ['fetchStartupItems', fetchStartupItems],
  ['fetchUninstallHistory', fetchUninstallHistory],
  ['fetchDeepCleanRules', fetchDeepCleanRules]
];

const mapReaders = [
  ['fetchProgramIcons', fetchProgramIcons],
  ['fetchProgramSizes', fetchProgramSizes],
  ['fetchProgramVersions', fetchProgramVersions],
  ['fetchProgramInstallDates', fetchProgramInstallDates],
  ['fetchRunningPrograms', fetchRunningPrograms],
  ['fetchFileTypeIcons', fetchFileTypeIcons]
];

describe('a response missing its payload key', () => {
  it.each(listReaders)('%s returns an empty array, not undefined', async (_name, read) => {
    respondWith({});
    const result = await read(['.exe']);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });

  it.each(mapReaders)('%s returns an empty object, not undefined', async (_name, read) => {
    respondWith({});
    const result = await read(['.exe']);
    expect(result).toEqual({});
    // Object.keys is what several consumers call on these first.
    expect(() => Object.keys(result)).not.toThrow();
  });
});

describe('the crash this prevents', () => {
  it('lets a caller map over a history that never arrived', async () => {
    // The exact failure: Dashboard renders history.length and
    // history.map, and an undefined return took the screen out entirely.
    respondWith({});
    const history = await fetchUninstallHistory();
    expect(() => history.map((e) => e)).not.toThrow();
    expect(history.length).toBe(0);
  });

  it('still returns real data when the key is there', async () => {
    // The guard must not swallow a correct response.
    respondWith({ entries: [{ programName: 'Thing' }] });
    expect(await fetchUninstallHistory()).toEqual([{ programName: 'Thing' }]);
  });

  it('still throws on a real error response', async () => {
    // A missing key is not the same event as a failed request, and the
    // fallback must not turn a 500 into a silent empty list.
    fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'EACCES' }) });
    await expect(fetchPrograms()).rejects.toThrow('EACCES');
  });
});
