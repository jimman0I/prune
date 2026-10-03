import { describe, it, expect, vi } from 'vitest';
import { RUN_KEY, APPROVED_RUN_KEY } from './runAsAdmin.js';
import {
  VALUE_NAME, MINIMIZED_FLAG, runValueFor, parseRunValue, createStartWithWindows
} from './startWithWindows.js';

/** "Start Prune when I sign in to Windows" is one value in the per-user Run
 * key. It is persistence by nature, so what is held still is how small and
 * how honest it is: written only by an explicit switch, only for the running
 * packaged Prune.exe, with nothing in it but the quoted path and at most
 * --start-minimized; read back from the registry rather than remembered;
 * removed cleanly, and never deleting a value Prune did not write. Nothing here
 * touches the real registry: every test hands the service a fake reg.exe. */

const EXE = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe';
const QUOTED = `"${EXE}"`;
const MINIMIZED = `"${EXE}" --start-minimized`;

describe('runValueFor / parseRunValue', () => {
  it('is the quoted exe path, plus --start-minimized when asked, and nothing else', () => {
    expect(MINIMIZED_FLAG).toBe('--start-minimized');
    expect(VALUE_NAME).toBe('Prune');
    expect(runValueFor(EXE, false)).toBe(QUOTED);
    expect(runValueFor(EXE, true)).toBe(MINIMIZED);
  });

  it('reads back exactly what it writes', () => {
    expect(parseRunValue(QUOTED)).toEqual({ exe: EXE, minimized: false });
    expect(parseRunValue(MINIMIZED)).toEqual({ exe: EXE, minimized: true });
    expect(parseRunValue(`  ${MINIMIZED}  `)).toEqual({ exe: EXE, minimized: true });
  });

  it('refuses anything else in the value: other arguments, unquoted paths, two programs', () => {
    expect(parseRunValue(`${QUOTED} --delete-everything`)).toBeNull();
    expect(parseRunValue(`${QUOTED} --start-minimized --extra`)).toBeNull();
    expect(parseRunValue(`${QUOTED} --start-minimized2`)).toBeNull();
    expect(parseRunValue(EXE)).toBeNull();
    expect(parseRunValue(`${QUOTED} & calc.exe`)).toBeNull();
    expect(parseRunValue(`"C:\\a\\x.exe" "C:\\b\\y.exe"`)).toBeNull();
    expect(parseRunValue('')).toBeNull();
    expect(parseRunValue(null)).toBeNull();
    expect(parseRunValue(undefined)).toBeNull();
  });
});

/** A fake registry behind a fake reg.exe: query/add/delete over a Map. */
function fakeRegistry({ run = {}, approved = {}, failAdd = false } = {}) {
  const store = { [RUN_KEY]: { ...run }, [APPROVED_RUN_KEY]: { ...approved } };
  const calls = [];
  const notFound = () => Object.assign(new Error('Command failed: reg\nERROR: The system was unable to find the specified registry key or value.'), { code: 1, stdout: '', stderr: 'ERROR: not found' });
  const exec = vi.fn(async (file, args, options) => {
    calls.push({ file, args, options });
    const [verb, key, flag, name] = args;
    const hive = store[key];
    if (verb === 'query') {
      if (!hive) throw notFound();
      const entries = Object.entries(hive).filter(([n]) => flag !== '/v' || n.toLowerCase() === String(name).toLowerCase());
      if (flag === '/v' && entries.length === 0) throw notFound();
      const rows = entries.map(([n, v]) => `    ${n}    ${typeof v === 'string' ? `REG_SZ    ${v}` : `REG_BINARY    ${v.bin}`}`);
      return { stdout: `\r\nHKEY_CURRENT_USER\\${key.replace(/^HKCU\\/, '')}\r\n${rows.join('\r\n')}\r\n\r\n`, stderr: '' };
    }
    if (verb === 'add') {
      if (failAdd) throw Object.assign(new Error('Command failed: reg add\nERROR: Access is denied.'), { code: 1, stdout: '', stderr: 'ERROR: Access is denied.' });
      store[key][name] = args[args.indexOf('/d') + 1];
      return { stdout: 'The operation completed successfully.', stderr: '' };
    }
    if (verb === 'delete') {
      if (!hive || !(name in hive)) throw notFound();
      delete hive[name];
      return { stdout: 'The operation completed successfully.', stderr: '' };
    }
    throw new Error(`unexpected reg verb ${verb}`);
  });
  return { exec, store, calls, writes: () => calls.filter((c) => c.args[0] !== 'query') };
}

