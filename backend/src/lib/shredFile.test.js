import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile, readdir, chmod, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { shredFile, shredPaths, normalizePasses } from './shredFile.js';

// Every test works inside its own temp folder; nothing outside it is touched.
let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-shred-test-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('normalizePasses', () => {
  it('accepts only 1 or 3 and falls back to 1', () => {
    expect(normalizePasses(3)).toBe(3);
    expect(normalizePasses('3')).toBe(3);
    expect(normalizePasses(1)).toBe(1);
    expect(normalizePasses(2)).toBe(1);
    expect(normalizePasses(35)).toBe(1);
    expect(normalizePasses(undefined)).toBe(1);
    expect(normalizePasses('junk')).toBe(1);
  });
});

describe('shredFile', () => {
  it('overwrites the bytes before the file goes, so the original content is gone from the file', async () => {
    const path = join(dir, 'secret.txt');
    const original = Buffer.from('TOP-SECRET-'.repeat(1000));
    await writeFile(path, original);

    let seen;
    await shredFile(path, 1, { onStage: async (stage, p) => { if (stage === 'overwritten') seen = await readFile(p); } });

    // At the moment just before truncation the file still had its size but none of its content.
    expect(seen.length).toBe(original.length);
    expect(seen.equals(Buffer.alloc(original.length))).toBe(true);
    expect(existsSync(path)).toBe(false);
  });

  it('three passes overwrite with random data, leaving nothing of the original pattern', async () => {
    const path = join(dir, 'a.bin');
    const original = Buffer.alloc(300_000, 0xAB);
    await writeFile(path, original);

    const passesSeen = [];
    let last;
    await shredFile(path, 3, {
      chunkBytes: 64 * 1024,
      onStage: async (stage, p, detail) => {
        if (stage === 'pass') passesSeen.push(detail);
        if (stage === 'overwritten') last = await readFile(p);
      }
    });

    expect(passesSeen).toEqual([1, 2, 3]);
    expect(last.length).toBe(original.length);
    expect(last.includes(Buffer.alloc(32, 0xAB))).toBe(false); // nothing of the old pattern survives
    expect(existsSync(path)).toBe(false);
  });

  it('streams in chunks -- a file much larger than the chunk is never held whole', async () => {
    const path = join(dir, 'big.bin');
    await writeFile(path, Buffer.alloc(1_000_000, 1));
    const writes = [];
    await shredFile(path, 1, { chunkBytes: 100_000, onStage: (stage, _p, detail) => { if (stage === 'chunk') writes.push(detail); } });
    expect(writes.length).toBe(10);
    expect(Math.max(...writes)).toBeLessThanOrEqual(100_000);
    expect(writes.reduce((a, b) => a + b, 0)).toBe(1_000_000);
  });

  it('renames the file to a random name before removing it', async () => {
    const path = join(dir, 'named-something-recognisable.txt');
    await writeFile(path, 'hello');
    let renamedTo;
    await shredFile(path, 1, { onStage: (stage, p) => { if (stage === 'renamed') renamedTo = p; } });
    expect(renamedTo).toBeTruthy();
    expect(renamedTo).not.toBe(path);
    expect(renamedTo.toLowerCase()).not.toContain('recognisable');
    expect(await readdir(dir)).toEqual([]);
  });

  it('handles an empty file', async () => {
    const path = join(dir, 'empty.txt');
    await writeFile(path, '');
    const result = await shredFile(path, 3);
    expect(result.bytes).toBe(0);
    expect(existsSync(path)).toBe(false);
  });

  it('clears the read-only attribute rather than failing on it', async () => {
    const path = join(dir, 'locked-down.txt');
    await writeFile(path, 'read only content');
    await chmod(path, 0o444);
    await shredFile(path, 1);
    expect(existsSync(path)).toBe(false);
  });

  it('reports the bytes it destroyed', async () => {
    const path = join(dir, 'five.txt');
    await writeFile(path, '12345');
    expect((await shredFile(path, 1)).bytes).toBe(5);
  });

  it('refuses a directory', async () => {
    await mkdir(join(dir, 'sub'));
    await expect(shredFile(join(dir, 'sub'), 1)).rejects.toThrow(/folder|directory/i);
    expect(existsSync(join(dir, 'sub'))).toBe(true);
  });

  it('throws for a file that does not exist and touches nothing else', async () => {
    await writeFile(join(dir, 'other.txt'), 'x');
    await expect(shredFile(join(dir, 'missing.txt'), 1)).rejects.toThrow();
    expect(existsSync(join(dir, 'other.txt'))).toBe(true);
  });

  it('leaves the file in place, with its read-only flag, when it cannot be opened', async () => {
    const path = join(dir, 'busy.txt');
    await writeFile(path, 'content');
    await chmod(path, 0o444);
    await expect(shredFile(path, 1, { open: async () => { const e = new Error('busy'); e.code = 'EBUSY'; throw e; } }))
      .rejects.toMatchObject({ code: 'EBUSY' });
    expect(await readFile(path, 'utf8')).toBe('content');
    expect((await stat(path)).mode & 0o200).toBe(0); // read-only again
    await chmod(path, 0o666);
  });

  it('stops overwriting when the signal aborts', async () => {
    const path = join(dir, 'abort.bin');
    await writeFile(path, Buffer.alloc(500_000, 7));
    const controller = new AbortController();
    await expect(shredFile(path, 1, {
      chunkBytes: 50_000,
      signal: controller.signal,
      onStage: (stage) => { if (stage === 'chunk') controller.abort(); }
    })).rejects.toMatchObject({ name: 'AbortError' });
  });
});

