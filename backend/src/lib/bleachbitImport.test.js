import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { importBleachBitXml, ImportError, MAX_XML_BYTES } from './bleachbitImport.js';

/** Importing a BleachBit cleaner file.
 *
 * Only `delete` actions are brought over -- and only the ones whose meaning
 * Prune can reproduce exactly. Everything else is skipped AND COUNTED, so the
 * person is told what they did not get: a cleaner that silently lost half its
 * options would look like it worked. Nothing in the file is ever executed. */

const xml = (body, attrs = 'id="demo"') => `<?xml version="1.0"?>\n<cleaner ${attrs}>\n<label>Demo app</label>\n<description>A demo</description>\n${body}\n</cleaner>`;

describe('what is imported', () => {
  it('turns a delete option into a rule, with the label as its name and the cleaner as its category', () => {
    const { cleaner, report } = importBleachBitXml(xml(`
      <option id="cache"><label>Cache</label><description>Cached pages</description>
        <action command="delete" search="walk.all" path="%LocalAppData%\\Demo\\Cache"/>
      </option>`));
    expect(cleaner.id).toBe('demo');
    expect(cleaner.label).toBe('Demo app');
    expect(cleaner.rules).toHaveLength(1);
    const rule = cleaner.rules[0];
    expect(rule).toMatchObject({
      id: 'imp_demo_cache', category: 'Demo app', name: 'Cache', description: 'Cached pages',
      recommended: false, is_safe: false, imported: true, importedFrom: 'demo'
    });
    expect(rule.actions).toEqual([{ type: 'delete', paths: ['%LocalAppData%\\Demo\\Cache'], userDefined: true }]);
    expect(report.options).toEqual({ total: 1, imported: 1, skipped: 0 });
    expect(report.actions).toEqual({ total: 1, imported: 1, skipped: 0 });
    expect(report.skipped).toEqual([]);
  });

  it('is never ticked by default and never marked safe: an imported rule was not curated here', () => {
    const { cleaner } = importBleachBitXml(xml('<option id="a"><label>A</label><action command="delete" search="file" path="%Temp%\\x.tmp"/></option>'));
    expect(cleaner.rules[0].recommended).toBe(false);
    expect(cleaner.rules[0].is_safe).toBe(false);
  });

  it('marks every delete action userDefined, so the protected places are kept out of', () => {
    const { cleaner } = importBleachBitXml(xml('<option id="a"><label>A</label><action command="delete" search="walk.all" path="~/stuff"/></option>'));
    for (const action of cleaner.rules[0].actions) expect(action.userDefined).toBe(true);
  });
});

describe('search types', () => {
  const importOne = (search) => importBleachBitXml(xml(
    `<option id="a"><label>A</label><action command="delete" search="${search}" path="%AppData%\\Demo\\x"/></option>`
  ));

  it('file and glob take files only', () => {
    expect(importOne('file').cleaner.rules[0].actions[0].filesOnly).toBe(true);
    expect(importOne('glob').cleaner.rules[0].actions[0].filesOnly).toBe(true);
  });

  it('walk.files and walk.all take everything under the path', () => {
    expect(importOne('walk.files').cleaner.rules[0].actions[0].filesOnly).toBeUndefined();
    expect(importOne('walk.all').cleaner.rules[0].actions[0].filesOnly).toBeUndefined();
  });

  it('walk.top and deep are not supported, and counted as such', () => {
    const { cleaner, report } = importOne('walk.top');
    expect(cleaner.rules).toEqual([]);
    expect(report.actions).toEqual({ total: 1, imported: 0, skipped: 1 });
    expect(report.options).toEqual({ total: 1, imported: 0, skipped: 1 });
    expect(report.skipped).toEqual([{ kind: 'search', detail: 'walk.top', count: 1 }]);
    expect(importOne('deep').report.skipped).toEqual([{ kind: 'search', detail: 'deep', count: 1 }]);
  });

  it('groups actions of the same kind into one delete action and keeps the two kinds apart', () => {
    const { cleaner } = importBleachBitXml(xml(`<option id="a"><label>A</label>
      <action command="delete" search="walk.all" path="%AppData%\\D\\one"/>
      <action command="delete" search="file" path="%AppData%\\D\\f1"/>
      <action command="delete" search="walk.all" path="%AppData%\\D\\two"/>
      <action command="delete" search="file" path="%AppData%\\D\\f2"/>
    </option>`));
    const actions = cleaner.rules[0].actions;
    expect(actions).toHaveLength(2);
    expect(actions.find((a) => a.filesOnly).paths).toEqual(['%AppData%\\D\\f1', '%AppData%\\D\\f2']);
    expect(actions.find((a) => !a.filesOnly).paths).toEqual(['%AppData%\\D\\one', '%AppData%\\D\\two']);
  });
});