const make = (registry, over = {}) => createStartWithWindows({
  exec: registry.exec, execPath: EXE, platform: 'win32', systemRoot: 'C:\\Windows', runAsAdminEnabled: async () => false, ...over
});

const BASE = { supported: true, enabled: false, minimized: false, stale: false, foreign: false, disabledByWindows: false, runAsAdmin: false };

describe('status: the switch reads the real Run key', () => {
  it('off when there is no Prune value', async () => {
    expect(await make(fakeRegistry()).status()).toEqual(BASE);
  });

  it('on, not minimised, for the plain quoted path', async () => {
    const status = await make(fakeRegistry({ run: { Prune: QUOTED } })).status();
    expect(status).toEqual({ ...BASE, enabled: true });
  });

  it('on and minimised for the value with the flag', async () => {
    const status = await make(fakeRegistry({ run: { Prune: MINIMIZED } })).status();
    expect(status).toEqual({ ...BASE, enabled: true, minimized: true });
  });

  it('ignores other programs\' Run entries', async () => {
    const status = await make(fakeRegistry({ run: { OneDrive: '"C:\\x\\OneDrive.exe" /background' } })).status();
    expect(status.enabled).toBe(false);
  });

  it('matches the path case-insensitively', async () => {
    const status = await make(fakeRegistry({ run: { Prune: `"${EXE.toUpperCase()}" --start-minimized` } })).status();
    expect(status).toMatchObject({ enabled: true, minimized: true, stale: false });
  });

  it('is off, and says Windows turned it off, when Task Manager disabled the entry', async () => {
    const reg = fakeRegistry({ run: { Prune: MINIMIZED }, approved: { Prune: { bin: '030000000000000000000000' } } });
    expect(await make(reg).status()).toMatchObject({ enabled: false, disabledByWindows: true, minimized: true });
  });

  it('is on when StartupApproved says enabled', async () => {
    const reg = fakeRegistry({ run: { Prune: QUOTED }, approved: { Prune: { bin: '020000000000000000000000' } } });
    expect(await make(reg).status()).toMatchObject({ enabled: true, disabledByWindows: false });
  });

  it('on but stale when the value points at another Prune.exe (the install moved)', async () => {
    const status = await make(fakeRegistry({ run: { Prune: '"D:\\Old\\Prune\\Prune.exe" --start-minimized' } })).status();
    expect(status).toMatchObject({ enabled: true, stale: true, minimized: true });
  });

  it('off, and foreign, when a value named Prune is not one Prune would write', async () => {
    for (const data of ['"C:\\Tools\\mystery.exe"', `${QUOTED} --other`, 'cmd /c calc']) {
      const status = await make(fakeRegistry({ run: { Prune: data } })).status();
      expect(status, data).toMatchObject({ enabled: false, foreign: true });
    }
  });

  it('carries whether "Always run as administrator" is on, so the screen can warn', async () => {
    const reg = fakeRegistry({ run: { Prune: MINIMIZED } });
    expect((await make(reg, { runAsAdminEnabled: async () => true }).status()).runAsAdmin).toBe(true);
    expect((await make(reg, { runAsAdminEnabled: async () => { throw new Error('boom'); } }).status()).runAsAdmin).toBe(false);
  });

  it('asks the registry about its own value with an argv array and no shell', async () => {
    const reg = fakeRegistry();
    await make(reg).status();
    const query = reg.calls.find((c) => c.args[1] === RUN_KEY);
    expect(query.file).toBe('C:\\Windows\\System32\\reg.exe');
    expect(query.args).toEqual(['query', RUN_KEY, '/v', 'Prune']);
    expect(query.options.shell).toBeUndefined();
  });

  it('is unsupported, and touches nothing, in a dev build, off Windows, or for another exe', async () => {
    for (const over of [
      { execPath: 'C:\\dev\\electron\\dist\\electron.exe' },
      { platform: 'linux' },
      { execPath: 'C:\\x\\notprune.exe' }
    ]) {
      const reg = fakeRegistry();
      expect(await make(reg, over).status()).toMatchObject({ supported: false, enabled: false });
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
  it('writes the quoted path and --start-minimized, with reg.exe, an argv array and no shell', async () => {
    const reg = fakeRegistry();
    const status = await make(reg).set({ enabled: true, minimized: true });
    const [write] = reg.writes();
    expect(write.file).toBe('C:\\Windows\\System32\\reg.exe');
    expect(write.args).toEqual(['add', RUN_KEY, '/v', 'Prune', '/t', 'REG_SZ', '/d', MINIMIZED, '/f']);
    expect(write.options.shell).toBeUndefined();
    expect(reg.store[RUN_KEY].Prune).toBe(MINIMIZED);
    expect(status).toMatchObject({ enabled: true, minimized: true });
  });

  it('writes just the path when minimised is off', async () => {
    const reg = fakeRegistry();
    await make(reg).set({ enabled: true, minimized: false });
    expect(reg.store[RUN_KEY].Prune).toBe(QUOTED);
  });

  it('starts minimised when nothing said otherwise', async () => {
    const reg = fakeRegistry();
    await make(reg).set({ enabled: true });
    expect(reg.store[RUN_KEY].Prune).toBe(MINIMIZED);
  });

  it('keeps the current minimised choice when only enabled is sent', async () => {
    const reg = fakeRegistry({ run: { Prune: QUOTED } });
    const writes = reg.writes().length;
    await make(reg).set({ enabled: true });
    expect(reg.writes().length).toBe(writes);
    expect(reg.store[RUN_KEY].Prune).toBe(QUOTED);
  });

  it('changing only the minimised choice rewrites the value', async () => {
    const reg = fakeRegistry({ run: { Prune: MINIMIZED } });
    await make(reg).set({ enabled: true, minimized: false });
    expect(reg.store[RUN_KEY].Prune).toBe(QUOTED);
  });

  it('writes nothing when it is already exactly that', async () => {
    const reg = fakeRegistry({ run: { Prune: MINIMIZED } });
    await make(reg).set({ enabled: true, minimized: true });
    expect(reg.writes()).toEqual([]);
  });

  it('puts a stale value back to the current exe', async () => {
    const reg = fakeRegistry({ run: { Prune: '"D:\\Old\\Prune\\Prune.exe" --start-minimized' } });
    await make(reg).set({ enabled: true });
    expect(reg.store[RUN_KEY].Prune).toBe(MINIMIZED);
  });

  it('overwrites a foreign value that only shares the name', async () => {
    const reg = fakeRegistry({ run: { Prune: '"C:\\Tools\\mystery.exe"' } });
    await make(reg).set({ enabled: true, minimized: true });
    expect(reg.store[RUN_KEY].Prune).toBe(MINIMIZED);
  });

  it('gives back an entry Windows had switched off, by removing the "disabled" mark', async () => {
    const reg = fakeRegistry({ run: { Prune: MINIMIZED }, approved: { Prune: { bin: '030000000000000000000000' } } });
    const status = await make(reg).set({ enabled: true, minimized: true });
    expect('Prune' in reg.store[APPROVED_RUN_KEY]).toBe(false);
    expect(status.enabled).toBe(true);
  });

  it('writes only the exe it is running, whatever the path holds', async () => {
    const odd = 'C:\\Users\\O\'Brien & Sons (x86)\\Prune.exe';
    const reg = fakeRegistry();
    await make(reg, { execPath: odd }).set({ enabled: true, minimized: true });
    const write = reg.writes()[0];
    expect(write.args[7]).toBe(`"${odd}" --start-minimized`);
    expect(write.args).toHaveLength(9);
    expect(write.options.shell).toBeUndefined();
  });

  it('reports a write Windows refused, and changes nothing', async () => {
    const reg = fakeRegistry({ failAdd: true });
    await expect(make(reg).set({ enabled: true })).rejects.toThrow(/Access is denied/);
    expect(reg.store[RUN_KEY].Prune).toBeUndefined();
  });
});

describe('set: turning it off', () => {
  it('deletes the value, and any Windows mark for it, and leaves other programs alone', async () => {
    const reg = fakeRegistry({ run: { Prune: MINIMIZED, Other: '"C:\\x\\x.exe"' }, approved: { Prune: { bin: '020000000000000000000000' }, Other: { bin: '020000000000000000000000' } } });
    const status = await make(reg).set({ enabled: false });
    expect(reg.writes().map((c) => c.args.slice(0, 4))).toEqual([
      ['delete', RUN_KEY, '/v', 'Prune'],
      ['delete', APPROVED_RUN_KEY, '/v', 'Prune']
    ]);
    expect(reg.writes()[0].args).toContain('/f');
    expect(reg.store[RUN_KEY]).toEqual({ Other: '"C:\\x\\x.exe"' });
    expect('Other' in reg.store[APPROVED_RUN_KEY]).toBe(true);
    expect(status).toEqual(BASE);
  });

  it('writes nothing when it was never on', async () => {
    const reg = fakeRegistry();
    await make(reg).set({ enabled: false });
    expect(reg.writes()).toEqual([]);
  });

  it('removes a stale Prune value too: it is still Prune\'s own', async () => {
    const reg = fakeRegistry({ run: { Prune: '"D:\\Old\\Prune\\Prune.exe"' } });
    await make(reg).set({ enabled: false });
    expect(reg.store[RUN_KEY].Prune).toBeUndefined();
  });

  it('leaves a value it did not write alone', async () => {
    const reg = fakeRegistry({ run: { Prune: '"C:\\Tools\\mystery.exe" --go' } });
    await make(reg).set({ enabled: false });
    expect(reg.writes()).toEqual([]);
    expect(reg.store[RUN_KEY].Prune).toBe('"C:\\Tools\\mystery.exe" --go');
  });

  it('on, off, on, off ends where it began', async () => {
    const reg = fakeRegistry();
    const service = make(reg);
    for (const enabled of [true, false, true, false]) await service.set({ enabled });
    expect(reg.store[RUN_KEY]).toEqual({});
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
    for (const bad of [{ enabled: 'true' }, { enabled: 1 }, { enabled: null }, {}, { enabled: true, minimized: 'yes' }, { enabled: true, minimized: 1 }, null, undefined]) {
      await expect(make(reg).set(bad), JSON.stringify(bad)).rejects.toThrow(/true or false/);
    }
    expect(reg.calls).toEqual([]);
  });

  it('two changes at once are applied one after the other', async () => {
    const reg = fakeRegistry();
    const service = make(reg);
    await Promise.all([service.set({ enabled: true, minimized: true }), service.set({ enabled: false }), service.set({ enabled: true, minimized: false })]);
    expect(reg.store[RUN_KEY].Prune).toBe(QUOTED);
  });
});

describe('repair: an update into another folder', () => {
  it('re-points a stale value, and only then', async () => {
    const stale = fakeRegistry({ run: { Prune: '"D:\\Old\\Prune\\Prune.exe" --start-minimized' } });
    expect(await make(stale).repair()).toEqual({ action: 'updated' });
    expect(stale.store[RUN_KEY].Prune).toBe(MINIMIZED);

    const fine = fakeRegistry({ run: { Prune: QUOTED } });
    expect(await make(fine).repair()).toEqual({ action: 'none' });
    expect(fine.writes()).toEqual([]);
  });

  it('never creates the value, never touches a foreign one, and does nothing when unsupported', async () => {
    const none = fakeRegistry();
    expect(await make(none).repair()).toEqual({ action: 'none' });
    const foreign = fakeRegistry({ run: { Prune: '"C:\\Tools\\mystery.exe"' } });
    expect(await make(foreign).repair()).toEqual({ action: 'none' });
    const dev = fakeRegistry({ run: { Prune: MINIMIZED } });
    expect(await make(dev, { execPath: 'C:\\dev\\electron.exe' }).repair()).toEqual({ action: 'none' });
    expect([none, foreign, dev].flatMap((r) => r.writes())).toEqual([]);
  });
});
