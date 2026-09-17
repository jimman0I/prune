import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const execFileAsync = promisify(execFile);

/** The one place Windows itself looks for reboot-scheduled file operations
 * -- this is not Prune's own key, it's the kernel's. Session Manager
 * replays every pair in here during the next boot, before any user-mode
 * process (including Explorer) starts, which is the one moment nothing
 * can hold a handle to a locked file. */
export const PENDING_KEY = 'HKLM\\SYSTEM\\CurrentControlSet\\Control\\Session Manager';
export const PENDING_VALUE = 'PendingFileRenameOperations';

const FULL_HIVE_NAMES = { HKLM: 'HKEY_LOCAL_MACHINE', HKCU: 'HKEY_CURRENT_USER' };

/** `HKLM\Foo\Bar` (reg.exe's own abbreviated hive syntax, used everywhere
 * else in this codebase) -> `HKEY_LOCAL_MACHINE\Foo\Bar` (the full name a
 * `.reg` file's `[section]` header requires -- confirmed live: `reg
 * export` writes the full name, and `reg import` rejects a `[HKLM\...]`
 * section as an unrecognized root). */
function toFullHiveKeyPath(regExeKeyPath) {
  const [hive, ...rest] = regExeKeyPath.split('\\');
  return [FULL_HIVE_NAMES[hive] ?? hive, ...rest].join('\\');
}

/** Encodes a flat list of strings as the raw bytes a `REG_MULTI_SZ`
 * actually stores: each string as UTF-16LE followed by its own NUL
 * (`\u0000`) terminator, then one MORE NUL terminator after the last
 * string marking the end of the list. Confirmed against a real machine's
 * own `PendingFileRenameOperations` value (via `reg export`'s `hex(7):`
 * encoding) before writing this -- an empty string mid-list is just a
 * terminator with nothing in front of it (two consecutive NUL words),
 * and Explorer's/Brave's own real pending deletes on this dev machine are
 * living proof that's a valid, common shape for this exact value. */
function encodeMultiSz(strings) {
  const parts = strings.map((s) => Buffer.concat([Buffer.from(s, 'utf16le'), Buffer.from([0, 0])]));
  return Buffer.concat([...parts, Buffer.from([0, 0])]);
}

/** The inverse of encodeMultiSz. Splits on every NUL word (`00,00`) to
 * recover each string, INCLUDING empty ones in the middle of the list --
 * this is the whole reason this module talks to the registry via
 * `hex(7):` bytes instead of `reg query`'s human-readable text rendering.
 * `reg query`'s own text display silently drops empty-string elements
 * entirely (confirmed live: a value with 8 real elements, 4 of them
 * empty, prints as if it only had 4), which would have made a delete
 * pair (source + empty destination) indistinguishable from a run of
 * plain rename sources once read back.
 *
 * Splitting always yields exactly one more segment than there are real
 * strings -- the list's own trailing terminator NUL has nothing after it
 * either, so it decodes as one final empty "string" that isn't data, just
 * the end-of-list marker. Dropping that last entry unconditionally is
 * safe precisely because it's unconditional: it removes the terminator
 * artifact whether or not the true last element also happens to be
 * empty, without needing to guess which is which. */
function decodeMultiSz(buffer) {
  const segments = [];
  let start = 0;
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    if (buffer[i] === 0 && buffer[i + 1] === 0) {
      segments.push(buffer.subarray(start, i).toString('utf16le'));
      start = i + 2;
    }
  }
  segments.pop(); // the list's own terminator, not a data element
  return segments;
}

// reg.exe's own exact message for "this key/value genuinely doesn't
// exist" -- confirmed live against a disposable scratch key that never
// existed (`reg export HKCU\Software\<random-name-that-was-never-
// created> ... /y`), NOT assumed from documentation. Matched narrowly on
// purpose: see readMultiSzValue's catch below for why treating any OTHER
// failure the same way would be dangerous here.
//
// English only. reg.exe's error text is localized, so this regex will not
// match on a non-English Windows install -- but the failure direction is
// the SAFE one: a genuinely-absent value on such a machine would fail
// this match and get rethrown as an unexpected error (over-cautious,
// annoying) rather than the dangerous direction (a real failure silently
// read as "absent" and then overwritten). Worth a real fix -- checking
// reg.exe's exit code/behavior in a locale-independent way -- if this
// ever actually bites someone; not done here since it can't cause data
// loss as it stands.
const KEY_OR_VALUE_NOT_FOUND = /unable to find the specified registry key or value/i;

