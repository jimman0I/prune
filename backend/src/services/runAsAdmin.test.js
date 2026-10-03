import { describe, it, expect, vi } from 'vitest';
import {
  LAYERS_KEY, RUN_KEY, APPROVED_RUN_KEY, TOKEN,
  parseFlags, hasToken, addToken, removeToken, parseRegQuery, isPruneExecutable, createRunAsAdmin
} from './runAsAdmin.js';

/** "Always run as administrator" is Windows' own per-program compatibility
 * flag for this copy of Prune: HKCU\...\AppCompatFlags\Layers, value name =
 * the full path of Prune.exe, data "~ RUNASADMIN". Nothing here touches the
 * real registry: every test hands the service a fake `exec`. What is held
 * still is the merge (other flags survive, adding twice is a no-op, removing
 * the last flag deletes the value), that only Prune.exe's own path is ever
 * written, and that every call is an argv array with no shell. */

const EXE = 'C:\\Users\\me\\AppData\\Local\\Programs\\Prune\\Prune.exe';

describe('parseFlags', () => {
  it('splits the tilde marker from the flags', () => {
    expect(parseFlags('~ RUNASADMIN')).toEqual({ tilde: true, tokens: ['RUNASADMIN'] });
    expect(parseFlags('~ WIN8RTM HIGHDPIAWARE')).toEqual({ tilde: true, tokens: ['WIN8RTM', 'HIGHDPIAWARE'] });
    expect(parseFlags('WIN8RTM')).toEqual({ tilde: false, tokens: ['WIN8RTM'] });
  });

  it('copes with extra whitespace, a bare tilde, empty and missing data', () => {
    expect(parseFlags('  ~   RUNASADMIN  WIN8RTM ')).toEqual({ tilde: true, tokens: ['RUNASADMIN', 'WIN8RTM'] });
    expect(parseFlags('~')).toEqual({ tilde: true, tokens: [] });
    expect(parseFlags('')).toEqual({ tilde: false, tokens: [] });
    expect(parseFlags(null)).toEqual({ tilde: false, tokens: [] });
    expect(parseFlags(undefined)).toEqual({ tilde: false, tokens: [] });
  });
});

describe('hasToken', () => {
  it('finds RUNASADMIN among other flags, in any case', () => {
    expect(hasToken('~ RUNASADMIN')).toBe(true);
    expect(hasToken('~ WIN8RTM RUNASADMIN')).toBe(true);
    expect(hasToken('~ runasadmin')).toBe(true);
  });

  it('does not mistake a longer flag, or its absence, for it', () => {
    expect(hasToken('~ WIN8RTM')).toBe(false);
    expect(hasToken('~ NORUNASADMIN RUNASADMINX')).toBe(false);
    expect(hasToken('')).toBe(false);
    expect(hasToken(null)).toBe(false);
  });
});

describe('addToken', () => {
  it('writes what the Properties dialog writes when there was nothing', () => {
    expect(addToken(null)).toBe('~ RUNASADMIN');
    expect(addToken('')).toBe('~ RUNASADMIN');
    expect(addToken('~')).toBe('~ RUNASADMIN');
  });

  it('keeps every other flag, in order, and adds RUNASADMIN last', () => {
    expect(addToken('~ WIN8RTM')).toBe('~ WIN8RTM RUNASADMIN');
    expect(addToken('~ HIGHDPIAWARE WIN8RTM 256COLOR')).toBe('~ HIGHDPIAWARE WIN8RTM 256COLOR RUNASADMIN');
  });

  it('does not invent a tilde the value did not have', () => {
    expect(addToken('WIN8RTM')).toBe('WIN8RTM RUNASADMIN');
  });

  it('is idempotent: adding it again changes nothing, and never doubles it', () => {
    const once = addToken('~ WIN8RTM');
    expect(addToken(once)).toBe(once);
    expect(addToken('~ RUNASADMIN')).toBe('~ RUNASADMIN');
    expect(addToken('~ RUNASADMIN WIN8RTM runasadmin')).toBe('~ RUNASADMIN WIN8RTM');
  });
});

