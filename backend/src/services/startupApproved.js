/** Whether Windows will actually run a startup entry, or is only keeping it.
 *
 * Turning a startup item off does not delete it. Windows leaves the Run
 * value or the Startup-folder shortcut exactly where it is and records the
 * decision separately, under
 * `...\Explorer\StartupApproved\{Run,Run32,StartupFolder}`, as a binary
 * value named after the entry. That is why Task Manager's Startup tab can
 * show something as Disabled while the Run key still holds it, and why a
 * list that reads only the Run keys -- which is what this one did -- calls
 * twenty-two switched-off entries "running at sign-in".
 *
 * The first byte carries the state and the remaining eleven are a
 * timestamp of when it was last changed. The low bit of that byte is the
 * flag: even is enabled, odd is disabled. In practice the values seen are
 * 0x02 and 0x06 for enabled, 0x03 and 0x07 for disabled -- reading the bit
 * rather than matching those four exact numbers is both shorter and
 * survives a value this machine has not produced yet.
 *
 * No entry at all means enabled. An item Windows has never been asked to
 * disable has nothing recorded here, which is the case for most of them. */
export function isStartupEnabled(approvedValue) {
  if (approvedValue === null || approvedValue === undefined) return true;

  const firstByte = firstByteOf(approvedValue);
  // Present but unreadable. Enabled is the safer reading: this list's job
  // is to show what runs, and hiding something as "off" when it may well
  // be on is the failure that matters.
  if (firstByte === null) return true;

  return (firstByte & 1) === 0;
}

/** The first byte, however PowerShell handed the binary value over.
 *
 * ConvertTo-Json renders a REG_BINARY as an array of numbers, but a value
 * that has been through a string conversion somewhere arrives as
 * "2 0 0 0..." or "02,00,00" instead, and a single-element array is
 * flattened to a bare number. All four shapes have been seen coming out of
 * one query, so all four are read rather than assumed away. */
function firstByteOf(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value & 0xff : null;

  if (Array.isArray(value)) {
    if (value.length === 0) return null;
    const first = Number(value[0]);
    return Number.isFinite(first) ? first & 0xff : null;
  }

  if (typeof value === 'string') {
    const match = /^\s*([0-9a-f]{1,2})\b/i.exec(value.trim());
    if (!match) return null;
    // Decimal when the string is plainly decimal ("2 0 0"), hex when it
    // looks like hex ("02,00" is ambiguous but agrees either way for the
    // values that matter).
    const parsed = parseInt(match[1], /^[0-9]+$/.test(match[1]) ? 10 : 16);
    return Number.isFinite(parsed) ? parsed & 0xff : null;
  }

  return null;
}

/** Which StartupApproved key holds the decision for one entry, or null
 * when Windows keeps no decision for it at all.
 *
 * Three keys, and an entry is only ever in one of them: a Startup-folder
 * shortcut is recorded by its file name under StartupFolder, a 64-bit Run
 * value under Run, and a 32-bit one under Run32. Looking in the wrong key
 * finds nothing, which reads as "enabled" -- the same silent wrong answer
 * as not looking at all.
 *
 * RunOnce is the fourth case and belongs in none of them. Both hives on
 * this machine hold exactly those three subkeys and no RunOnce, which is
 * also why Task Manager's Startup tab never lists a RunOnce entry:
 * Windows runs them once and deletes them, so there is nothing to record.
 * Answering "Run" for one is not a harmless miss -- it reads a DIFFERENT
 * entry's state whenever a Run value shares the name, and a writer using
 * the same answer would switch that other entry off. */
export function approvedKindFor(item) {
  if (item?.source === 'folder') return 'StartupFolder';
  if (/^RunOnce$/i.test(item?.location || '') || /\\RunOnce$/i.test(item?.registryKey || '')) {
    return null;
  }
  // The registry path, not the display label. `location` is the friendly
  // kind ("Run (32-bit)"), and matching WOW6432Node against that finds
  // nothing -- which reads as enabled, the silent wrong answer again.
  return /WOW6432Node/i.test(item?.registryKey || '') ? 'Run32' : 'Run';
}

/** The key an entry's decision is filed under.
 *
 * Scope as well as kind: the per-user and machine-wide StartupApproved
 * keys are different keys and an entry appears in exactly one of them, so
 * a lookup that ignored scope would read a machine entry's state off a
 * user entry that happens to share its name. */
export function approvedLookupKey(item) {
  return `${item?.scope === 'machine' ? 'machine' : 'user'}|${approvedKindFor(item)}|${item?.approvedName ?? item?.name ?? ''}`;
}
