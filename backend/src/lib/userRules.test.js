import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveImported, removeImported, listImported, loadUserRules } from './userRules.js';
import { importBleachBitXml } from './bleachbitImport.js';

/** Where imported cleaners live (a folder under userData, one JSON file each)
 * and how the user's rules -- custom locations and imported cleaners -- are
 * read back for Deep Clean. Everything in a temp folder. */

let root;
let dir;
let settingsFile;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'prune-userrules-'));
  dir = join(root, 'imported-cleaners');
  settingsFile = join(root, 'settings.json');
});
afterEach(async () => { await rm(root, { recursive: true, force: true }); });

const demo = (id = 'demo', optionId = 'cache') => importBleachBitXml(
  `<cleaner id="${id}"><label>Demo ${id}</label><option id="${optionId}"><label>Cache</label>
     <action command="delete" search="walk.all" path="%AppData%\\Demo\\Cache"/>
     <action command="winreg" path="HKCU\\Software\\Demo"/></option></cleaner>`
);

describe('saving and listing imported cleaners', () => {
  it('stores each as one JSON file named for its id, and lists it with its report', async () => {
    const { cleaner, report } = demo();
    await saveImported(cleaner, report, { dir, source: 'demo.xml', now: 1700000000000 });
    expect(await readdir(dir)).toEqual(['demo.json']);
    const [entry] = listImported({ dir });
    expect(entry).toMatchObject({ id: 'demo', label: 'Demo demo', source: 'demo.xml', importedAt: 1700000000000, ruleCount: 1 });
    expect(entry.report.skipped).toEqual([{ kind: 'command', detail: 'winreg', count: 1 }]);
  });

  it('importing the same cleaner again replaces it', async () => {
    const { cleaner, report } = demo();
    await saveImported(cleaner, report, { dir, source: 'a.xml' });
    await saveImported(cleaner, report, { dir, source: 'b.xml' });
    expect(listImported({ dir })).toHaveLength(1);
    expect(listImported({ dir })[0].source).toBe('b.xml');
  });

  it('lists nothing when the folder does not exist', () => {
    expect(listImported({ dir })).toEqual([]);
  });

  it('skips a file that is not valid JSON or not a stored cleaner', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'broken.json'), '{ nope');
    await writeFile(join(dir, 'odd.json'), JSON.stringify({ hello: 1 }));
    await writeFile(join(dir, 'notes.txt'), 'ignored');
    expect(listImported({ dir })).toEqual([]);
  });
});

describe('removing', () => {
  it('removes one imported cleaner and says so', async () => {
    const { cleaner, report } = demo();
    await saveImported(cleaner, report, { dir, source: 'd.xml' });
    expect(await removeImported('demo', { dir })).toBe(true);
    expect(listImported({ dir })).toEqual([]);
    expect(await removeImported('demo', { dir })).toBe(false);
  });

  it('refuses an id that could name another file', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(root, 'settings.json'), '{}');
    for (const bad of ['..\\settings', '../settings', 'a/b', '', 'x.json', 'C:\\Windows\\win', null, 5]) {
      expect(await removeImported(bad, { dir }), String(bad)).toBe(false);
    }
    expect(await readdir(root)).toContain('settings.json');
  });
});

describe('loadUserRules', () => {
  it('is empty when there is nothing', () => {
    expect(loadUserRules({ settingsFile, dir })).toEqual([]);
  });

  it('gives the custom-locations rule first, then every imported rule', async () => {
    await writeFile(settingsFile, JSON.stringify({ customLocations: ['D:\\Scratch', 'nonsense', 'C:\\Windows'] }));
    const { cleaner, report } = demo();
    await saveImported(cleaner, report, { dir, source: 'd.xml' });
    const rules = loadUserRules({ settingsFile, dir });
    expect(rules.map((r) => r.id)).toEqual(['custom_locations', 'imp_demo_cache']);
    // Only the valid location survived the load.
    expect(rules[0].actions[0].paths).toEqual(['D:\\Scratch']);
  });

  it('is robust to a missing or corrupt settings file', async () => {
    await writeFile(settingsFile, '{ not json');
    expect(loadUserRules({ settingsFile, dir })).toEqual([]);
    expect(loadUserRules({ settingsFile: join(root, 'nope.json'), dir })).toEqual([]);
  });

  it('does not trust a stored file: only delete actions, always userDefined, never ticked by default', async () => {
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, 'evil.json'), JSON.stringify({
      id: 'evil', label: 'Evil', rules: [
        {
          id: 'imp_evil_x', category: 'Evil', name: 'X', recommended: true, is_safe: true, confirmEveryTime: false,
          actions: [
            { type: 'delete', paths: ['D:\\a'], userDefined: false },
            { type: 'shell', command: 'format c:' },
            { type: 'winreg', key: 'HKCU\\Software' },
            { type: 'delete', paths: [5, null, 'D:\\b'] }
          ]
        },
        { id: 'builtin_cache', category: 'Evil', name: 'Shadows a built-in id', actions: [{ type: 'delete', paths: ['D:\\c'] }] },
        { id: 'imp_evil_noactions', category: 'Evil', name: 'No actions', actions: [{ type: 'shell', command: 'x' }] }
      ]
    }));
    const rules = loadUserRules({ settingsFile, dir });
    expect(rules.map((r) => r.id)).toEqual(['imp_evil_x']);
    const [rule] = rules;
    expect(rule.recommended).toBe(false);
    expect(rule.is_safe).toBe(false);
    expect(rule.imported).toBe(true);
    expect(rule.actions.every((a) => a.type === 'delete' && a.userDefined === true)).toBe(true);
    expect(rule.actions.flatMap((a) => a.paths)).toEqual(['D:\\a', 'D:\\b']);
  });
});
