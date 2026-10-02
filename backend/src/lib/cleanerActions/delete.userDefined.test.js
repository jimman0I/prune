import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scan, resolveActionFiles } from './delete.js';

/** Two things a rule written by the user (or imported) needs that the curated
 * rules did not:
 *
 * - `filesOnly`: BleachBit's search="file" and search="glob" take FILES. A
 *   delete action given a folder walks all of it; one that is filesOnly must
 *   not, or a cleaner that names `%AppData%\Foo` meaning one file called Foo
 *   would clear a folder.
 * - `userDefined`: every file is checked against the protected places
 *   (Windows, Program Files, whole drives, profiles, Quarantine), because
 *   nobody curated this path. Reads only: scan and the resolver, never a
 *   removal, and the "protected" probes are against real system folders that
 *   are listed and counted, not touched. */

let dir;
beforeEach(async () => { dir = await mkdtemp(join(tmpdir(), 'prune-userdef-')); });
afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

describe('filesOnly', () => {
  it('takes the files a pattern matches and skips a folder that matches it', async () => {
    await writeFile(join(dir, 'a.tmp'), 'aaa');
    await mkdir(join(dir, 'b.tmp'));
    await writeFile(join(dir, 'b.tmp', 'inside.dat'), 'x'.repeat(100));
    const result = scan({ expandedPaths: [join(dir, '*.tmp')], filesOnly: true }, {});
    expect(result.fileCount).toBe(1);
    expect(result.sizeBytes).toBe(3);
    expect(result.files.map((f) => f.path)).toEqual([join(dir, 'a.tmp')]);
  });

  it('given a folder, takes nothing', async () => {
    await writeFile(join(dir, 'a.tmp'), 'aaa');
    expect(scan({ expandedPaths: [dir], filesOnly: true }, {}).fileCount).toBe(0);
  });

  it('given a file, takes that file', async () => {
    await writeFile(join(dir, 'one.log'), 'abcd');
    expect(scan({ expandedPaths: [join(dir, 'one.log')], filesOnly: true }, {}).sizeBytes).toBe(4);
  });

  it('without it a folder is still walked whole, as every built-in rule expects', async () => {
    await writeFile(join(dir, 'a.tmp'), 'aaa');
    expect(scan({ expandedPaths: [dir] }, {}).fileCount).toBe(1);
  });

  it('the resolver (what Clean uses) agrees', async () => {
    await mkdir(join(dir, 'd.tmp'));
    await writeFile(join(dir, 'd.tmp', 'x'), 'x');
    await writeFile(join(dir, 'f.tmp'), 'f');
    const { files } = resolveActionFiles([join(dir, '*.tmp')], {}, null, { filesOnly: true });
    expect(files.map((f) => f.path)).toEqual([join(dir, 'f.tmp')]);
  });
});

describe('userDefined', () => {
  const fonts = join(process.env.SystemRoot || 'C:\\Windows', 'Fonts');

  it('holds back files in a protected place, with the reason', () => {
    const result = scan({ expandedPaths: [fonts], userDefined: true }, {});
    expect(result.fileCount).toBe(0);
    expect(result.heldCount).toBeGreaterThan(0);
  });

  it('is what separates it from a curated rule, which Windows\' own temp folders rely on', () => {
    // Same folder, no flag: counted (the curated rules legitimately clean under Windows).
    expect(scan({ expandedPaths: [fonts] }, {}).fileCount).toBeGreaterThan(0);
  });

  it('the resolver holds them too, so Clean cannot take what Preview refused', () => {
    const { files, held } = resolveActionFiles([fonts], {}, null, { userDefined: true });
    expect(files).toEqual([]);
    expect(held.length).toBeGreaterThan(0);
    expect(held[0].reason).toMatch(/protected|Windows/i);
  });

  it('leaves ordinary files alone', async () => {
    await writeFile(join(dir, 'mine.txt'), 'mine');
    const result = scan({ expandedPaths: [dir], userDefined: true }, {});
    expect(result.fileCount).toBe(1);
    expect(result.heldCount).toBe(0);
  });

  it('still honours the user\'s exclusions and the recent-files guard', async () => {
    await mkdir(join(dir, 'keep'));
    await writeFile(join(dir, 'keep', 'k.txt'), 'k');
    await writeFile(join(dir, 'new.txt'), 'n');
    const result = scan({ expandedPaths: [dir], userDefined: true }, { excludeFolders: [join(dir, 'keep')], skipRecentHours: 24 });
    expect(result.fileCount).toBe(0);
    expect(result.heldCount).toBe(2);
  });
});