/** Reads one `REG_MULTI_SZ` value as a flat array of strings, via `reg
 * export` + parsing the `.reg` file's `hex(7):` bytes -- NOT `reg query`,
 * whose text output loses empty elements (see decodeMultiSz above). `reg
 * export` exports the WHOLE key (there's no per-value export), so this
 * pulls just the one value's line back out of that file; a key with no
 * such value present (the common case -- nothing pending) is not an
 * error, it's simply absent from the export, and this returns `[]`. */
async function readMultiSzValue(regExeKeyPath, valueName) {
  const exportFile = join(tmpdir(), `prune-pfro-read-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.reg`);
  try {
    await execFileAsync('reg', ['export', regExeKeyPath, exportFile, '/y']);
  } catch (err) {
    // ONLY a genuinely absent key/value means "nothing pending" -- every
    // other failure (a locked temp dir, AV interference, a full disk, a
    // spawn hiccup) must propagate as a thrown error instead. The caller
    // that matters here, schedulePendingDelete, treats `[]` as "start
    // from an empty list" and writes the result back as the ENTIRE new
    // value -- so mistaking a transient export failure for "nothing
    // pending" would silently overwrite and destroy whatever real pairs
    // Windows Update or another installer already had queued (this dev
    // machine's own key held 4 of them the whole time this module was
    // being built). A catch-all here would have hidden exactly the
    // failure mode this module exists to prevent.
    const message = String(err?.stderr ?? err?.message ?? '');
    if (!KEY_OR_VALUE_NOT_FOUND.test(message)) throw err;
    return [];
  }
  try {
    const content = await readFile(exportFile, 'utf16le');
    const lines = content.split(/\r?\n/);
    const marker = `"${valueName}"=hex(7):`;
    const startLine = lines.findIndex((line) => line.startsWith(marker));
    if (startLine === -1) return [];

    // A `.reg` file wraps a long hex(7) value across lines, each
    // continued line ending the PREVIOUS line with a trailing `\` --
    // reassemble the full comma-separated byte list before parsing it.
    let hexText = lines[startLine].slice(marker.length);
    let line = startLine;
    while (hexText.trimEnd().endsWith('\\')) {
      hexText = hexText.trimEnd().slice(0, -1);
      line += 1;
      hexText += lines[line].trim();
    }

    const bytes = hexText.split(',').map((token) => token.trim()).filter(Boolean).map((token) => parseInt(token, 16));
    return decodeMultiSz(Buffer.from(bytes));
  } finally {
    await rm(exportFile, { force: true }).catch(() => {});
  }
}

/** Writes one `REG_MULTI_SZ` value via a generated `.reg` file + `reg
 * import`, rather than `reg add /t REG_MULTI_SZ /d "..."`.
 *
 * Real bug, found live before this module had a single line of
 * implementation: `reg add`'s `/d` cannot encode an empty-string list
 * element at all. `reg add ... /d "AAA\0\0BBB"` (an empty element in the
 * middle) fails outright with "ERROR: Invalid value specified for '/d'."
 * -- and `reg add ... /d "AAA\0"` (a single trailing empty element,
 * exactly what a delete pair's second half needs) is worse: it EXITS 0,
 * "The operation completed successfully," while silently writing a
 * `REG_MULTI_SZ` containing only `["AAA"]` -- the empty destination that
 * marks the pair as a delete rather than a rename is just gone, no
 * error, no warning. Confirmed with Node's `execFile` directly (the same
 * call path this module uses), not just interactively. On a real
 * machine's `PendingFileRenameOperations` -- which almost always already
 * holds real pairs from Windows Update or another installer -- silently
 * corrupting that pairing would misalign every entry after it.
 *
 * `reg import`'s `hex(7):` byte encoding has no such ambiguity (see
 * encodeMultiSz), and this codebase already trusts `reg export`/`reg
 * import` with real `.reg` files for exactly this kind of registry
 * round-trip (quarantine.js's own backup/restore). Import MERGES into
 * the key rather than replacing it, so this only ever touches the one
 * named value -- every sibling value already in Session Manager
 * (BootExecute, CriticalSectionTimeout, ...) is left untouched. */