describe('removeToken', () => {
  it('takes RUNASADMIN out and leaves the rest exactly as it was', () => {
    expect(removeToken('~ WIN8RTM RUNASADMIN')).toBe('~ WIN8RTM');
    expect(removeToken('~ RUNASADMIN WIN8RTM')).toBe('~ WIN8RTM');
    expect(removeToken('~ A RUNASADMIN B')).toBe('~ A B');
    expect(removeToken('WIN8RTM RUNASADMIN')).toBe('WIN8RTM');
  });

  it('answers empty when nothing else was set, so the value can be deleted', () => {
    expect(removeToken('~ RUNASADMIN')).toBe('');
    expect(removeToken('RUNASADMIN')).toBe('');
    expect(removeToken('~ runasadmin RUNASADMIN')).toBe('');
  });

  it('is idempotent: removing what is not there changes nothing', () => {
    expect(removeToken('~ WIN8RTM')).toBe('~ WIN8RTM');
    expect(removeToken(removeToken('~ WIN8RTM RUNASADMIN'))).toBe('~ WIN8RTM');
    expect(removeToken('')).toBe('');
    expect(removeToken(null)).toBe('');
  });

  it('round-trips: add then remove returns the original flags', () => {
    for (const original of ['~ WIN8RTM', '~ HIGHDPIAWARE WIN8RTM', 'WIN8RTM']) {
      expect(removeToken(addToken(original))).toBe(original);
    }
  });
});

describe('parseRegQuery', () => {
  const single = `\r\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers\r\n    ${EXE}    REG_SZ    ~ RUNASADMIN\r\n\r\n`;

  it('reads a value whose name has spaces and a backslash path', () => {
    expect(parseRegQuery(single)).toEqual([{ name: EXE, type: 'REG_SZ', data: '~ RUNASADMIN' }]);
  });

  it('reads several values, binary ones included', () => {
    const text = `\nHKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\n    OneDrive    REG_SZ    "C:\\Program Files\\OneDrive\\OneDrive.exe" /background\n    Prune    REG_SZ    "${EXE}"\n    Flags    REG_BINARY    0200000000000000\n`;
    const values = parseRegQuery(text);
    expect(values.map((v) => v.name)).toEqual(['OneDrive', 'Prune', 'Flags']);
    expect(values[1].data).toBe(`"${EXE}"`);
    expect(values[2]).toEqual({ name: 'Flags', type: 'REG_BINARY', data: '0200000000000000' });
  });

  it('answers nothing for nothing, and for the key line alone', () => {
    expect(parseRegQuery('')).toEqual([]);
    expect(parseRegQuery('\nHKEY_CURRENT_USER\\Software\\Microsoft\n')).toEqual([]);
    expect(parseRegQuery(undefined)).toEqual([]);
  });

  it('reads an empty string value', () => {
    expect(parseRegQuery('\nHKEY_X\\Y\n    Empty    REG_SZ    \n')).toEqual([{ name: 'Empty', type: 'REG_SZ', data: '' }]);
  });
});

describe('isPruneExecutable', () => {
  it('is Prune.exe on Windows, in any folder and case', () => {
    expect(isPruneExecutable(EXE, 'win32')).toBe(true);
    expect(isPruneExecutable('D:\\Portable\\prune.exe', 'win32')).toBe(true);
  });

  it('is not Electron, node, a look-alike, or anything off Windows', () => {
    expect(isPruneExecutable('C:\\dev\\prune\\electron\\node_modules\\electron\\dist\\electron.exe', 'win32')).toBe(false);
    expect(isPruneExecutable('C:\\Program Files\\nodejs\\node.exe', 'win32')).toBe(false);
    expect(isPruneExecutable('C:\\x\\NotPrune.exe', 'win32')).toBe(false);
    expect(isPruneExecutable('C:\\x\\Prune.exe.bak', 'win32')).toBe(false);
    expect(isPruneExecutable('Prune.exe', 'win32')).toBe(false);
    expect(isPruneExecutable(EXE, 'linux')).toBe(false);
    expect(isPruneExecutable('', 'win32')).toBe(false);
    expect(isPruneExecutable(undefined, 'win32')).toBe(false);
  });
});

/** A fake registry behind a fake reg.exe: query/add/delete over a Map. */
function fakeRegistry({ layers = {}, run = {}, approved = {}, failAdd = false } = {}) {
  const store = { [LAYERS_KEY]: { ...layers }, [RUN_KEY]: { ...run }, [APPROVED_RUN_KEY]: { ...approved } };
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
      const data = args[args.indexOf('/d') + 1];
      store[key][name] = data;
      return { stdout: 'The operation completed successfully.', stderr: '' };
    }
    if (verb === 'delete') {
      if (!(name in store[key])) throw notFound();
      delete store[key][name];
      return { stdout: 'The operation completed successfully.', stderr: '' };
    }
    throw new Error(`unexpected reg verb ${verb}`);
  });
  return { exec, store, calls, writes: () => calls.filter((c) => c.args[0] !== 'query') };
}