describe('what is skipped, and counted', () => {
  it('counts each unsupported command, by name', () => {
    const { cleaner, report } = importBleachBitXml(xml(`
      <option id="a"><label>A</label>
        <action command="delete" search="file" path="%AppData%\\D\\x"/>
        <action command="winreg" path="HKCU\\Software\\D"/>
        <action command="winreg" path="HKCU\\Software\\E"/>
        <action command="sqlite.vacuum" search="file" path="%AppData%\\D\\db"/>
        <action command="shred" search="file" path="%AppData%\\D\\y"/>
      </option>`));
    expect(cleaner.rules).toHaveLength(1);
    expect(report.actions).toEqual({ total: 5, imported: 1, skipped: 4 });
    expect(report.options).toEqual({ total: 1, imported: 1, skipped: 0 });
    expect(report.skipped).toEqual(expect.arrayContaining([
      { kind: 'command', detail: 'winreg', count: 2 },
      { kind: 'command', detail: 'sqlite.vacuum', count: 1 },
      { kind: 'command', detail: 'shred', count: 1 }
    ]));
  });

  it('an option with nothing importable is skipped as a whole', () => {
    const { cleaner, report } = importBleachBitXml(xml(`
      <option id="vacuum"><label>Vacuum</label><action command="sqlite.vacuum" search="file" path="%AppData%\\D\\db"/></option>
      <option id="cache"><label>Cache</label><action command="delete" search="file" path="%AppData%\\D\\c"/></option>`));
    expect(cleaner.rules.map((r) => r.id)).toEqual(['imp_demo_cache']);
    expect(report.options).toEqual({ total: 2, imported: 1, skipped: 1 });
  });

  it('skips an action that filters by regular expression, because ignoring the filter would delete more than the cleaner meant', () => {
    const { cleaner, report } = importBleachBitXml(xml(`<option id="a"><label>A</label>
      <action command="delete" search="walk.files" path="%AppData%\\D" regex="\\.log$"/>
      <action command="delete" search="walk.files" path="%AppData%\\D" nregex="keep"/>
      <action command="delete" search="walk.all" path="%AppData%\\D" wholeregex=".*x"/>
      <action command="delete" search="walk.all" path="%AppData%\\D" nwholeregex=".*y"/>
    </option>`));
    expect(cleaner.rules).toEqual([]);
    expect(report.skipped).toEqual([{ kind: 'filter', detail: 'regex', count: 4 }]);
  });

  it('skips actions for other operating systems', () => {
    const { report } = importBleachBitXml(xml(`<option id="a"><label>A</label>
      <action command="delete" search="file" path="~/.config/x" os="linux"/>
      <action command="delete" search="file" path="%AppData%\\x" os="windows"/>
    </option>`));
    expect(report.actions).toEqual({ total: 2, imported: 1, skipped: 1 });
    expect(report.skipped).toEqual([{ kind: 'os', detail: 'linux', count: 1 }]);
  });

  it('a cleaner for another operating system imports nothing, and says so', () => {
    const { cleaner, report } = importBleachBitXml(xml(
      '<option id="a"><label>A</label><action command="delete" search="file" path="~/.config/x"/><action command="delete" search="file" path="~/.cache/y"/></option>',
      'id="linuxonly" os="linux"'
    ));
    expect(cleaner.rules).toEqual([]);
    expect(report.options).toEqual({ total: 1, imported: 0, skipped: 1 });
    expect(report.actions).toEqual({ total: 2, imported: 0, skipped: 2 });
    expect(report.skipped).toEqual([{ kind: 'os', detail: 'linux', count: 2 }]);
  });

  it('skips a path that uses a variable it cannot resolve', () => {
    const { report } = importBleachBitXml(xml(`<option id="a"><label>A</label>
      <action command="delete" search="file" path="$$nope$$/x"/>
      <action command="delete" search="file" path="%MadeUp%\\x"/>
    </option>`));
    expect(report.skipped).toEqual(expect.arrayContaining([
      { kind: 'variable', detail: '$$nope$$', count: 1 },
      { kind: 'variable', detail: '%MadeUp%', count: 1 }
    ]));
  });

  it.each([
    ['a relative path', 'relative\\dir\\x'],
    ['a path that climbs', '%AppData%\\..\\..\\Windows'],
    ['no path at all', '']
  ])('skips %s', (_name, path) => {
    const { cleaner, report } = importBleachBitXml(xml(`<option id="a"><label>A</label><action command="delete" search="file" path="${path}"/></option>`));
    expect(cleaner.rules).toEqual([]);
    expect(report.skipped).toEqual([{ kind: 'path', detail: '', count: 1 }]);
  });

  it('skips a wildcard sitting too near the top of the drive', () => {
    const { report } = importBleachBitXml(xml(`<option id="a"><label>A</label>
      <action command="delete" search="walk.all" path="C:\\*"/>
      <action command="delete" search="walk.all" path="C:\\Users\\*"/>
    </option>`));
    expect(report.skipped).toEqual([{ kind: 'path', detail: '', count: 2 }]);
  });
});

