import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, symlink, utimes } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findFiles, scan, execute, BACKUP, TMP, VIM_SWAP_USER, DS_STORE, THUMBS_DB } from './deepscan.js';

// Every test builds a real tree in a temp folder and deletes only inside it.
let root;
let quarantine;
let outside;

const touch = async (rel, body = 'x', ageHours = 100) => {
  const full = join(root, rel);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, body);
  const when = new Date(Date.now() - ageHours * 3600_000);
  await utimes(full, when, when);
  return full;
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-deepscan-'));
  quarantine = await mkdtemp(join(tmpdir(), 'prune-deepscan-q-'));
  outside = await mkdtemp(join(tmpdir(), 'prune-deepscan-out-'));
  process.env.UNREVO_QUARANTINE_ROOT = quarantine;
});
afterEach(async () => {
  delete process.env.UNREVO_QUARANTINE_ROOT;
  await rm(root, { recursive: true, force: true });
  await rm(quarantine, { recursive: true, force: true });
  await rm(outside, { recursive: true, force: true });
});

const names = (result) => result.files.map((f) => f.path.slice(root.length + 1).replace(/\\/g, '/')).sort();

describe("BleachBit's deep-scan patterns, mirrored", () => {
  it("backup: .bak in any case, or 1-4 letters then '~', at the end of the name", async () => {
    await touch('a/notes.bak');
    await touch('a2/NOTES.BAK');
    await touch('b/deep/er/config.Bak');
    await touch('c/file.txt~');
    await touch('c/x~');
    await touch('d/notes.bak.txt'); // does not END in .bak
    await touch('d/backup.doc');
    await touch('d/12345~'); // digits are not letters
    const found = await findFiles(root, { patterns: BACKUP });
    expect(names(found)).toEqual(['a/notes.bak', 'a2/NOTES.BAK', 'b/deep/er/config.Bak', 'c/file.txt~', 'c/x~']);
  });

  it('tmp: only Word ~wrXNNNN.tmp and PowerPoint pptNNNN.tmp, not every .tmp', async () => {
    await touch('w/~wra0001.tmp');
    await touch('w/~WRL1234.TMP');
    await touch('p/ppt0001.tmp');
    await touch('p/PPT9999.tmp');
    await touch('o/random.tmp');
    await touch('o/~wr1234.tmp'); // fourth character must be a letter
    await touch('o/ppt001.tmp'); // four digits, not three
    await touch('o/ppt00012.tmp'); // and not five
    const found = await findFiles(root, { patterns: TMP });
    expect(names(found)).toEqual(['p/PPT9999.tmp', 'p/ppt0001.tmp', 'w/~WRL1234.TMP', 'w/~wra0001.tmp']);
  });

  it('vim swap: .swn .swo .swp at the end of the name', async () => {
    await touch('v/.notes.txt.swp');
    await touch('v/.notes.txt.swo');
    await touch('v/.notes.txt.swn');
    await touch('v/.notes.txt.swx');
    await touch('v/swap');
    await touch('v/.htpasswd');
    const found = await findFiles(root, { patterns: VIM_SWAP_USER });
    expect(names(found)).toEqual(['v/.notes.txt.swn', 'v/.notes.txt.swo', 'v/.notes.txt.swp']);
  });

  it('.DS_Store and Thumbs.db match the whole name only', async () => {
    await touch('m/.DS_Store');
    await touch('m/x.DS_Store');
    await touch('t/Thumbs.db');
    await touch('t2/thumbs.DB'); // Windows names are case-insensitive
    await touch('t/Thumbs.db.old');
    expect(names(await findFiles(root, { patterns: DS_STORE }))).toEqual(['m/.DS_Store']);
    expect(names(await findFiles(root, { patterns: THUMBS_DB }))).toEqual(['t/Thumbs.db', 't2/thumbs.DB']);
  });

  it('matches the file name, not the folder path', async () => {
    await touch('old.bak/inside.txt');
    expect(names(await findFiles(root, { patterns: BACKUP }))).toEqual([]);
  });

  it('descends into every subfolder, including node_modules and .git (BleachBit does not skip them)', async () => {
    await touch('proj/node_modules/pkg/index.js.bak');
    await touch('proj/.git/hooks/pre-commit.bak');
    const found = await findFiles(root, { patterns: BACKUP });
    expect(names(found)).toEqual(['proj/.git/hooks/pre-commit.bak', 'proj/node_modules/pkg/index.js.bak']);
  });

  it('reports size and modified time for each match', async () => {
    await touch('a/notes.bak', '12345');
    const [file] = (await findFiles(root, { patterns: BACKUP })).files;
    expect(file.sizeBytes).toBe(5);
    expect(file.mtimeMs).toBeGreaterThan(0);
  });
});

describe('what the walk will not do', () => {
  it('does not follow a directory link out of the tree', async () => {
    await writeFile(join(outside, 'secret.bak'), 'x');
    // A junction needs no admin rights on Windows, unlike a symlink.
    await symlink(outside, join(root, 'escape'), 'junction');
    await touch('real/kept.bak');
    const found = await findFiles(root, { patterns: BACKUP });
    expect(names(found)).toEqual(['real/kept.bak']);
    expect(existsSync(join(outside, 'secret.bak'))).toBe(true);
  });

  it('skips excluded folders, and never enters them', async () => {
    await touch('keep/a.bak');
    await touch('mine/b.bak');
    const found = await findFiles(root, { patterns: BACKUP, excludeFolders: [join(root, 'mine')] });
    expect(names(found)).toEqual(['keep/a.bak']);
  });

  it("skips Prune's own folders, wherever they are", async () => {
    await touch('prune-data/batch/x.bak');
    await touch('elsewhere/y.bak');
    const found = await findFiles(root, { patterns: BACKUP, skipDirs: [join(root, 'prune-data')] });
    expect(names(found)).toEqual(['elsewhere/y.bak']);
  });

  it('never enters the real quarantine root, even when walking the folder that holds it', async () => {
    const holder = join(root, 'holder');
    await mkdir(holder, { recursive: true });
    process.env.UNREVO_QUARANTINE_ROOT = join(holder, 'q-root');
    await touch('holder/q-root/batch/q.bak');
    await touch('holder/other.bak');
    const found = await findFiles(root, { patterns: BACKUP });
    expect(names(found)).toEqual(['holder/other.bak']);
  });

  it('survives a folder that is not there', async () => {
    const found = await findFiles(join(root, 'does-not-exist'), { patterns: BACKUP });
    expect(found.files).toEqual([]);
    expect(found.rootReadable).toBe(false);
  });
});