describe('shredPaths', () => {
  it('shreds files and whole folders, recursively, and removes the emptied folders', async () => {
    await mkdir(join(dir, 'tree', 'deep'), { recursive: true });
    await writeFile(join(dir, 'tree', 'one.txt'), 'one');
    await writeFile(join(dir, 'tree', 'deep', 'two.txt'), 'twotwo');
    await writeFile(join(dir, 'loose.txt'), 'loose');

    const result = await shredPaths([join(dir, 'tree'), join(dir, 'loose.txt')], 1);

    expect(result.failed).toEqual([]);
    expect(result.shredded).toHaveLength(3);
    expect(result.bytes).toBe(3 + 6 + 5);
    expect(await readdir(dir)).toEqual([]);
  });

  it('one failing file does not abort the rest', async () => {
    await writeFile(join(dir, 'good-1.txt'), 'a');
    await writeFile(join(dir, 'bad.txt'), 'b');
    await writeFile(join(dir, 'good-2.txt'), 'c');

    const result = await shredPaths(
      [join(dir, 'good-1.txt'), join(dir, 'bad.txt'), join(dir, 'good-2.txt')],
      1,
      { open: async (path, flags) => {
        if (path.endsWith('bad.txt')) { const e = new Error('in use'); e.code = 'EBUSY'; throw e; }
        const { open } = await import('node:fs/promises');
        return open(path, flags);
      } }
    );

    expect(result.shredded).toHaveLength(2);
    expect(result.failed).toHaveLength(1);
    expect(result.failed[0].path).toMatch(/bad\.txt$/);
    expect(result.failed[0].reason).toMatch(/in use/);
    expect(existsSync(join(dir, 'bad.txt'))).toBe(true);
    expect(existsSync(join(dir, 'good-1.txt'))).toBe(false);
    expect(existsSync(join(dir, 'good-2.txt'))).toBe(false);
  });

  it('keeps a folder that still holds a file it could not shred', async () => {
    await mkdir(join(dir, 'tree'));
    await writeFile(join(dir, 'tree', 'stuck.txt'), 's');
    const result = await shredPaths([join(dir, 'tree')], 1, {
      open: async () => { const e = new Error('locked'); e.code = 'EPERM'; throw e; }
    });
    expect(result.failed).toHaveLength(1);
    expect(existsSync(join(dir, 'tree', 'stuck.txt'))).toBe(true);
  });

  it('removes a junction as a link and never overwrites what it points at', async () => {
    await mkdir(join(dir, 'real'));
    await writeFile(join(dir, 'real', 'precious.txt'), 'must survive');
    await mkdir(join(dir, 'tree'));
    await writeFile(join(dir, 'tree', 'junk.txt'), 'junk');
    const { symlink } = await import('node:fs/promises');
    await symlink(join(dir, 'real'), join(dir, 'tree', 'link'), 'junction');

    const result = await shredPaths([join(dir, 'tree')], 1);

    expect(result.failed).toEqual([]);
    expect(await readFile(join(dir, 'real', 'precious.txt'), 'utf8')).toBe('must survive');
    expect(existsSync(join(dir, 'tree'))).toBe(false);
  });

  it('leaves alone anything the refuse() guard names, and keeps the folder that holds it', async () => {
    await mkdir(join(dir, 'tree', 'protected'), { recursive: true });
    await writeFile(join(dir, 'tree', 'junk.txt'), 'junk');
    await writeFile(join(dir, 'tree', 'protected', 'keep.txt'), 'keep');

    const result = await shredPaths([join(dir, 'tree')], 1, {
      refuse: (path) => (path.endsWith('protected') ? 'protected folder' : null)
    });

    expect(result.held).toEqual([{ path: join(dir, 'tree', 'protected'), reason: 'protected folder' }]);
    expect(result.shredded).toHaveLength(1);
    expect(existsSync(join(dir, 'tree', 'protected', 'keep.txt'))).toBe(true);
    expect(existsSync(join(dir, 'tree', 'junk.txt'))).toBe(false);
  });

  it('a path that does not exist is a failure entry, not a throw', async () => {
    const result = await shredPaths([join(dir, 'nope.txt')], 1);
    expect(result.shredded).toEqual([]);
    expect(result.failed).toHaveLength(1);
  });

  it('reports progress per file', async () => {
    await writeFile(join(dir, 'a.txt'), 'aa');
    await writeFile(join(dir, 'b.txt'), 'bbb');
    const events = [];
    await shredPaths([join(dir, 'a.txt'), join(dir, 'b.txt')], 1, { onProgress: (p) => events.push(p) });
    expect(events.at(-1)).toMatchObject({ filesDone: 2, bytesDone: 5 });
  });

  it('stops between files when aborted, reporting what was left', async () => {
    await writeFile(join(dir, 'a.txt'), 'aa');
    await writeFile(join(dir, 'b.txt'), 'bb');
    const controller = new AbortController();
    const result = await shredPaths([join(dir, 'a.txt'), join(dir, 'b.txt')], 1, {
      signal: controller.signal,
      onProgress: () => controller.abort()
    });
    expect(result.aborted).toBe(true);
    expect(result.shredded).toHaveLength(1);
    expect(existsSync(join(dir, 'b.txt'))).toBe(true);
  });
});
