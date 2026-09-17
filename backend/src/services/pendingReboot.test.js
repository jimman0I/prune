import { describe, it, expect, afterEach, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { schedulePendingDelete, readPendingOperations, PENDING_KEY, PENDING_VALUE } from './pendingReboot.js';

// Same vi.mock partial-passthrough technique quarantine.test.js already
// establishes for 'node:fs/promises' -- applied here to 'node:child_process'
// instead, so a single test below can force ONE specific `reg export` call
// to fail with something other than "not found", while every other call in
// this file (this file's own real cleanup, pendingReboot.js's own real
// reg.exe calls) passes straight through to the real execFile unchanged.
//
// Deliberately NOT trying to preserve execFile's `[util.promisify.custom]`
// symbol on the mock (vi.fn(impl) doesn't carry it over, so `promisify`
// would fall back to its generic behavior and only resolve with `stdout`,
// not Node's special-cased `{ stdout, stderr }`). Tried it two ways --
// referencing the top-level `promisify` import inside the factory throws
// "Cannot access '...' before initialization" (vi.mock's factory is
// hoisted above every other import, so a module-level import binding
// really is in its temporal dead zone there, confirmed live); a dynamic
// `await import('node:util')` inside the factory avoids that error but
// then the mock silently never applies at all -- calls fall through to
// the real, unmocked execFile with zero explanation. Neither is worth the
// fragility: nothing in this file destructures a successful call's
// `{ stdout, stderr }` shape, so there's nothing to lose by not preserving
// it, and the plain, no-symbol version below is the one actually confirmed
// to intercept pendingReboot.js's own internal execFile calls.
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, execFile: vi.fn(actual.execFile) };
});

const execFileAsync = promisify(execFile);

/* Real reg.exe against the real key -- same "no mock, prove the real
 * mechanism" convention quarantine.test.js already establishes for the
 * registry. HKLM\SYSTEM\...\Session Manager is a real, always-present
 * Windows key (it holds this value or doesn't; the key itself is never
 * absent on any real Windows install), so there's nothing to create in
 * beforeEach -- only something to clean up in afterEach, and only if
 * this test run actually added to it. */
const MARKER = `\\??\\C:\\prune-pendingreboot-test-marker-${process.pid}.tmp`;

/** Rewrites PENDING_VALUE to exactly `strings`, via the same `hex(7)` /
 * `.reg`-file round trip pendingReboot.js itself uses internally --
 * duplicated here rather than imported, deliberately: this is the test's
 * OWN verification path, kept independent of the module under test, so a
 * regression in the module's write path can't also corrupt the cleanup
 * that's supposed to prove the real registry survived the test intact.
 *
 * `reg add ... /t REG_MULTI_SZ /d "..."` cannot be used for this (see
 * pendingReboot.js's own writeMultiSzValue comment) -- it silently drops
 * any empty-string element, which is exactly what a delete pair's second
 * half is. Confirmed live before this file existed: `reg add` on a value
 * ending in an empty element exits 0 while quietly writing one fewer
 * element than asked for.
 *
 * On this dev machine, PENDING_VALUE genuinely holds 4 real pending
 * deletes already (Windows Update's gamingservicesproxy_13.dll, three
 * Brave-Browser temp-file/folder cleanups) -- so this can never
 * blanket-overwrite; every call site here rebuilds `strings` from a
 * `readPendingOperations()` taken moments earlier and only adds or
 * removes the pair this test itself is responsible for. */
async function writeAllPendingOperations(strings) {
  const encodeMultiSz = (list) => {
    const parts = list.map((s) => Buffer.concat([Buffer.from(s, 'utf16le'), Buffer.from([0, 0])]));
    return Buffer.concat([...parts, Buffer.from([0, 0])]);
  };
  const bytes = encodeMultiSz(strings);
  const hexList = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(',');
  const fullKeyPath = PENDING_KEY.replace(/^HKLM\\?/i, 'HKEY_LOCAL_MACHINE\\');
  const regFileText = `Windows Registry Editor Version 5.00\r\n\r\n[${fullKeyPath}]\r\n"${PENDING_VALUE}"=hex(7):${hexList}\r\n\r\n`;
  const regFileBytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(regFileText, 'utf16le')]);
  // Same naming shape pendingReboot.js's own writeMultiSzValue uses
  // (pid + timestamp + random suffix) -- two afterEach cleanups firing in
  // the same millisecond, from this file and a concurrent run, must not
  // collide on one temp path.
  const importFile = join(tmpdir(), `pfro-test-cleanup-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.reg`);
  await writeFile(importFile, regFileBytes);
  try {
    await execFileAsync('reg', ['import', importFile]);
  } finally {
    await rm(importFile, { force: true }).catch(() => {});
  }
}

afterEach(async () => {
  // Remove exactly the pairs this test run added, never the whole value --
  // a real machine's PendingFileRenameOperations can legitimately hold
  // entries from Windows Update or another installer, and clobbering the
  // value here would silently cancel a pending operation that has nothing
  // to do with this test.
  const current = await readPendingOperations();
  const cleaned = [];
  for (let i = 0; i < current.length; i += 2) {
    if (current[i] === MARKER) continue;
    cleaned.push(current[i], current[i + 1]);
  }
  if (cleaned.length !== current.length) {
    if (cleaned.length === 0) {
      await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
    } else {
      await writeAllPendingOperations(cleaned);
    }
  }
});

