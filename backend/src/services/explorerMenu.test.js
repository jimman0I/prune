import { describe, it, expect, vi } from 'vitest';
import {
  ENTRIES, commandFor, parseCommand, createExplorerMenu
} from './explorerMenu.js';
import { CAPTIONS } from './explorerMenuCaptions.js';

/** "Add Prune to the right-click menu" writes shell verbs under
 * HKCU\Software\Classes. They run a program from a menu, which is exactly what
 * malware likes to hook, so what is held still here is how small and how honest
 * it is: written only by an explicit switch, only for the running packaged
 * Prune.exe, nothing in the command but the quoted path, one fixed flag and
 * "%1"; read back from the registry rather than remembered; removed completely,
 * including the empty keys it made; and never deleting a key it did not write.
 * Nothing here touches the real registry: every test hands the service a fake
 * reg.exe over an in-memory tree. */

const EXE = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe';
const SHRED_CMD = `"${EXE}" --shred "%1"`;
const FIND_CMD = `"${EXE}" --find-program "%1"`;
const CLASSES = 'HKCU\\Software\\Classes';

const KEYS = {
  shredFiles: `${CLASSES}\\*\\shell\\PruneShred`,
  shredFolders: `${CLASSES}\\Directory\\shell\\PruneShred`,
  findExe: `${CLASSES}\\exefile\\shell\\PruneFindProgram`,
  findLnk: `${CLASSES}\\lnkfile\\shell\\PruneFindProgram`
};

/** A fake registry behind a fake reg.exe: query / add / delete over a tree. */
function fakeRegistry({ keys = {}, failOn: initialFail = null } = {}) {
  let failOn = initialFail;
  // lower-cased path -> { path, values: Map(lower name -> { name, type, data }) }
  const tree = new Map();
  const norm = (p) => p.toLowerCase();
  const ensure = (path) => {
    const parts = path.split('\\');
    for (let i = 1; i <= parts.length; i += 1) {
      const sub = parts.slice(0, i).join('\\');
      if (!tree.has(norm(sub))) tree.set(norm(sub), { path: sub, values: new Map() });
    }
    return tree.get(norm(path));
  };
  const setValue = (path, name, data, type = 'REG_SZ') => ensure(path).values.set(norm(name), { name, type, data });
  for (const [path, values] of Object.entries(keys)) {
    ensure(path);
    for (const [name, data] of Object.entries(values)) setValue(path, name, data);
  }

  const calls = [];
  const notFound = () => Object.assign(new Error('Command failed: reg\nERROR: The system was unable to find the specified registry key or value.'), { code: 1, stdout: '', stderr: 'ERROR: not found' });
  const row = (v) => `    ${v.name}    ${v.type}    ${v.data}`;
  const children = (path) => [...tree.values()].filter((k) => norm(k.path).startsWith(`${norm(path)}\\`) && !k.path.slice(path.length + 1).includes('\\'));

  const exec = vi.fn(async (file, args, options) => {
    calls.push({ file, args, options });
    if (failOn && failOn(args)) throw Object.assign(new Error('Command failed: reg\nERROR: Access is denied.'), { code: 1, stdout: '', stderr: 'ERROR: Access is denied.' });
    const [verb, key] = args;
    if (verb === 'query') {
      const node = tree.get(norm(key));
      if (!node) throw notFound();
      let shown = [...node.values.values()];
      if (args[2] === '/ve') {
        const def = node.values.get('(default)');
        shown = [def ?? { name: '(Default)', type: 'REG_SZ', data: '(value not set)' }];
      } else if (args[2] === '/v') {
        shown = shown.filter((v) => norm(v.name) === norm(args[3]));
        if (shown.length === 0) throw notFound();
      }
      const subs = args[2] ? [] : children(key).map((k) => k.path);
      return { stdout: `\r\n${node.path}\r\n${[...shown.map(row), ...subs].join('\r\n')}\r\n\r\n`, stderr: '' };
    }
    if (verb === 'add') {
      const isDefault = args[2] === '/ve';
      setValue(key, isDefault ? '(Default)' : args[3], args[args.indexOf('/d') + 1]);
      return { stdout: 'The operation completed successfully.', stderr: '' };
    }
    if (verb === 'delete') {
      if (!tree.has(norm(key))) throw notFound();
      for (const k of [...tree.keys()]) if (k === norm(key) || k.startsWith(`${norm(key)}\\`)) tree.delete(k);
      return { stdout: 'The operation completed successfully.', stderr: '' };
    }
    throw new Error(`unexpected reg verb ${verb}`);
  });

  const has = (path) => tree.has(norm(path));
  const value = (path, name = '(Default)') => tree.get(norm(path))?.values.get(norm(name))?.data;
  const writes = () => calls.filter((c) => c.args[0] !== 'query');
  const paths = () => [...tree.values()].map((k) => k.path);
  return { exec, calls, has, value, writes, paths, set: setValue, ensure, failWhen: (fn) => { failOn = fn; } };
}

