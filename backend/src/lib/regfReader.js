/** Reads a Windows registry hive file (regf) directly, read-only.
 *
 * For the other accounts' NTUSER.DAT (services/otherAccounts.js). Windows
 * offers two ways to open one, and on the dev machine neither worked:
 * `reg load` refused every account with "The filename or extension is too
 * long", and RegLoadAppKey -- which loads a hive privately, never under
 * HKEY_USERS -- opens app hives fine but rejects a user hive as "corrupt".
 * Reading the file needs neither, mounts nothing, and so cannot leave
 * anything mounted that would stop a profile from loading.
 *
 * The format is public and stable: a 4 KB base block, then hive bins of
 * cells. Each cell starts with its size (negative while in use). Keys are
 * `nk` cells, their subkeys in `lf`/`lh`/`li` lists (or an `ri` list of
 * lists), their values `vk` cells; data of four bytes or less sits inside
 * the `vk` itself, and data over 16 344 bytes is split across a `db` cell's
 * segments.
 *
 * A hive marked dirty (its two sequence numbers differ) has changes that
 * live only in its journals, NTUSER.DAT.LOG1 and .LOG2. Found on the build
 * runner: its Default profile hive read back without its Software key at
 * all. Pass the journals and their entries are replayed into a copy of the
 * hive before anything is read (replayLogs below); without them a dirty
 * hive is read as it stands and says so. */

const BASE = 4096;
const BIG_DATA_SEGMENT = 16344;

export const REG_SZ = 1;
export const REG_EXPAND_SZ = 2;
export const REG_DWORD = 4;
export const REG_MULTI_SZ = 7;

/** The hive with its journals' entries applied, or the hive itself when it
 * is clean or no journal has anything to add.
 *
 * Journals in the format Windows has written since 8.1: a 512-byte header,
 * then "HvLE" entries, each with a sequence number, the size of the hive
 * bins after it, and a list of dirty pages (offset into the hive bins, and
 * size) followed by those pages' bytes. The entries to apply start at the
 * hive's own secondary sequence number and run on without a gap, across
 * both journals; anything torn or out of bounds ends the run. */
export function replayLogs(buffer, logs = []) {
  if (buffer.readUInt32LE(4) === buffer.readUInt32LE(8)) return { buffer, replayed: 0 };
  const entries = [];
  for (const log of logs) {
    if (!Buffer.isBuffer(log) || log.length < 1024 || log.toString('ascii', 0, 4) !== 'regf') continue;
    for (let at = 512; at + 40 <= log.length;) {
      if (log.toString('ascii', at, at + 4) !== 'HvLE') break;
      const size = log.readUInt32LE(at + 4);
      if (size < 40 || size % 512 !== 0 || at + size > log.length) break;
      const entry = log.subarray(at, at + size);
      const count = entry.readUInt32LE(20);
      const pages = [];
      let data = 40 + count * 8;
      let valid = data <= size;
      for (let i = 0; valid && i < count; i += 1) {
        const offset = entry.readUInt32LE(40 + i * 8);
        const pageSize = entry.readUInt32LE(44 + i * 8);
        if (data + pageSize > size) { valid = false; break; }
        pages.push({ offset, bytes: entry.subarray(data, data + pageSize) });
        data += pageSize;
      }
      if (!valid) break;
      entries.push({ sequence: entry.readUInt32LE(12), binsSize: entry.readUInt32LE(16), pages });
      at += size;
    }
  }
  entries.sort((a, b) => a.sequence - b.sequence);
  let next = buffer.readUInt32LE(8);
  let out = null;
  let replayed = 0;
  for (const entry of entries) {
    if (entry.sequence < next) continue;
    if (entry.sequence !== next) break;
    if (!out) out = Buffer.from(buffer);
    const needed = BASE + entry.binsSize;
    if (out.length < needed) out = Buffer.concat([out, Buffer.alloc(needed - out.length)]);
    for (const page of entry.pages) {
      if (BASE + page.offset + page.bytes.length > out.length) continue;
      page.bytes.copy(out, BASE + page.offset);
    }
    replayed += 1;
    next += 1;
  }
  if (!out) return { buffer, replayed: 0 };
  // Now consistent: both sequence numbers agree.
  out.writeUInt32LE(next, 4);
  out.writeUInt32LE(next, 8);
  return { buffer: out, replayed };
}

