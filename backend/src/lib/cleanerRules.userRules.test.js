import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCleanerRules, scanRule, executeRule } from './cleanerRules.js';
import { saveImported, importedDir } from './userRules.js';
import { importBleachBitXml } from './bleachbitImport.js';

/** The user's own rules inside the real rule engine: listed with Prune's,
 * scanned and cleaned by the same code, under every guard. All in a temp
 * folder; the settings and the imported-cleaners folder are redirected there
 * and nothing outside it is touched. */

let root;
let work;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'prune-userrules-engine-'));
  work = join(root, 'work');
  mkdirSync(work, { recursive: true });
  process.env.UNREVO_SETTINGS_PATH = join(root, 'settings.json');
  process.env.UNREVO_QUARANTINE_ROOT = join(root, 'quarantine');
  delete process.env.UNREVO_CLEANERS_PATH;
});
afterEach(() => {
  delete process.env.UNREVO_SETTINGS_PATH;
  delete process.env.UNREVO_QUARANTINE_ROOT;
  delete process.env.UNREVO_CLEANERS_PATH;
  rmSync(root, { recursive: true, force: true });
});

const settings = (extra = {}) => writeFileSync(join(root, 'settings.json'), JSON.stringify({ skipRecentHours: 0, ...extra }));
const ids = () => loadCleanerRules().map((r) => r.id);