/** The four verbs as Prune writes them. */
const installed = (over = {}) => {
  const exe = over.exe ?? EXE;
  const shred = over.shredCaption ?? CAPTIONS.en.shred;
  const find = over.findCaption ?? CAPTIONS.en.find;
  const reg = fakeRegistry();
  for (const [key, cmd, caption] of [
    [KEYS.shredFiles, `"${exe}" --shred "%1"`, shred],
    [KEYS.shredFolders, `"${exe}" --shred "%1"`, shred],
    [KEYS.findExe, `"${exe}" --find-program "%1"`, find],
    [KEYS.findLnk, `"${exe}" --find-program "%1"`, find]
  ]) {
    reg.set(key, '(Default)', caption);
    reg.set(key, 'Icon', `"${exe}",0`);
    reg.set(`${key}\\command`, '(Default)', cmd);
  }
  return reg;
};

const make = (registry, over = {}) => createExplorerMenu({
  exec: registry.exec, execPath: EXE, platform: 'win32', systemRoot: 'C:\\Windows', language: async () => 'en', ...over
});

const OFF = { supported: true, enabled: false, incomplete: false, stale: false, foreign: false, captions: CAPTIONS.en };
const ON = { ...OFF, enabled: true };

describe('the entries and the command', () => {
  it('are four per-user shell verbs under HKCU\\Software\\Classes, two flags, nothing else', () => {
    expect(ENTRIES.map((e) => [e.key, e.flag, e.caption])).toEqual([
      [KEYS.shredFiles, '--shred', 'shred'],
      [KEYS.shredFolders, '--shred', 'shred'],
      [KEYS.findExe, '--find-program', 'find'],
      [KEYS.findLnk, '--find-program', 'find']
    ]);
    for (const entry of ENTRIES) expect(entry.key.startsWith('HKCU\\Software\\Classes\\')).toBe(true);
  });

  it('the command is the quoted exe path, one fixed flag and "%1"', () => {
    expect(commandFor(EXE, '--shred')).toBe(SHRED_CMD);
    expect(commandFor(EXE, '--find-program')).toBe(FIND_CMD);
    expect(() => commandFor(EXE, '--evil')).toThrow(/flag/);
  });

  it('reads back exactly what it writes, for the flag it should have', () => {
    expect(parseCommand(SHRED_CMD, '--shred')).toEqual({ exe: EXE });
    expect(parseCommand(FIND_CMD, '--find-program')).toEqual({ exe: EXE });
    expect(parseCommand(`  ${SHRED_CMD}  `, '--shred')).toEqual({ exe: EXE });
  });

  it('refuses anything else in the command: the other flag, extra arguments, two programs, a shell', () => {
    expect(parseCommand(SHRED_CMD, '--find-program')).toBeNull();
    expect(parseCommand(FIND_CMD, '--shred')).toBeNull();
    for (const data of [
      `${SHRED_CMD} --delete-everything`, `"${EXE}" --shred %1`, `"${EXE}" --shred "%1" & calc.exe`, `${EXE} --shred "%1"`,
      `"${EXE}" --shred "%1" "%1"`, `"C:\\a\\x.exe" --shred "%1"`, `cmd /c "${EXE}" --shred "%1"`, `"${EXE}" --shred "%*"`,
      `"C:\\Tools\\mystery.exe" "%1"`, '', null, undefined, '(value not set)'
    ]) {
      expect(parseCommand(data, '--shred'), String(data)).toBeNull();
    }
  });
});