const make = (registry, over = {}) => createRunAsAdmin({
  exec: registry.exec, execPath: EXE, platform: 'win32', isElevated: async () => false, systemRoot: 'C:\\Windows', ...over
});

describe('status', () => {
  it('reads the real flag, not a copy: off when nothing is set', async () => {
    const reg = fakeRegistry();
    expect(await make(reg).status()).toEqual({ supported: true, enabled: false, elevatedNow: false, startsWithWindows: false });
  });

  it('on when this exe\'s value holds RUNASADMIN, even beside other flags', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ WIN8RTM RUNASADMIN' } });
    expect((await make(reg).status()).enabled).toBe(true);
  });

  it('off when only another program has the flag', async () => {
    const reg = fakeRegistry({ layers: { 'C:\\Other\\other.exe': '~ RUNASADMIN' } });
    expect((await make(reg).status()).enabled).toBe(false);
  });

  it('off when this exe has flags but not that one', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ WIN8RTM' } });
    expect((await make(reg).status()).enabled).toBe(false);
  });

  it('reports whether Prune is running elevated right now', async () => {
    const reg = fakeRegistry();
    expect((await make(reg, { isElevated: async () => true }).status()).elevatedNow).toBe(true);
    expect((await make(reg, { isElevated: async () => { throw new Error('no whoami'); } }).status()).elevatedNow).toBe(false);
  });

  it('asks the registry about this exe only, with an argv array and no shell', async () => {
    const reg = fakeRegistry();
    await make(reg).status();
    const query = reg.calls.find((c) => c.args[1] === LAYERS_KEY);
    expect(query.file).toBe('C:\\Windows\\System32\\reg.exe');
    expect(query.args).toEqual(['query', LAYERS_KEY, '/v', EXE]);
    expect(Array.isArray(query.args)).toBe(true);
    expect(query.options.shell).toBeUndefined();
  });

  it('is unsupported, and touches nothing, in a dev build, off Windows, or for another exe', async () => {
    for (const over of [
      { execPath: 'C:\\dev\\electron\\dist\\electron.exe' },
      { platform: 'linux' },
      { execPath: 'C:\\x\\notprune.exe' }
    ]) {
      const reg = fakeRegistry();
      const status = await make(reg, over).status();
      expect(status).toMatchObject({ supported: false, enabled: false });
      expect(reg.calls).toEqual([]);
    }
  });
});

describe('startsWithWindows (the conflict to warn about)', () => {
  it('is true when a Run entry launches this exe', async () => {
    const reg = fakeRegistry({ run: { Prune: `"${EXE}" --minimized`, Other: '"C:\\x\\x.exe"' } });
    expect((await make(reg).status()).startsWithWindows).toBe(true);
  });

  it('is false when no Run entry points at it', async () => {
    const reg = fakeRegistry({ run: { Other: '"C:\\x\\x.exe"' } });
    expect((await make(reg).status()).startsWithWindows).toBe(false);
  });

  it('is false when Windows has that entry switched off (StartupApproved, odd first byte)', async () => {
    const reg = fakeRegistry({ run: { Prune: `"${EXE}"` }, approved: { Prune: { bin: '030000000000000000000000' } } });
    expect((await make(reg).status()).startsWithWindows).toBe(false);
  });

  it('is true when StartupApproved says enabled', async () => {
    const reg = fakeRegistry({ run: { Prune: `"${EXE}"` }, approved: { Prune: { bin: '020000000000000000000000' } } });
    expect((await make(reg).status()).startsWithWindows).toBe(true);
  });

  it('matches the path case-insensitively and without the quotes', async () => {
    const reg = fakeRegistry({ run: { Prune: EXE.toUpperCase() } });
    expect((await make(reg).status()).startsWithWindows).toBe(true);
  });

  it('is false, not an error, when the Run key cannot be read', async () => {
    const reg = fakeRegistry();
    reg.store[RUN_KEY] = undefined;
    delete reg.store[RUN_KEY];
    expect((await make(reg).status()).startsWithWindows).toBe(false);
  });
});

