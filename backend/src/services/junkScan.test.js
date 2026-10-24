import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, utimes, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  scanJunkFiles, removeJunkFiles, prepareRoots, junkContext, pathRefusal, usableFootprints
} from './junkScan.js';
import { defaultJunkPatterns } from '../lib/junkPatterns.js';

/** Every test builds a real tree in a temp folder, with a stand-in Windows
 * and Program Files INSIDE it (passed as the environment), and removes only
 * inside it. */

let root;
let env;
const saved = {};

const touch = async (rel, body = 'x', ageHours = 100) => {
  const full = join(root, rel);
  await mkdir(join(full, '..'), { recursive: true });
  await writeFile(full, body);
  const when = new Date(Date.now() - ageHours * 3600_000);
  await utimes(full, when, when);
  return full;
};

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-junk-'));
  env = {
    SystemDrive: 'C:',
    SystemRoot: join(root, 'Windows'),
    ProgramFiles: join(root, 'Program Files'),
    'ProgramFiles(x86)': join(root, 'Program Files (x86)')
  };
  for (const key of ['UNREVO_QUARANTINE_ROOT', 'UNREVO_SETTINGS_PATH']) saved[key] = process.env[key];
  process.env.UNREVO_QUARANTINE_ROOT = join(root, 'PruneData', 'Quarantine');
  process.env.UNREVO_SETTINGS_PATH = join(root, 'PruneData', 'settings.json');
});
afterEach(async () => {
  for (const [key, value] of Object.entries(saved)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
  await rm(root, { recursive: true, force: true });
});

const GUARDS = { skipRecentHours: 24, excludeFolders: [], excludeExtensions: [] };

async function scan(options = {}) {
  const files = [];
  const batches = [];
  const summary = await scanJunkFiles({
    roots: [root],
    patterns: defaultJunkPatterns(),
    guards: GUARDS,
    env,
    onFiles: (batch) => { batches.push(batch.length); files.push(...batch); },
    ...options
  });
  const rel = files.map((f) => f.path.slice(root.length + 1).replace(/\\/g, '/')).sort();
  return { files, rel, summary, batches };
}

describe('scanJunkFiles: what it finds', () => {
  it('finds the enabled default patterns anywhere under the root, with size, date and pattern', async () => {
    await touch('a.tmp', 'aaaa');
    await touch('deep/er/b.TEMP');
    await touch('docs/~$report.docx');
    await touch('src/unit1.~pas');
    await touch('cfg/hosts.old');
    await touch('help/app.gid');
    await touch('crash/app.dmp');
    await touch('pics/Thumbs.db');
    await touch('keep/notes.txt');
    await touch('keep/backup.bak'); // listed, but off
    await touch('keep/app.log'); // listed, but off

    const { files, rel, summary } = await scan();
    expect(rel).toEqual([
      'a.tmp', 'cfg/hosts.old', 'crash/app.dmp', 'deep/er/b.TEMP', 'docs/~$report.docx',
      'help/app.gid', 'pics/Thumbs.db', 'src/unit1.~pas'
    ]);
    const a = files.find((f) => f.path.endsWith('a.tmp'));
    expect(a).toMatchObject({ sizeBytes: 4, pattern: '*.tmp' });
    expect(a.mtimeMs).toBeLessThan(Date.now() - 99 * 3600_000);
    expect(summary).toMatchObject({ offered: 8, truncated: null });
    expect(summary.offeredBytes).toBe(4 + 7);
  });

  it('looks for nothing when no pattern is turned on', async () => {
    await touch('a.tmp');
    const { files, summary } = await scan({ patterns: [{ pattern: '*.tmp', enabled: false }] });
    expect(files).toEqual([]);
    expect(summary.offered).toBe(0);
  });

  it('does not take a .chk that is not a Check Disk fragment at a drive root', async () => {
    await touch('FOUND.000/FILE0000.CHK');
    await touch('game/save.chk');
    const { files } = await scan();
    expect(files).toEqual([]);
  });

  it('sends results in batches as it goes, not all at the end', async () => {
    for (let i = 0; i < 450; i++) await touch(`many/d${i % 9}/f${i}.tmp`);
    const { files, batches } = await scan();
    expect(files).toHaveLength(450);
    expect(batches.length).toBeGreaterThan(1);
    expect(Math.max(...batches)).toBeLessThanOrEqual(200);
  });
});

describe('scanJunkFiles: what it refuses, and counts', () => {
  it('leaves files modified within the recent window alone, and offers them when the window is 0', async () => {
    await touch('old.tmp', 'x', 100);
    await touch('new.tmp', 'x', 1);
    let result = await scan();
    expect(result.rel).toEqual(['old.tmp']);
    expect(result.summary.skipped.recent).toBe(1);

    result = await scan({ guards: { ...GUARDS, skipRecentHours: 0 } });
    expect(result.rel).toEqual(['new.tmp', 'old.tmp']);
  });

  it('honours excluded folders (not even entered) and excluded file types', async () => {
    await touch('mine/a.tmp');
    await touch('mine/deeper/b.tmp');
    await touch('other/c.tmp');
    await touch('other/d.dmp');
    const { rel, summary } = await scan({
      guards: { ...GUARDS, excludeFolders: [join(root, 'mine')], excludeExtensions: ['.dmp'] }
    });
    expect(rel).toEqual(['other/c.tmp']);
    expect(summary.skipped.excludedFolders).toBe(1);
    expect(summary.skipped.excluded).toBe(1);
  });

  it('never offers anything inside Windows, Program Files or Prune\'s own data, and never walks into them', async () => {
    await touch('Windows/Temp/w.tmp');
    await touch('Program Files/App/p.tmp');
    await touch('Program Files (x86)/App/p86.tmp');
    await touch('PruneData/Quarantine/batch/q.tmp');
    await touch('PruneData/s.tmp');
    await touch('fine.tmp');
    const { rel, summary } = await scan();
    expect(rel).toEqual(['fine.tmp']);
    expect(summary.skipped.protectedFolders).toBe(4);
  });

  it('never offers the cleaner\'s protected system folders, rollback folders or Windows components by name', async () => {
    await touch('System Volume Information/s.tmp');
    await touch('$Recycle.Bin/S-1/r.tmp');
    await touch('Windows.old/x/o.tmp');
    await touch('$WINDOWS.~BT/b.tmp');
    await touch('AppData/Local/Microsoft/Office/m.tmp');
    await touch('Tools/WinSxS/x.tmp');
    await touch('Vendor/quarantine/v.tmp');
    await touch('fine.tmp');
    const { rel, summary } = await scan();
    expect(rel).toEqual(['fine.tmp']);
    expect(summary.skipped.protectedFolders).toBeGreaterThanOrEqual(7);
  });

  it('never offers a file inside another installed program\'s folder', async () => {
    await touch('Games/SomeGame/cache.tmp');
    await touch('Games/loose.tmp');
    const { rel, summary } = await scan({ footprints: [{ dir: join(root, 'Games', 'SomeGame'), program: 'Some Game' }] });
    expect(rel).toEqual(['Games/loose.tmp']);
    expect(summary.skipped.protectedFolders).toBe(1);
  });

  it('never offers a program, library or desktop.ini, whatever pattern reached it', async () => {
    await touch('dl/~setup.exe');
    await touch('dl/~helper.DLL');
    await touch('dl/~$report.docx');
    const { rel, summary } = await scan();
    expect(rel).toEqual(['dl/~$report.docx']);
    expect(summary.skipped.executable).toBe(2);
  });
});

describe('scanJunkFiles: limits and Stop', () => {
  it('says a capped scan is partial, keeping what it found', async () => {
    for (let i = 0; i < 30; i++) await touch(`c/f${i}.tmp`);
    const { files, summary } = await scan({ limits: { maxMatches: 10 } });
    expect(summary.truncated).toBe('matches');
    expect(files.length).toBe(10);
  });

  it('stops when the signal fires, and says so', async () => {
    for (let i = 0; i < 50; i++) await touch(`s/d${i}/f.tmp`);
    const controller = new AbortController();
    controller.abort();
    const { summary } = await scan({ signal: controller.signal });
    expect(summary.truncated).toBe('aborted');
  });

  it('shares one budget across several roots', async () => {
    for (let i = 0; i < 8; i++) await touch(`r1/f${i}.tmp`);
    for (let i = 0; i < 8; i++) await touch(`r2/f${i}.tmp`);
    const { files, summary } = await scan({ roots: [join(root, 'r1'), join(root, 'r2')], limits: { maxMatches: 12 } });
    expect(files.length).toBe(12);
    expect(summary.truncated).toBe('matches');
  });
});

describe('prepareRoots', () => {
  it('tidies drives and folders, drops roots inside other roots, and refuses what cannot be scanned', async () => {
    await mkdir(join(root, 'a', 'b'), { recursive: true });
    await mkdir(join(root, 'Windows'), { recursive: true });
    await writeFile(join(root, 'file.txt'), 'x');
    const ctx = junkContext({ env });
    const out = await prepareRoots([
      `${join(root, 'a')}\\`, join(root, 'a', 'b'), 'relative\\path', `${root}\\..\\x`,
      join(root, 'missing'), join(root, 'file.txt'), join(root, 'Windows'), '', 7
    ], ctx);
    expect(out.roots).toEqual([join(root, 'a')]);
    expect(out.refused).toEqual([
      { path: 'relative\\path', reason: 'relative' },
      { path: `${root}\\..\\x`, reason: 'climb' },
      { path: join(root, 'missing'), reason: 'missing' },
      { path: join(root, 'file.txt'), reason: 'missing' },
      { path: join(root, 'Windows'), reason: 'protected' }
    ]);
  });

  it('writes a drive as its root, and keeps it over folders on it', async () => {
    const drive = root.slice(0, 2).toLowerCase();
    const out = await prepareRoots([root, drive], junkContext({ env }));
    expect(out.roots).toEqual([`${drive.toUpperCase()}\\`]);
  });
});

describe('usableFootprints', () => {
  it('ignores a program that claims a drive, the profile or AppData as its folder', () => {
    const fpEnv = { USERPROFILE: 'C:\\Users\\jim', APPDATA: 'C:\\Users\\jim\\AppData\\Roaming', LOCALAPPDATA: 'C:\\Users\\jim\\AppData\\Local', ProgramData: 'C:\\ProgramData', SystemDrive: 'C:' };
    const kept = usableFootprints([
      { dir: 'C:\\', program: 'a' }, { dir: 'D:\\', program: 'b' }, { dir: 'C:\\Users\\jim', program: 'c' },
      { dir: 'C:\\Users\\jim\\Documents', program: 'd' }, { dir: 'C:\\Users\\jim\\AppData\\Local', program: 'e' },
      { dir: 'C:\\Users\\jim\\AppData\\Local\\Programs', program: 'f' }, { dir: 'C:\\ProgramData', program: 'g' },
      { dir: 'C:\\Users', program: 'h' }, { dir: 'C:\\Users\\other', program: 'i' }, { dir: 'relative', program: 'j' },
      { dir: 'D:\\Games\\Real', program: 'keep1' }, { dir: 'C:\\Users\\jim\\AppData\\Local\\Programs\\Tool', program: 'keep2' }
    ], fpEnv);
    expect(kept.map((k) => k.program)).toEqual(['keep1', 'keep2']);
  });
});

describe('pathRefusal', () => {
  it('names the rule that refused, protected before excluded', () => {
    const ctx = junkContext({ env, guards: { excludeFolders: [join(root, 'Windows')] } });
    expect(pathRefusal(join(root, 'Windows', 'x.tmp'), ctx)).toMatchObject({ kind: 'protected', code: 'windows' });
    expect(pathRefusal(join(root, 'Program Files', 'x.tmp'), ctx)).toMatchObject({ kind: 'protected', code: 'programs' });
    expect(pathRefusal(join(root, 'fine', 'x.tmp'), ctx)).toBeNull();
  });
});

describe('removeJunkFiles', () => {
  const remove = (paths, guards = {}) => removeJunkFiles(paths, {
    patterns: defaultJunkPatterns(), guards: { ...GUARDS, removal: 'quarantine', autoQuarantine: true, ...guards }, env
  });

  it('moves what still qualifies into Quarantine as one batch', async () => {
    const a = await touch('a.tmp', 'aaaa');
    const b = await touch('deep/b.gid', 'bb');
    const result = await remove([a, b]);
    expect(existsSync(a)).toBe(false);
    expect(existsSync(b)).toBe(false);
    expect(result).toMatchObject({ freedBytes: 0, movedBytes: 6, removedCount: 2 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].quarantineBatch).toBeTruthy();
    const batches = await readdir(process.env.UNREVO_QUARANTINE_ROOT);
    expect(batches).toHaveLength(1);
  });

  it('deletes outright when Settings says Delete now', async () => {
    const a = await touch('a.tmp', 'aaaa');
    const result = await remove([a], { removal: 'delete' });
    expect(existsSync(a)).toBe(false);
    expect(result).toMatchObject({ freedBytes: 4, movedBytes: 0, removedCount: 1 });
    expect(result.results[0].quarantineBatch).toBeUndefined();
  });

  it('judges every path again and leaves alone what no longer qualifies, saying why', async () => {
    const recent = await touch('new.tmp', 'x', 1);
    const notJunk = await touch('notes.txt');
    const offPattern = await touch('old.bak');
    const program = await touch('~setup.exe');
    const inWindows = await touch('Windows/w.tmp');
    const good = await touch('good.tmp');
    const result = await remove([recent, notJunk, offPattern, program, inWindows, join(root, 'gone.tmp'), 'relative.tmp', good, good]);

    expect(existsSync(good)).toBe(false);
    for (const kept of [recent, notJunk, offPattern, program, inWindows]) expect(existsSync(kept), kept).toBe(true);
    expect(result.removedCount).toBe(1);
    const reasons = Object.fromEntries(result.results[0].skipped.map((s) => [s.path, s.reason]));
    expect(reasons[recent]).toMatch(/recently/);
    expect(reasons[notJunk]).toMatch(/junk pattern/);
    expect(reasons[offPattern]).toMatch(/junk pattern/);
    expect(reasons[program]).toMatch(/program or system file/);
    expect(reasons[inWindows]).toMatch(/protected/);
    expect(reasons[join(root, 'gone.tmp')]).toMatch(/no longer there/);
    expect(reasons['relative.tmp']).toMatch(/full path/);
  });

  it('removes nothing, and moves nothing into Quarantine, when nothing qualifies', async () => {
    const notJunk = await touch('notes.txt');
    const result = await remove([notJunk]);
    expect(result).toMatchObject({ freedBytes: 0, movedBytes: 0, removedCount: 0 });
    expect(existsSync(process.env.UNREVO_QUARANTINE_ROOT)).toBe(false);
  });
});