describe('status: the switch reads the real registry', () => {
  it('is off when none of the keys exist, and says nothing is wrong', async () => {
    expect(await make(fakeRegistry()).status()).toEqual(OFF);
  });

  it('is on, complete, when all four verbs are Prune\'s', async () => {
    expect(await make(installed()).status()).toEqual(ON);
  });

  it('is on but incomplete when some verbs are missing', async () => {
    const reg = installed();
    await reg.exec('reg.exe', ['delete', KEYS.findLnk, '/f']);
    expect(await make(reg).status()).toEqual({ ...ON, incomplete: true });
  });

  it('matches the exe path case-insensitively', async () => {
    const status = await make(installed({ exe: EXE.toUpperCase() })).status();
    expect(status).toMatchObject({ enabled: true, stale: false });
  });

  it('is on but stale when the verbs point at another Prune.exe (the install moved)', async () => {
    const status = await make(installed({ exe: 'D:\\Old\\Prune\\Prune.exe' })).status();
    expect(status).toMatchObject({ enabled: true, stale: true });
  });

  it('is foreign, and off, when a verb with Prune\'s name runs something else', async () => {
    for (const data of ['"C:\\Tools\\mystery.exe" "%1"', `${SHRED_CMD} --extra`, 'cmd /c calc']) {
      const reg = fakeRegistry();
      reg.set(KEYS.shredFiles, '(Default)', 'Shred');
      reg.set(`${KEYS.shredFiles}\\command`, '(Default)', data);
      expect(await make(reg).status(), data).toMatchObject({ enabled: false, foreign: true });
    }
  });

  it('reads each verb with an argv array and no shell, by reg.exe\'s full path', async () => {
    const reg = installed();
    await make(reg).status();
    const query = reg.calls.find((c) => c.args[1] === `${KEYS.shredFiles}\\command`);
    expect(query.file).toBe('C:\\Windows\\System32\\reg.exe');
    expect(query.args).toEqual(['query', `${KEYS.shredFiles}\\command`, '/ve']);
    expect(query.options.shell).toBeUndefined();
    expect(reg.writes()).toEqual([]);
  });

  it('carries the captions in the app\'s language, English for one it does not know', async () => {
    expect((await make(fakeRegistry(), { language: async () => 'el' }).status()).captions).toEqual(CAPTIONS.el);
    expect((await make(fakeRegistry(), { language: async () => 'xx' }).status()).captions).toEqual(CAPTIONS.en);
    expect((await make(fakeRegistry(), { language: async () => { throw new Error('no settings'); } }).status()).captions).toEqual(CAPTIONS.en);
  });

  it('is unsupported, and touches nothing, in a development build, off Windows, or for another exe', async () => {
    for (const over of [
      { execPath: 'C:\\dev\\electron\\dist\\electron.exe' },
      { platform: 'linux' },
      { execPath: 'C:\\x\\notprune.exe' }
    ]) {
      const reg = fakeRegistry();
      expect(await make(reg, over).status()).toMatchObject({ supported: false, reason: 'notPackaged', enabled: false });
      expect(reg.calls).toEqual([]);
    }
  });

  it('is unsupported, with its own reason, when the path could not be put in a command safely', async () => {
    for (const execPath of ['C:\\50%\\Prune.exe', 'C:\\a"b\\Prune.exe', `C:\\${'x'.repeat(500)}\\Prune.exe`, 'C:\\a\tb\\Prune.exe']) {
      const reg = fakeRegistry();
      expect(await make(reg, { execPath }).status(), execPath.slice(0, 20)).toMatchObject({ supported: false, reason: 'unsafePath' });
      await expect(make(reg, { execPath }).set({ enabled: true })).rejects.toMatchObject({ unsupported: true });
      expect(reg.calls).toEqual([]);
    }
  });

  it('a registry that cannot be read is an error, not a silent "off"', async () => {
    const reg = fakeRegistry();
    reg.exec.mockRejectedValueOnce(Object.assign(new Error('reg.exe timed out'), { code: 'ETIMEDOUT' }));
    await expect(make(reg).status()).rejects.toThrow(/timed out/);
  });
});