describe('loadCleanerRules', () => {
  it('lists Prune\'s rules and nothing of the user\'s when there are none', () => {
    settings();
    expect(ids()).not.toContain('custom_locations');
    expect(ids().length).toBeGreaterThan(50);
  });

  it('adds the Custom locations rule last, once there are locations', () => {
    settings({ customLocations: [work] });
    const rules = loadCleanerRules();
    expect(rules.at(-1).id).toBe('custom_locations');
    expect(rules.filter((r) => r.id === 'custom_locations')).toHaveLength(1);
  });

  it('adds imported cleaners', async () => {
    settings();
    const { cleaner, report } = importBleachBitXml(`<cleaner id="demo"><label>Demo</label>
      <option id="cache"><label>Cache</label><action command="delete" search="walk.all" path="${work}"/></option></cleaner>`);
    await saveImported(cleaner, report, { dir: importedDir(), source: 'demo.xml' });
    expect(ids()).toContain('imp_demo_cache');
    expect(loadCleanerRules().find((r) => r.id === 'imp_demo_cache').imported).toBe(true);
  });

  it('is only the override file when UNREVO_CLEANERS_PATH is set', () => {
    settings({ customLocations: [work] });
    const file = join(root, 'only.json');
    writeFileSync(file, JSON.stringify([{ id: 'x', category: 'C', name: 'X', paths: [work] }]));
    process.env.UNREVO_CLEANERS_PATH = file;
    expect(ids()).toEqual(['x']);
  });

  it('never repeats an id', async () => {
    settings({ customLocations: [work] });
    const all = ids();
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('the custom rule, scanned and cleaned', () => {
  it('is measured like any rule, and lists its files', () => {
    writeFileSync(join(work, 'a.tmp'), 'x'.repeat(10));
    settings({ customLocations: [work] });
    const rule = loadCleanerRules().find((r) => r.id === 'custom_locations');
    const result = scanRule(rule, {});
    expect(result).toMatchObject({ fileCount: 1, sizeBytes: 10, filesListed: true });
    expect(result.files).toEqual([{ path: join(work, 'a.tmp'), sizeBytes: 10 }]);
  });

  it('is cleaned through the same removal modes: Quarantine by default', async () => {
    writeFileSync(join(work, 'a.tmp'), 'x'.repeat(10));
    settings({ customLocations: [work] });
    const rule = loadCleanerRules().find((r) => r.id === 'custom_locations');
    const result = await executeRule(rule, { removal: 'quarantine' });
    expect(result.movedBytes).toBe(10);
    expect(existsSync(join(work, 'a.tmp'))).toBe(false);
    expect(existsSync(join(root, 'quarantine'))).toBe(true);
  });

  it('and permanently in Delete now mode', async () => {
    writeFileSync(join(work, 'a.tmp'), 'x'.repeat(10));
    settings({ customLocations: [work] });
    const rule = loadCleanerRules().find((r) => r.id === 'custom_locations');
    const result = await executeRule(rule, { removal: 'delete' });
    expect(result.freedBytes).toBe(10);
    expect(existsSync(join(work, 'a.tmp'))).toBe(false);
  });

  it('honours the user\'s exclusions: a custom location cannot override them', async () => {
    mkdirSync(join(work, 'keep'));
    writeFileSync(join(work, 'keep', 'k.dat'), 'k');
    writeFileSync(join(work, 'a.tmp'), 'a');
    settings({ customLocations: [work] });
    const rule = loadCleanerRules().find((r) => r.id === 'custom_locations');
    const guards = { removal: 'delete', excludeFolders: [join(work, 'keep')] };
    expect(scanRule(rule, guards)).toMatchObject({ fileCount: 1, heldCount: 1 });
    await executeRule(rule, guards);
    expect(existsSync(join(work, 'keep', 'k.dat'))).toBe(true);
    expect(existsSync(join(work, 'a.tmp'))).toBe(false);
  });

  it('honours the recent-files guard', async () => {
    writeFileSync(join(work, 'fresh.tmp'), 'f');
    settings({ customLocations: [work] });
    const rule = loadCleanerRules().find((r) => r.id === 'custom_locations');
    await executeRule(rule, { removal: 'delete', skipRecentHours: 24 });
    expect(existsSync(join(work, 'fresh.tmp'))).toBe(true);
  });

  it('keeps out of the protected places even if one is saved by hand-editing the file', () => {
    // C:\Windows\Fonts is only ever LISTED here (scan), never touched.
    settings({ customLocations: [join(process.env.SystemRoot || 'C:\\Windows', 'Fonts', '*.ttf')] });
    const rule = loadCleanerRules().find((r) => r.id === 'custom_locations');
    expect(rule).toBeUndefined(); // refused at load: the location was never accepted
  });
});

describe('an imported cleaner, scanned and cleaned', () => {
  it('takes only what search=file names, not a folder of the same name', async () => {
    mkdirSync(join(work, 'Data'));
    writeFileSync(join(work, 'Data', 'inside.dat'), 'precious');
    writeFileSync(join(work, 'Data.tmp'), 'tmp');
    settings();
    const { cleaner, report } = importBleachBitXml(`<cleaner id="demo"><label>Demo</label>
      <option id="files"><label>Files</label><action command="delete" search="glob" path="${work}\\Data*"/></option></cleaner>`);
    await saveImported(cleaner, report, { dir: importedDir() });
    const rule = loadCleanerRules().find((r) => r.id === 'imp_demo_files');
    await executeRule(rule, { removal: 'delete' });
    expect(existsSync(join(work, 'Data.tmp'))).toBe(false);
    expect(existsSync(join(work, 'Data', 'inside.dat'))).toBe(true);
  });

  it('cannot reach into a protected place however the cleaner is written', async () => {
    settings();
    const fonts = join(process.env.SystemRoot || 'C:\\Windows', 'Fonts');
    const { cleaner, report } = importBleachBitXml(`<cleaner id="evil"><label>Evil</label>
      <option id="x"><label>X</label><action command="delete" search="walk.all" path="${fonts}"/></option></cleaner>`);
    await saveImported(cleaner, report, { dir: importedDir() });
    const rule = loadCleanerRules().find((r) => r.id === 'imp_evil_x');
    // Preview only: the point is that nothing is offered for removal.
    const result = scanRule(rule, {});
    expect(result.fileCount).toBe(0);
    expect(result.heldCount).toBeGreaterThan(0);
  });
});
