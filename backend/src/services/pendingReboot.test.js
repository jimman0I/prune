import { describe, it, expect, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { schedulePendingDelete, readPendingOperations, PENDING_KEY, PENDING_VALUE } from './pendingReboot.js';

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
  const importFile = join(tmpdir(), `pfro-test-cleanup-${process.pid}-${Date.now()}.reg`);
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