describe('set: turning it on', () => {
  it('writes four verbs: the caption, the icon and the command, with reg.exe, argv arrays and no shell', async () => {
    const reg = fakeRegistry();
    const status = await make(reg).set({ enabled: true });
    expect(status).toEqual(ON);
    expect(reg.writes()).toHaveLength(12);
    for (const call of reg.writes()) {
      expect(call.file).toBe('C:\\Windows\\System32\\reg.exe');
      expect(call.options.shell).toBeUndefined();
      expect(Array.isArray(call.args)).toBe(true);
      expect(call.args[0]).toBe('add');
      expect(call.args).toContain('/f');
    }
    expect(reg.value(KEYS.shredFiles)).toBe('Shred with Prune');
    expect(reg.value(KEYS.shredFolders)).toBe('Shred with Prune');
    expect(reg.value(KEYS.findExe)).toBe('Find in Prune (uninstall)');
    expect(reg.value(KEYS.findLnk)).toBe('Find in Prune (uninstall)');
    expect(reg.value(KEYS.shredFiles, 'Icon')).toBe(`"${EXE}",0`);
    expect(reg.value(`${KEYS.shredFiles}\\command`)).toBe(SHRED_CMD);
    expect(reg.value(`${KEYS.shredFolders}\\command`)).toBe(SHRED_CMD);
    expect(reg.value(`${KEYS.findExe}\\command`)).toBe(FIND_CMD);
    expect(reg.value(`${KEYS.findLnk}\\command`)).toBe(FIND_CMD);
  });

  it('the exact argv of the command write', async () => {
    const reg = fakeRegistry();
    await make(reg).set({ enabled: true });
    const write = reg.writes().find((c) => c.args[1] === `${KEYS.findExe}\\command`);
    expect(write.args).toEqual(['add', `${KEYS.findExe}\\command`, '/ve', '/t', 'REG_SZ', '/d', FIND_CMD, '/f']);
  });

  it('writes the command last, so a write that stops half-way leaves nothing that could run', async () => {
    const reg = fakeRegistry();
    await make(reg).set({ enabled: true });
    for (const entry of ENTRIES) {
      const mine = reg.writes().filter((c) => c.args[1].startsWith(entry.key));
      expect(mine[mine.length - 1].args[1]).toBe(`${entry.key}\\command`);
    }
  });

  it('uses the captions of the app\'s language', async () => {
    const reg = fakeRegistry();
    await make(reg, { language: async () => 'de' }).set({ enabled: true });
    expect(reg.value(KEYS.shredFiles)).toBe('Mit Prune schreddern');
    expect(reg.value(KEYS.findLnk)).toBe('In Prune suchen (deinstallieren)');
  });

  it('writes nothing when it is already exactly that', async () => {
    const reg = installed();
    await make(reg).set({ enabled: true });
    expect(reg.writes()).toEqual([]);
  });

  it('completes a partial set without touching the verbs already right', async () => {
    const reg = installed();
    await reg.exec('reg.exe', ['delete', KEYS.findLnk, '/f']);
    const before = reg.writes().length;
    const status = await make(reg).set({ enabled: true });
    expect(status).toEqual(ON);
    const mine = reg.writes().slice(before);
    expect(mine).toHaveLength(3);
    expect(mine.every((c) => c.args[1].startsWith(KEYS.findLnk))).toBe(true);
  });

  it('puts a stale path back to the current exe', async () => {
    const reg = installed({ exe: 'D:\\Old\\Prune\\Prune.exe' });
    const status = await make(reg).set({ enabled: true });
    expect(status).toEqual(ON);
    expect(reg.value(`${KEYS.shredFiles}\\command`)).toBe(SHRED_CMD);
  });

  it('rewrites the captions when the language changed', async () => {
    const reg = installed();
    await make(reg, { language: async () => 'fr' }).set({ enabled: true });
    expect(reg.value(KEYS.shredFolders)).toBe('Détruire avec Prune');
    expect(reg.value(`${KEYS.shredFolders}\\command`)).toBe(SHRED_CMD);
  });

  it('replaces a foreign verb that only shares the name', async () => {
    const reg = fakeRegistry();
    reg.set(KEYS.shredFiles, '(Default)', 'Mystery');
    reg.set(`${KEYS.shredFiles}\\command`, '(Default)', '"C:\\Tools\\mystery.exe" "%1"');
    const status = await make(reg).set({ enabled: true });
    expect(status.foreign).toBe(false);
    expect(reg.value(`${KEYS.shredFiles}\\command`)).toBe(SHRED_CMD);
  });

  it('writes only the exe it is running, whatever the path holds', async () => {
    const odd = 'C:\\Users\\O\'Brien & Sons (x86)\\Prune.exe';
    const reg = fakeRegistry();
    await make(reg, { execPath: odd }).set({ enabled: true });
    expect(reg.value(`${KEYS.shredFiles}\\command`)).toBe(`"${odd}" --shred "%1"`);
    for (const call of reg.writes()) expect(call.options.shell).toBeUndefined();
  });

  it('reports a write Windows refused, and leaves none of the half-made verbs behind', async () => {
    const reg = fakeRegistry({ failOn: (args) => args[0] === 'add' && args[1] === `${KEYS.findExe}\\command` });
    await expect(make(reg).set({ enabled: true })).rejects.toThrow(/Access is denied/);
    for (const key of Object.values(KEYS)) expect(reg.has(key), key).toBe(false);
    expect(reg.paths().filter((p) => /\\shell/i.test(p))).toEqual([]);
  });

  it('a refusal does not remove verbs that were Prune\'s before the attempt', async () => {
    const reg = installed({ exe: 'D:\\Old\\Prune\\Prune.exe' });
    reg.failWhen((args) => args[0] === 'add' && args[1] === `${KEYS.findExe}\\command`);
    await expect(make(reg).set({ enabled: true })).rejects.toThrow(/Access is denied/);
    for (const key of Object.values(KEYS)) expect(reg.has(key), key).toBe(true);
    expect(reg.value(`${KEYS.findExe}\\command`)).toBe('"D:\\Old\\Prune\\Prune.exe" --find-program "%1"');
  });
});