export function openHive(input, { logs } = {}) {
  if (!Buffer.isBuffer(input) || input.length < BASE + 32 || input.toString('ascii', 0, 4) !== 'regf') {
    throw new Error('Not a registry hive file.');
  }
  const buffer = logs?.length ? replayLogs(input, logs).buffer : input;
  const minor = buffer.readUInt32LE(24);
  const dirty = buffer.readUInt32LE(4) !== buffer.readUInt32LE(8);
  const rootOffset = buffer.readUInt32LE(36);

  /** The data of the cell at a hive offset (after its size field). */
  const cell = (offset) => {
    const at = BASE + offset;
    if (offset === 0xffffffff || at + 4 > buffer.length) throw new Error('A key points outside the hive.');
    const size = Math.abs(buffer.readInt32LE(at));
    if (size < 4 || at + size > buffer.length) throw new Error('A cell runs past the end of the hive.');
    return buffer.subarray(at + 4, at + size);
  };

  const subkeyOffsets = (listOffset, depth = 0) => {
    if (listOffset === 0xffffffff || depth > 4) return [];
    const list = cell(listOffset);
    const sig = list.toString('ascii', 0, 2);
    const count = list.readUInt16LE(2);
    const out = [];
    if (sig === 'lf' || sig === 'lh') {
      for (let i = 0; i < count; i += 1) out.push(list.readUInt32LE(4 + i * 8));
    } else if (sig === 'li') {
      for (let i = 0; i < count; i += 1) out.push(list.readUInt32LE(4 + i * 4));
    } else if (sig === 'ri') {
      for (let i = 0; i < count; i += 1) out.push(...subkeyOffsets(list.readUInt32LE(4 + i * 4), depth + 1));
    }
    return out;
  };

  const readData = (vk) => {
    const rawSize = vk.readUInt32LE(4);
    const dataOffset = vk.readUInt32LE(8);
    if (rawSize & 0x80000000) {
      const size = rawSize & 0x7fffffff;
      return vk.subarray(8, 8 + Math.min(size, 4));
    }
    if (rawSize === 0) return Buffer.alloc(0);
    const data = cell(dataOffset);
    if (rawSize > BIG_DATA_SEGMENT && minor >= 4 && data.toString('ascii', 0, 2) === 'db') {
      const segments = data.readUInt16LE(2);
      const list = cell(data.readUInt32LE(4));
      const parts = [];
      let left = rawSize;
      for (let i = 0; i < segments && left > 0; i += 1) {
        const part = cell(list.readUInt32LE(i * 4));
        const take = Math.min(left, BIG_DATA_SEGMENT, part.length);
        parts.push(part.subarray(0, take));
        left -= take;
      }
      return Buffer.concat(parts);
    }
    return data.subarray(0, Math.min(rawSize, data.length));
  };

  const decode = (type, data) => {
    if (type === REG_SZ || type === REG_EXPAND_SZ) return data.toString('utf16le').replace(/\0[\s\S]*$/, '');
    if (type === REG_DWORD) return data.length >= 4 ? data.readUInt32LE(0) : null;
    if (type === REG_MULTI_SZ) return data.toString('utf16le').split('\0').filter(Boolean);
    return null;
  };

  const key = (offset) => {
    const nk = cell(offset);
    if (nk.toString('ascii', 0, 2) !== 'nk') throw new Error('Expected a key record.');
    const flags = nk.readUInt16LE(2);
    const nameLength = nk.readUInt16LE(0x48);
    const nameBytes = nk.subarray(0x4c, 0x4c + nameLength);
    const name = flags & 0x20 ? nameBytes.toString('latin1') : nameBytes.toString('utf16le');
    return {
      name,
      subkeys() {
        return subkeyOffsets(nk.readUInt32LE(0x1c)).map(key);
      },
      subkey(path) {
        let current = this;
        for (const part of String(path).split('\\').filter(Boolean)) {
          current = current.subkeys().find((k) => k.name.toLowerCase() === part.toLowerCase());
          if (!current) return null;
        }
        return current;
      },
      values() {
        const count = nk.readUInt32LE(0x24);
        const listOffset = nk.readUInt32LE(0x28);
        if (!count || listOffset === 0xffffffff) return {};
        const list = cell(listOffset);
        const out = {};
        for (let i = 0; i < count && 4 * i + 4 <= list.length; i += 1) {
          try {
            const vk = cell(list.readUInt32LE(i * 4));
            if (vk.toString('ascii', 0, 2) !== 'vk') continue;
            const vNameLength = vk.readUInt16LE(2);
            const type = vk.readUInt32LE(12);
            const vFlags = vk.readUInt16LE(16);
            const vNameBytes = vk.subarray(20, 20 + vNameLength);
            const vName = vFlags & 0x1 ? vNameBytes.toString('latin1') : vNameBytes.toString('utf16le');
            const value = decode(type, readData(vk));
            if (value !== null) out[vName] = value;
          } catch {
            // One unreadable value does not lose the key's others.
          }
        }
        return out;
      }
    };
  };

  return { dirty, root: () => key(rootOffset) };
}

/** The Add/Remove entries in a user hive, shaped like the elevated scan's
 * own rows: { keyName, DisplayName, Publisher, ... } with every value a
 * string. */
export function readUninstallEntries(buffer, { logs } = {}) {
  const hive = openHive(buffer, { logs });
  const uninstall = hive.root().subkey('Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall');
  const entries = [];
  for (const k of uninstall ? uninstall.subkeys() : []) {
    const entry = { keyName: k.name };
    for (const [name, value] of Object.entries(k.values())) entry[name] = Array.isArray(value) ? value.join(' ') : String(value);
    entries.push(entry);
  }
  return { dirty: hive.dirty, entries };
}
