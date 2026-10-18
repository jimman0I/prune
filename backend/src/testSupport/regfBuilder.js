import { REG_SZ, REG_DWORD, REG_MULTI_SZ } from '../lib/regfReader.js';

/** A tiny regf writer, enough to build hives with every structure the reader
 * has to walk: lh/lf/li subkey lists and an ri list of lists, inline and
 * cell data, big data split across a db cell, ASCII and UTF-16 names. */
export function buildHive(tree, { subkeyList = 'lh', dirty = false } = {}) {
  const chunks = [];
  let next = 32; // after the hbin header
  const alloc = (data) => {
    const size = Math.ceil((data.length + 4) / 8) * 8;
    const cell = Buffer.alloc(size);
    cell.writeInt32LE(-size, 0);
    data.copy(cell, 4);
    const offset = next;
    chunks.push({ offset, cell });
    next += size;
    return offset;
  };
  const utf16 = (s) => Buffer.from(s, 'utf16le');
  const isAscii = (s) => /^[\x20-\x7e]*$/.test(s);

  const value = (name, type, data) => {
    const nameBytes = isAscii(name) ? Buffer.from(name, 'latin1') : utf16(name);
    const vk = Buffer.alloc(20 + nameBytes.length);
    vk.write('vk', 0, 'ascii');
    vk.writeUInt16LE(nameBytes.length, 2);
    vk.writeUInt32LE(type, 12);
    vk.writeUInt16LE(isAscii(name) ? 1 : 0, 16);
    nameBytes.copy(vk, 20);
    if (data.length <= 4) {
      vk.writeUInt32LE((data.length | 0x80000000) >>> 0, 4);
      data.copy(vk, 8);
    } else if (data.length > 16344) {
      const segments = [];
      for (let i = 0; i < data.length; i += 16344) segments.push(alloc(data.subarray(i, i + 16344)));
      const list = Buffer.alloc(segments.length * 4);
      segments.forEach((o, i) => list.writeUInt32LE(o, i * 4));
      const db = Buffer.alloc(8);
      db.write('db', 0, 'ascii');
      db.writeUInt16LE(segments.length, 2);
      db.writeUInt32LE(alloc(list), 4);
      vk.writeUInt32LE(data.length, 4);
      vk.writeUInt32LE(alloc(db), 8);
    } else {
      vk.writeUInt32LE(data.length, 4);
      vk.writeUInt32LE(alloc(data), 8);
    }
    return alloc(vk);
  };
  const encode = (v) => {
    if (typeof v === 'number') { const b = Buffer.alloc(4); b.writeUInt32LE(v, 0); return [REG_DWORD, b]; }
    if (Array.isArray(v)) return [REG_MULTI_SZ, utf16(`${v.join('\0')}\0\0`)];
    return [REG_SZ, utf16(`${v}\0`)];
  };
  const list = (offsets) => {
    if (subkeyList === 'ri' && offsets.length > 1) {
      const half = Math.ceil(offsets.length / 2);
      const parts = [offsets.slice(0, half), offsets.slice(half)].map((part) => {
        const li = Buffer.alloc(4 + part.length * 4);
        li.write('li', 0, 'ascii');
        li.writeUInt16LE(part.length, 2);
        part.forEach((o, i) => li.writeUInt32LE(o, 4 + i * 4));
        return alloc(li);
      });
      const ri = Buffer.alloc(4 + parts.length * 4);
      ri.write('ri', 0, 'ascii');
      ri.writeUInt16LE(parts.length, 2);
      parts.forEach((o, i) => ri.writeUInt32LE(o, 4 + i * 4));
      return alloc(ri);
    }
    // An ri list only makes sense with several children; one child gets lh.
    const kind = subkeyList === 'ri' ? 'lh' : subkeyList;
    const wide = kind !== 'li';
    const b = Buffer.alloc(4 + offsets.length * (wide ? 8 : 4));
    b.write(kind, 0, 'ascii');
    b.writeUInt16LE(offsets.length, 2);
    offsets.forEach((o, i) => b.writeUInt32LE(o, 4 + i * (wide ? 8 : 4)));
    return alloc(b);
  };
  const key = (name, node) => {
    const children = Object.entries(node).filter(([k]) => k !== '$values').map(([k, v]) => key(k, v));
    const values = Object.entries(node.$values || {}).map(([k, v]) => value(k, ...encode(v)));
    const nameBytes = isAscii(name) ? Buffer.from(name, 'latin1') : utf16(name);
    const nk = Buffer.alloc(0x4c + nameBytes.length);
    nk.write('nk', 0, 'ascii');
    nk.writeUInt16LE(isAscii(name) ? 0x20 : 0, 2);
    nk.writeUInt32LE(children.length, 0x14);
    nk.writeUInt32LE(children.length ? list(children) : 0xffffffff, 0x1c);
    nk.writeUInt32LE(values.length, 0x24);
    if (values.length) {
      const vl = Buffer.alloc(values.length * 4);
      values.forEach((o, i) => vl.writeUInt32LE(o, i * 4));
      nk.writeUInt32LE(alloc(vl), 0x28);
    } else {
      nk.writeUInt32LE(0xffffffff, 0x28);
    }
    nk.writeUInt16LE(nameBytes.length, 0x48);
    nameBytes.copy(nk, 0x4c);
    return alloc(nk);
  };
  const root = key('ROOT', tree);
  const base = Buffer.alloc(4096);
  base.write('regf', 0, 'ascii');
  base.writeUInt32LE(5, 4);
  base.writeUInt32LE(dirty ? 4 : 5, 8);
  base.writeUInt32LE(1, 20);
  base.writeUInt32LE(5, 24);
  base.writeUInt32LE(root, 36);
  const body = Buffer.alloc(next);
  body.write('hbin', 0, 'ascii');
  for (const { offset, cell } of chunks) cell.copy(body, offset);
  return Buffer.concat([base, body]);
}

/** The Add/Remove part of a user hive, around the given entries. */
export const uninstallTree = (apps) => ({ Software: { Microsoft: { Windows: { CurrentVersion: { Uninstall: apps } } } } });