describe('set: turning it off', () => {
  it('deletes the four keys and the empty keys it made, and nothing else', async () => {
    const reg = installed();
    reg.ensure('HKCU\\Software\\Classes\\txtfile');
    const status = await make(reg).set({ enabled: false });
    expect(status).toEqual(OFF);
    expect(reg.paths().filter((p) => /\\(\*|directory|exefile|lnkfile)(\\|$)/i.test(p))).toEqual([]);
    expect(reg.has('HKCU\\Software\\Classes\\txtfile')).toBe(true);
    expect(reg.has('HKCU\\Software\\Classes')).toBe(true);
    const deleted = reg.writes().map((c) => c.args[1]);
    const allowed = new Set(ENTRIES.flatMap((e) => {
      const parts = e.key.split('\\');
      return [e.key, parts.slice(0, -1).join('\\'), parts.slice(0, -2).join('\\')];
    }));
    for (const key of deleted) expect(allowed.has(key), key).toBe(true);
    for (const call of reg.writes()) { expect(call.args[0]).toBe('delete'); expect(call.args).toContain('/f'); }
  });

  it('leaves other programs\' verbs, and the keys that hold them, alone', async () => {
    const reg = installed();
    reg.set(`${CLASSES}\\Directory\\shell\\OtherTool`, '(Default)', 'Other tool');
    reg.set(`${CLASSES}\\Directory\\shell\\OtherTool\\command`, '(Default)', '"C:\\x\\x.exe" "%1"');
    reg.set(`${CLASSES}\\exefile`, '(Default)', 'Application');
    await make(reg).set({ enabled: false });
    expect(reg.has(`${CLASSES}\\Directory\\shell\\OtherTool\\command`)).toBe(true);
    expect(reg.has(`${CLASSES}\\Directory\\shell`)).toBe(true);
    expect(reg.has(`${CLASSES}\\exefile`)).toBe(true);
    expect(reg.has(`${CLASSES}\\exefile\\shell`)).toBe(false);
    expect(reg.has(KEYS.shredFolders)).toBe(false);
  });

  it('writes nothing when it was never on', async () => {
    const reg = fakeRegistry();
    await make(reg).set({ enabled: false });
    expect(reg.writes()).toEqual([]);
  });

  it('removes a stale set too: it is still Prune\'s own', async () => {
    const reg = installed({ exe: 'D:\\Old\\Prune\\Prune.exe' });
    await make(reg).set({ enabled: false });
    for (const key of Object.values(KEYS)) expect(reg.has(key)).toBe(false);
  });

  it('removes a half-written verb (a caption and no command), which can run nothing', async () => {
    const reg = fakeRegistry();
    reg.set(KEYS.findExe, '(Default)', 'Find in Prune (uninstall)');
    await make(reg).set({ enabled: false });
    expect(reg.has(KEYS.findExe)).toBe(false);
  });

  it('leaves a verb it did not write alone', async () => {
    const reg = installed();
    reg.set(`${KEYS.shredFiles}\\command`, '(Default)', '"C:\\Tools\\mystery.exe" "%1"');
    await make(reg).set({ enabled: false });
    expect(reg.has(KEYS.shredFiles)).toBe(true);
    expect(reg.value(`${KEYS.shredFiles}\\command`)).toBe('"C:\\Tools\\mystery.exe" "%1"');
    expect(reg.has(KEYS.shredFolders)).toBe(false);
  });

  it('on, off, on, off ends where it began: no key of its own is left', async () => {
    const reg = fakeRegistry();
    const service = make(reg);
    for (const enabled of [true, false, true, false]) await service.set({ enabled });
    expect(reg.paths().filter((p) => /\\Classes\\./.test(p))).toEqual([]);
  });
});