async function writeMultiSzValue(regExeKeyPath, valueName, strings) {
  const bytes = encodeMultiSz(strings);
  const hexList = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join(',');
  const fullKeyPath = toFullHiveKeyPath(regExeKeyPath);
  const regFileText = `Windows Registry Editor Version 5.00\r\n\r\n[${fullKeyPath}]\r\n"${valueName}"=hex(7):${hexList}\r\n\r\n`;
  // UTF-16LE with a BOM -- the same encoding `reg export` itself writes,
  // and the one `reg import` reliably recognizes as Unicode rather than
  // falling back to the legacy ANSI-only `REGEDIT4` format.
  const regFileBytes = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(regFileText, 'utf16le')]);

  const importFile = join(tmpdir(), `prune-pfro-write-${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.reg`);
  await writeFile(importFile, regFileBytes);
  try {
    await execFileAsync('reg', ['import', importFile]);
  } finally {
    await rm(importFile, { force: true }).catch(() => {});
  }
}

/** Reads the current value as a flat array of strings, in the same
 * source/dest pairs Windows itself stores them in.
 *
 * Contract: resolves to `[]` ONLY when the key or value is genuinely
 * absent (nothing pending -- the common case on almost every real
 * machine), same as a rule with nothing to clean is 0 bytes, not a
 * failure. Anything else -- a transient `reg export` failure, a
 * permissions problem, a malformed export -- REJECTS instead. A caller
 * must never treat a thrown error here as "nothing pending": this
 * function is the read half of schedulePendingDelete's read-modify-write,
 * and mistaking "I couldn't check what's there" for "nothing is there"
 * is exactly the failure mode that would let a write silently overwrite
 * real pending operations already queued by Windows Update or another
 * installer (see readMultiSzValue's own comment for the confirmed
 * reg.exe behavior this is guarding against). */
export async function readPendingOperations() {
  return readMultiSzValue(PENDING_KEY, PENDING_VALUE);
}

/** Schedules `filePath` for deletion at the next boot -- the direct
 * registry-write equivalent of
 * `MoveFileExW(filePath, NULL, MOVEFILE_DELAY_UNTIL_REBOOT)`. Appends
 * rather than replacing: another installer or Windows Update may already
 * have a pending operation queued (this dev machine's own value already
 * held 4 real pairs from Windows Update and Brave before this module was
 * ever exercised), and clobbering it would silently cancel work that has
 * nothing to do with this one. Requires admin -- `HKLM\SYSTEM` is not
 * writable by a standard user token, and the caller (quarantine.js) only
 * reaches this when the setting that gates it is on AND the file is
 * genuinely locked.
 *
 * NOT safe to call concurrently with itself. This is a read-modify-write
 * over the WHOLE registry value, not an atomic append: two overlapping
 * calls both read the same `current`, and whichever one's `reg import`
 * lands second overwrites the first's appended entry without a trace --
 * no error, no warning, the first scheduled delete just silently never
 * happens. This is safe today only because this module's one real
 * caller, quarantine.js's locked-file path, is a sequential `for` loop
 * that `await`s each call before starting the next. If that loop is ever
 * changed to run in parallel (`Promise.all`, concurrent batches, etc.),
 * this function needs real serialization (a queue, a lock file) added
 * first -- don't remove the sequential-await assumption without adding
 * one. */
export async function schedulePendingDelete(filePath) {
  const current = await readPendingOperations();
  const next = [...current, `\\??\\${filePath}`, ''];
  await writeMultiSzValue(PENDING_KEY, PENDING_VALUE, next);
}