describe('variables', () => {
  it('substitutes $$name$$ from the cleaner\'s own var, using the Windows value only', () => {
    const { cleaner } = importBleachBitXml(xml(`
      <var name="base"><value os="windows">%UserProfile%\\AppData\\Roaming\\Slack</value><value os="linux">~/.config/Slack</value></var>
      <option id="c"><label>C</label><action command="delete" search="walk.all" path="$$base$$/Cache"/></option>`));
    expect(cleaner.rules[0].actions[0].paths).toEqual(['%UserProfile%\\AppData\\Roaming\\Slack\\Cache']);
  });

  it('a variable with several Windows values yields a path for each', () => {
    const { cleaner } = importBleachBitXml(xml(`
      <var name="ie"><value>%UserProfile%\\Local Settings</value><value>%UserProfile%\\Ustawienia lokalne</value></var>
      <option id="c"><label>C</label><action command="delete" search="walk.files" path="$$ie$$\\Temp"/></option>`));
    expect(cleaner.rules[0].actions[0].paths).toEqual(['%UserProfile%\\Local Settings\\Temp', '%UserProfile%\\Ustawienia lokalne\\Temp']);
  });

  it('a variable may use another, and a loop is an unresolvable variable rather than a hang', () => {
    const { cleaner, report } = importBleachBitXml(xml(`
      <var name="a"><value>%AppData%\\$$b$$</value></var>
      <var name="b"><value>Deep</value></var>
      <var name="x"><value>$$y$$</value></var>
      <var name="y"><value>$$x$$</value></var>
      <option id="ok"><label>OK</label><action command="delete" search="file" path="$$a$$\\f"/></option>
      <option id="loop"><label>Loop</label><action command="delete" search="file" path="$$x$$\\f"/></option>`));
    expect(cleaner.rules.map((r) => r.id)).toEqual(['imp_demo_ok']);
    expect(cleaner.rules[0].actions[0].paths).toEqual(['%AppData%\\Deep\\f']);
    expect(report.skipped).toEqual([{ kind: 'variable', detail: '$$x$$', count: 1 }]);
  });

  it('forward slashes become backslashes, and ~ is kept for Prune to expand', () => {
    const { cleaner } = importBleachBitXml(xml('<option id="c"><label>C</label><action command="delete" search="walk.all" path="~/a/b/"/></option>'));
    expect(cleaner.rules[0].actions[0].paths).toEqual(['~\\a\\b']);
  });

  it('knows the Windows variables BleachBit uses', () => {
    const vars = ['%LocalAppData%', '%AppData%', '%UserProfile%', '%Temp%', '%WinDir%', '%ProgramFiles%', '%CommonAppData%', '%LocalAppDataLow%', '%WindowsSystem%'];
    for (const v of vars) {
      const { cleaner } = importBleachBitXml(xml(`<option id="c"><label>C</label><action command="delete" search="file" path="${v}\\Demo\\f"/></option>`));
      expect(cleaner.rules, v).toHaveLength(1);
    }
  });
});