describe('set: what it refuses', () => {
  it('refuses, and touches nothing, where it is unsupported', async () => {
    for (const over of [{ execPath: 'C:\\dev\\electron.exe' }, { platform: 'darwin' }]) {
      const reg = fakeRegistry();
      await expect(make(reg, over).set({ enabled: true })).rejects.toMatchObject({ unsupported: true });
      await expect(make(reg, over).set({ enabled: false })).rejects.toMatchObject({ unsupported: true });
      expect(reg.calls).toEqual([]);
    }
  });

  it('only real booleans are accepted', async () => {
    const reg = fakeRegistry();
    for (const bad of [{ enabled: 'true' }, { enabled: 1 }, { enabled: null }, {}, null, undefined]) {
      await expect(make(reg).set(bad), JSON.stringify(bad)).rejects.toThrow(/true or false/);
    }
    expect(reg.calls).toEqual([]);
  });

  it('two changes at once are applied one after the other', async () => {
    const reg = fakeRegistry();
    const service = make(reg);
    await Promise.all([service.set({ enabled: true }), service.set({ enabled: false }), service.set({ enabled: true })]);
    expect(reg.has(KEYS.shredFiles)).toBe(true);
    expect(reg.value(`${KEYS.shredFiles}\\command`)).toBe(SHRED_CMD);
  });
});

describe('repair: an update into another folder, or another language', () => {
  it('re-points stale verbs, and only those', async () => {
    const reg = installed({ exe: 'D:\\Old\\Prune\\Prune.exe' });
    expect(await make(reg).repair()).toEqual({ action: 'updated' });
    expect(reg.value(`${KEYS.findLnk}\\command`)).toBe(FIND_CMD);
    expect(await make(reg).repair()).toEqual({ action: 'none' });
  });

  it('rewrites the captions when the language changed', async () => {
    const reg = installed();
    expect(await make(reg, { language: async () => 'es' }).repair()).toEqual({ action: 'updated' });
    expect(reg.value(KEYS.shredFiles)).toBe('Triturar con Prune');
  });

  it('does nothing when it is all as it should be', async () => {
    const reg = installed();
    expect(await make(reg).repair()).toEqual({ action: 'none' });
    expect(reg.writes()).toEqual([]);
  });

  it('never creates a verb, never touches a foreign one, and does nothing when unsupported', async () => {
    const none = fakeRegistry();
    expect(await make(none).repair()).toEqual({ action: 'none' });
    const foreign = fakeRegistry();
    foreign.set(KEYS.shredFiles, '(Default)', 'Mystery');
    foreign.set(`${KEYS.shredFiles}\\command`, '(Default)', '"C:\\Tools\\mystery.exe" "%1"');
    expect(await make(foreign).repair()).toEqual({ action: 'none' });
    const partial = installed({ exe: 'D:\\Old\\Prune\\Prune.exe' });
    await partial.exec('reg.exe', ['delete', KEYS.findLnk, '/f']);
    await make(partial).repair();
    expect(partial.has(KEYS.findLnk)).toBe(false);
    const dev = installed();
    expect(await make(dev, { execPath: 'C:\\dev\\electron.exe' }).repair()).toEqual({ action: 'none' });
    expect([none, foreign, dev].flatMap((r) => r.writes())).toEqual([]);
  });
});