describe('setEnabled', () => {
  it('turns it on with exactly the value the Properties dialog writes', async () => {
    const reg = fakeRegistry();
    const status = await make(reg).setEnabled(true);
    expect(reg.writes()).toHaveLength(1);
    expect(reg.writes()[0].args).toEqual(['add', LAYERS_KEY, '/v', EXE, '/t', 'REG_SZ', '/d', '~ RUNASADMIN', '/f']);
    expect(reg.store[LAYERS_KEY][EXE]).toBe('~ RUNASADMIN');
    expect(status.enabled).toBe(true);
  });

  it('keeps the other flags already in the value', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ WIN8RTM HIGHDPIAWARE' } });
    await make(reg).setEnabled(true);
    expect(reg.store[LAYERS_KEY][EXE]).toBe('~ WIN8RTM HIGHDPIAWARE RUNASADMIN');
  });

  it('leaves other programs\' values alone', async () => {
    const other = 'C:\\Other\\other.exe';
    const reg = fakeRegistry({ layers: { [other]: '~ RUNASADMIN' } });
    await make(reg).setEnabled(true);
    await make(reg).setEnabled(false);
    expect(reg.store[LAYERS_KEY][other]).toBe('~ RUNASADMIN');
  });

  it('writes nothing when it is already on', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ RUNASADMIN' } });
    const status = await make(reg).setEnabled(true);
    expect(reg.writes()).toEqual([]);
    expect(status.enabled).toBe(true);
  });

  it('turning it off deletes a value that held only that flag', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ RUNASADMIN' } });
    const status = await make(reg).setEnabled(false);
    expect(reg.writes()).toHaveLength(1);
    expect(reg.writes()[0].args).toEqual(['delete', LAYERS_KEY, '/v', EXE, '/f']);
    expect(EXE in reg.store[LAYERS_KEY]).toBe(false);
    expect(status.enabled).toBe(false);
  });

  it('turning it off keeps the other flags rather than deleting them', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ WIN8RTM RUNASADMIN' } });
    await make(reg).setEnabled(false);
    expect(reg.writes()).toHaveLength(1);
    expect(reg.writes()[0].args).toEqual(['add', LAYERS_KEY, '/v', EXE, '/t', 'REG_SZ', '/d', '~ WIN8RTM', '/f']);
  });

  it('writes nothing when turning off what was never on', async () => {
    const reg = fakeRegistry();
    await make(reg).setEnabled(false);
    expect(reg.writes()).toEqual([]);
    const flagged = fakeRegistry({ layers: { [EXE]: '~ WIN8RTM' } });
    await make(flagged).setEnabled(false);
    expect(flagged.writes()).toEqual([]);
  });

  it('on, off, on, off ends where it began', async () => {
    const reg = fakeRegistry({ layers: { [EXE]: '~ WIN8RTM' } });
    const service = make(reg);
    for (const flag of [true, false, true, false]) await service.setEnabled(flag);
    expect(reg.store[LAYERS_KEY][EXE]).toBe('~ WIN8RTM');
  });

  it('writes only the value named after this exe, with no shell, whatever the path holds', async () => {
    const odd = 'C:\\Users\\O\'Brien & "Sons"\\Prune.exe';
    const reg = fakeRegistry();
    await make(reg, { execPath: odd }).setEnabled(true);
    const write = reg.writes()[0];
    expect(write.args[3]).toBe(odd);
    expect(write.args).toHaveLength(9);
    expect(write.options.shell).toBeUndefined();
    expect(write.file).toBe('C:\\Windows\\System32\\reg.exe');
  });

  it('refuses, and writes nothing, where it is unsupported', async () => {
    for (const over of [{ execPath: 'C:\\dev\\electron.exe' }, { platform: 'darwin' }]) {
      const reg = fakeRegistry();
      await expect(make(reg, over).setEnabled(true)).rejects.toMatchObject({ unsupported: true });
      expect(reg.calls).toEqual([]);
    }
  });

  it('only a real boolean is accepted', async () => {
    const reg = fakeRegistry();
    for (const bad of ['true', 1, null, undefined, {}]) {
      await expect(make(reg).setEnabled(bad)).rejects.toThrow(/true or false/);
    }
    expect(reg.calls).toEqual([]);
  });

  it('reports a write Windows refused, and changes nothing', async () => {
    const reg = fakeRegistry({ failAdd: true });
    await expect(make(reg).setEnabled(true)).rejects.toThrow(/Access is denied/);
    expect(reg.store[LAYERS_KEY][EXE]).toBeUndefined();
  });

  it('two changes at once are applied one after the other', async () => {
    const reg = fakeRegistry();
    const service = make(reg);
    await Promise.all([service.setEnabled(true), service.setEnabled(false), service.setEnabled(true)]);
    expect(reg.store[LAYERS_KEY][EXE]).toBe('~ RUNASADMIN');
  });

  it('exports the key and token it works with', () => {
    expect(LAYERS_KEY).toBe('HKCU\\Software\\Microsoft\\Windows NT\\CurrentVersion\\AppCompatFlags\\Layers');
    expect(TOKEN).toBe('RUNASADMIN');
  });
});