describe('options', () => {
  it('turns a <warning> into the rule being marked as losing data, and keeps the warning in its description', () => {
    const { cleaner } = importBleachBitXml(xml(`<option id="p"><label>Passwords</label><description>Saved logins</description>
      <warning>This option will delete your saved passwords.</warning>
      <action command="delete" search="file" path="%AppData%\\D\\Login Data"/></option>`));
    expect(cleaner.rules[0].risky).toBe(true);
    expect(cleaner.rules[0].description).toContain('Saved logins');
    expect(cleaner.rules[0].description).toContain('This option will delete your saved passwords.');
  });

  it('falls back to the ids when labels are missing, and sanitises ids into safe rule ids', () => {
    const { cleaner } = importBleachBitXml('<cleaner id="My App!"><option id="Cache Files"><action command="delete" search="file" path="%AppData%\\x"/></option></cleaner>');
    expect(cleaner.id).toBe('my_app');
    expect(cleaner.label).toBe('My App!');
    expect(cleaner.rules[0].id).toBe('imp_my_app_cache_files');
    expect(cleaner.rules[0].name).toBe('Cache Files');
  });
});

describe('refusals', () => {
  const refused = (text, code) => {
    try {
      importBleachBitXml(text);
    } catch (err) {
      expect(err).toBeInstanceOf(ImportError);
      expect(err.code).toBe(code);
      return;
    }
    throw new Error('should have been refused');
  };

  it('a file over the size limit', () => {
    refused(`<cleaner id="big">${' '.repeat(MAX_XML_BYTES)}</cleaner>`, 'tooLarge');
  });

  it('something that is not XML', () => refused('{"json": true}', 'notXml'));
  it('XML that is not a cleaner', () => refused('<html><body/></html>', 'notCleaner'));
  it('a cleaner with no id', () => refused('<cleaner><option id="a"/></cleaner>', 'noId'));
  it('an XML bomb', () => {
    refused('<!DOCTYPE c [<!ENTITY a "aaaa"><!ENTITY b "&a;&a;&a;&a;">]><cleaner id="x">&b;</cleaner>', 'notXml');
  });
  it('too many actions', () => {
    const actions = '<action command="delete" search="file" path="%AppData%\\x"/>'.repeat(5001);
    refused(xml(`<option id="a"><label>A</label>${actions}</option>`), 'tooLarge');
  });
});