describe('caps', () => {
  it('stops at the entry cap and says it did, keeping what it found', async () => {
    for (let i = 0; i < 20; i++) await touch(`f${i}.bak`);
    const found = await findFiles(root, { patterns: BACKUP, limits: { maxEntries: 5 } });
    expect(found.truncated).toBe('entries');
    expect(found.files.length).toBeGreaterThan(0);
    expect(found.files.length).toBeLessThan(20);
  });

  it('stops at the match cap', async () => {
    for (let i = 0; i < 10; i++) await touch(`f${i}.bak`);
    const found = await findFiles(root, { patterns: BACKUP, limits: { maxMatches: 3 } });
    expect(found.truncated).toBe('matches');
    expect(found.files).toHaveLength(3);
  });

  it('stops at the depth cap without going deeper', async () => {
    await touch('a/b/c/d/deep.bak');
    await touch('a/shallow.bak');
    const found = await findFiles(root, { patterns: BACKUP, limits: { maxDepth: 2 } });
    expect(names(found)).toEqual(['a/shallow.bak']);
    expect(found.truncated).toBe('depth');
  });

  it('stops at the time cap', async () => {
    for (let i = 0; i < 20; i++) await touch(`d${i}/f.bak`);
    const found = await findFiles(root, { patterns: BACKUP, limits: { maxMs: -1 } });
    expect(found.truncated).toBe('time');
  });

  it('reports a complete walk as not truncated', async () => {
    await touch('a.bak');
    expect((await findFiles(root, { patterns: BACKUP })).truncated).toBeNull();
  });

  it('stops promptly when aborted, and says so', async () => {
    for (let i = 0; i < 30; i++) await touch(`d${i}/f.bak`);
    const controller = new AbortController();
    controller.abort();
    const found = await findFiles(root, { patterns: BACKUP, signal: controller.signal });
    expect(found.truncated).toBe('aborted');
  });

  it('reports progress while it walks', async () => {
    for (let i = 0; i < 5; i++) await touch(`d${i}/f.bak`);
    const seen = [];
    await findFiles(root, { patterns: BACKUP, onProgress: (p) => seen.push(p), progressEveryMs: 0 });
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.at(-1).dirs).toBeGreaterThanOrEqual(5);
    expect(seen.at(-1).matches).toBeGreaterThan(0);
  });
});

describe('scan and execute', () => {
  const action = () => ({ expandedRoot: root, patterns: BACKUP });

  it('measures what a clean would take, and touches nothing', async () => {
    const a = await touch('a/one.bak', '12345');
    await touch('a/two.bak', '1234567890');
    const result = await scan(action(), {});
    expect(result.sizeBytes).toBe(15);
    expect(result.fileCount).toBe(2);
    expect(existsSync(a)).toBe(true);
  });

  it('holds back recent files, like every other rule', async () => {
    await touch('a/fresh.bak', 'x', 1);
    await touch('a/old.bak', 'x', 100);
    const result = await scan(action(), { skipRecentHours: 24 });
    expect(result.fileCount).toBe(1);
    expect(result.heldCount).toBe(1);
  });

  it('flags an incomplete scan instead of presenting it as complete', async () => {
    for (let i = 0; i < 10; i++) await touch(`f${i}.bak`);
    const result = await scan(action(), { limits: { maxEntries: 3 } });
    expect(result.incomplete).toBe('entries');
  });

  it('execute in Quarantine mode moves the matches and reports them as moved', async () => {
    const file = await touch('a/one.bak', '12345');
    const result = await execute(action(), 'Backup files', {});
    expect(existsSync(file)).toBe(false);
    expect(result.quarantineBatch).toBeTruthy();
    expect(readdirSync(quarantine).length).toBeGreaterThan(0);
  });

  it("execute in 'delete' mode deletes outright", async () => {
    const file = await touch('a/one.bak', '12345');
    const result = await execute(action(), 'Backup files', { removal: 'delete' });
    expect(existsSync(file)).toBe(false);
    expect(result.freedBytes).toBe(5);
    expect(result.quarantineBatch).toBeUndefined();
    expect(readdirSync(quarantine)).toEqual([]);
  });

  it('execute honours the exclusions it is given', async () => {
    const file = await touch('mine/one.bak', '12345');
    const result = await execute(action(), 'Backup files', { removal: 'delete', excludeFolders: [join(root, 'mine')] });
    expect(existsSync(file)).toBe(true);
    expect(result.freedBytes).toBe(0);
  });

  it('execute deletes nothing when already aborted', async () => {
    const file = await touch('a/one.bak', '12345');
    const controller = new AbortController();
    controller.abort();
    const result = await execute(action(), 'Backup files', { removal: 'delete', signal: controller.signal });
    expect(existsSync(file)).toBe(true);
    expect(result.freedBytes).toBe(0);
  });
});