describe('readPendingOperations', () => {
  it('returns an array (possibly empty) without throwing on a real machine', async () => {
    const result = await readPendingOperations();
    expect(Array.isArray(result)).toBe(true);
  });

  it('preserves empty-string pair elements (delete markers), unlike reg query text output', async () => {
    // This dev machine's PendingFileRenameOperations already holds real
    // delete pairs (source path followed by an empty destination) from
    // Windows Update / Brave-Browser cleanup. `reg query`'s own text
    // rendering silently drops those empty elements -- if this module
    // regressed to that approach, every one of those pairs would come
    // back missing its second half. Read-only: this only asserts on
    // whatever is really there, never writes.
    const result = await readPendingOperations();
    for (let i = 0; i < result.length; i += 2) {
      expect(typeof result[i]).toBe('string');
      expect(typeof result[i + 1]).toBe('string');
    }
  });

  // The critical fix this test exists to lock in: a `reg export` failure
  // that is NOT "key/value genuinely doesn't exist" must propagate as a
  // thrown error, never silently become `[]`. schedulePendingDelete reads
  // via this function and writes the result back as the ENTIRE new
  // registry value -- if a transient export failure (locked temp dir, AV
  // interference, a spawn hiccup) were swallowed into `[]` here, the next
  // write would overwrite and destroy whatever real pairs Windows Update
  // or another installer already had queued, which is exactly what
  // happened on this dev machine's own key throughout this module's
  // development (4 real pending deletes, the whole time). Forces the
  // failure via the mocked `execFile` above rather than against the real
  // registry, since there's no safe real-world way to make `reg export`
  // fail with a non-"not found" error on demand.
  it('throws rather than returning [] when reg export fails for a reason other than "not found"', async () => {
    // execFile's callback is always its LAST argument -- (file, args,
    // callback) when no options object is passed, (file, args, options,
    // callback) when one is -- so pulling it out by position rather than
    // assuming a fixed arity survives either call shape.
    execFile.mockImplementationOnce((...args) => {
      const callback = args[args.length - 1];
      // Shaped like a real execFile failure -- Node's own error message
      // already folds stderr text in (confirmed live: a real access-denied
      // `reg import` failure elsewhere in this suite reads "Command failed:
      // reg import ...\nERROR: Error accessing the registry."), so this
      // mirrors that instead of inventing an unrealistic shape.
      const err = new Error('Command failed: reg export ... /y\nERROR: Access is denied.\r\n');
      err.stderr = 'ERROR: Access is denied.\r\n';
      callback(err);
    });

    await expect(readPendingOperations()).rejects.toThrow(/Access is denied/);
  });
});

// No mocking here, on purpose, same convention quarantine.test.js already
// establishes for the registry -- and no existing test in this codebase
// (restorePoint.test.js, preUninstall.test.js) has a precedent for
// gracefully skipping an admin-required operation: both of those mock the
// privileged call out entirely rather than exercising it for real.
// quarantine.test.js's own registry tests never needed one either, because
// they only ever touch HKCU (no elevation required there).
//
// HKLM\SYSTEM is different: writing to it genuinely requires an elevated
// shell. If these two tests fail with "ERROR: Error accessing the
// registry." (reg import) or similar access-denied text, that means
// exactly one thing -- THIS TEST PROCESS IS NOT RUNNING ELEVATED, not that
// schedulePendingDelete is broken. Run `npx vitest run
// src/services/pendingReboot.test.js` from an elevated shell to actually
// exercise the write path. readPendingOperations's own tests above don't
// have this requirement -- reading HKLM\SYSTEM needs no special privilege,
// only writing to it does.
describe('schedulePendingDelete', () => {
  it('appends a real \\??\\path + empty-string pair to the real registry value', async () => {
    const before = await readPendingOperations();

    await schedulePendingDelete('C:\\prune-pendingreboot-test-marker-' + process.pid + '.tmp');

    const after = await readPendingOperations();
    expect(after.length).toBe(before.length + 2);
    expect(after[after.length - 2]).toBe(MARKER);
    expect(after[after.length - 1]).toBe('');
  });

  it('appends rather than replacing whatever was already pending', async () => {
    await schedulePendingDelete('C:\\prune-pendingreboot-test-marker-' + process.pid + '.tmp');
    const afterFirst = await readPendingOperations();

    await schedulePendingDelete('C:\\prune-pendingreboot-test-marker-' + process.pid + '-second.tmp');
    const afterSecond = await readPendingOperations();

    expect(afterSecond.length).toBe(afterFirst.length + 2);
    expect(afterSecond.slice(0, afterFirst.length)).toEqual(afterFirst);

    // Cleanup this test itself is responsible for -- remove the "-second"
    // pair explicitly (afterEach only strips the module-level MARKER).
    const secondMarker = `\\??\\C:\\prune-pendingreboot-test-marker-${process.pid}-second.tmp`;
    const withoutSecond = [];
    for (let i = 0; i < afterSecond.length; i += 2) {
      if (afterSecond[i] === secondMarker) continue;
      withoutSecond.push(afterSecond[i], afterSecond[i + 1]);
    }
    if (withoutSecond.length === 0) {
      await execFileAsync('reg', ['delete', PENDING_KEY, '/v', PENDING_VALUE, '/f']).catch(() => {});
    } else {
      await writeAllPendingOperations(withoutSecond);
    }
  });
});