describe('does not execute anything', () => {
  it('treats a command that looks like a shell command as just an unsupported command name', () => {
    const { cleaner, report } = importBleachBitXml(xml(`<option id="a"><label>A</label>
      <action command="process" path="powershell -c calc"/>
      <action command="delete&amp;calc" search="file" path="%AppData%\\x"/>
    </option>`));
    expect(cleaner.rules).toEqual([]);
    expect(report.skipped.map((s) => s.kind)).toEqual(['command', 'command']);
  });
});

/* The real thing: every cleaner BleachBit ships on this machine. Read only.
 * Skipped where BleachBit is not installed. */
const REAL_DIR = join(process.env.LOCALAPPDATA || '', 'BleachBit', 'share', 'cleaners');
describe.skipIf(!process.env.LOCALAPPDATA || !existsSync(REAL_DIR))('BleachBit\'s own cleaners', () => {
  const files = existsSync(REAL_DIR) ? readdirSync(REAL_DIR).filter((f) => f.endsWith('.xml')) : [];

  it('every one imports or is refused cleanly, and its report adds up', () => {
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const { cleaner, report } = importBleachBitXml(readFileSync(join(REAL_DIR, file), 'utf8'), { fileName: file });
      expect(report.actions.imported + report.actions.skipped, file).toBe(report.actions.total);
      expect(report.options.imported + report.options.skipped, file).toBe(report.options.total);
      expect(report.options.imported, file).toBe(cleaner.rules.length);
      expect(report.skipped.reduce((sum, s) => sum + s.count, 0), file).toBe(report.actions.skipped);
      for (const rule of cleaner.rules) {
        expect(rule.imported).toBe(true);
        for (const action of rule.actions) {
          expect(action.userDefined).toBe(true);
          for (const p of action.paths) {
            expect(p, `${file} ${rule.id}`).toMatch(/^([A-Za-z]:|%|~)/);
            expect(p).not.toContain('..');
            expect(p).not.toMatch(/\$\$/);
          }
        }
      }
    }
  });

  it('slack.xml imports its delete options and skips only the vacuum', () => {
    const { cleaner, report } = importBleachBitXml(readFileSync(join(REAL_DIR, 'slack.xml'), 'utf8'));
    expect(cleaner.rules.map((r) => r.id)).toEqual(['imp_slack_cache', 'imp_slack_cookies', 'imp_slack_history']);
    expect(report.options).toEqual({ total: 4, imported: 3, skipped: 1 });
    expect(report.actions).toEqual({ total: 15, imported: 11, skipped: 4 });
    expect(report.skipped).toEqual([{ kind: 'command', detail: 'sqlite.vacuum', count: 4 }]);
    const cache = cleaner.rules[0].actions;
    expect(cache.find((a) => !a.filesOnly).paths).toEqual([
      '%UserProfile%\\AppData\\Roaming\\Slack\\Cache',
      '%UserProfile%\\AppData\\Roaming\\Slack\\Code Cache',
      '%UserProfile%\\AppData\\Roaming\\Slack\\GPUCache'
    ]);
    expect(cache.find((a) => a.filesOnly).paths).toEqual(['%UserProfile%\\AppData\\Roaming\\Slack\\Network Persistent State']);
  });

  it('a Linux-only cleaner imports nothing', () => {
    const linuxOnly = files.find((f) => /os="linux"/.test(readFileSync(join(REAL_DIR, f), 'utf8').match(/<cleaner[^>]*>/)?.[0] ?? ''));
    if (!linuxOnly) return;
    expect(importBleachBitXml(readFileSync(join(REAL_DIR, linuxOnly), 'utf8')).cleaner.rules).toEqual([]);
  });

  it('firefox.xml: the profile folder wildcard survives', () => {
    const { cleaner } = importBleachBitXml(readFileSync(join(REAL_DIR, 'firefox.xml'), 'utf8'));
    const allPaths = cleaner.rules.flatMap((r) => r.actions.flatMap((a) => a.paths));
    expect(allPaths.some((p) => p.includes('\\Mozilla\\Firefox\\Profiles\\*\\'))).toBe(true);
  });
});
