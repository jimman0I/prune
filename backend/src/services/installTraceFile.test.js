import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readdirSync, existsSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveTrace, getTrace, listTraces, newTraceId, isTraceId } from './installTraces.js';
import {
  buildTraceFile, importTraceFile, parseTraceFile, sanitizeTrace, relinkTrace, traceFingerprint, isLocalPath,
  TraceFileError, TRACE_FILE_FORMAT, TRACE_FILE_VERSION, MAX_TRACE_FILE_BYTES, MAX_TRACES_PER_FILE
} from './installTraceFile.js';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'prune-tracefile-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

/** A trace exactly as installMonitor's buildTrace writes one. */
const trace = (overrides = {}) => ({
  id: newTraceId(), version: 1, createdAt: 1700000000000, durationMs: 42000, installer: 'C:\\dl\\acme-setup.exe',
  program: {
    name: 'Acme', publisher: 'Acme Inc', version: '1.0', installLocation: 'C:\\Program Files\\Acme',
    uninstallString: '"C:\\Program Files\\Acme\\uninstall.exe"',
    key: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme',
    registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme'
  },
  alsoInstalled: ['Acme Runtime'],
  files: [
    { path: 'C:\\Program Files\\Acme', isDirectory: true, sizeBytes: 1024 },
    { path: 'C:\\Users\\Pat\\AppData\\Roaming\\Acme\\settings.ini', isDirectory: false, sizeBytes: 12 }
  ],
  modifiedFileCount: 3,
  registry: [
    { path: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme' },
    { path: 'HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run', valueName: 'Acme' }
  ],
  services: [{ name: 'AcmeSvc', pathName: 'C:\\Program Files\\Acme\\svc.exe' }],
  tasks: [{ name: 'Acme Update', path: '\\' }],
  partial: false,
  ...overrides
});

const fileOf = (traces, header = {}) => JSON.stringify({
  format: TRACE_FILE_FORMAT, version: TRACE_FILE_VERSION, exportedAt: '2026-10-24T00:00:00.000Z', pruneVersion: '3.1.0', traces, ...header
});
const acmeHere = [{ name: 'Acme', publisher: 'Acme Inc', registryKey: 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Acme' }];
const importIt = (text, options = {}) => importTraceFile(text, { root, listPrograms: async () => acmeHere, now: () => 5, ...options });
const withoutId = ({ id, ...rest }) => rest;

describe('parseTraceFile: the file as a whole', () => {
  const codeOf = (text) => {
    try { parseTraceFile(text); } catch (err) { expect(err).toBeInstanceOf(TraceFileError); return err.code; }
    return null;
  };

  it('reads a file this Prune wrote, a leading BOM and all', () => {
    expect(parseTraceFile(fileOf([trace()])).traces).toHaveLength(1);
    expect(parseTraceFile(`\uFEFF${fileOf([])}`).traces).toEqual([]);
  });

  it('refuses malformed JSON and empty files', () => {
    expect(codeOf('{"format": "prune-install-traces", ')).toBe('notJson');
    expect(codeOf('not json at all')).toBe('notJson');
    expect(codeOf('')).toBe('notTraceFile');
    expect(codeOf('   ')).toBe('notTraceFile');
  });

  it('refuses a file without the header, or with another format\'s', () => {
    expect(codeOf(JSON.stringify([trace()]))).toBe('notTraceFile');
    expect(codeOf(JSON.stringify({ traces: [trace()] }))).toBe('notTraceFile');
    expect(codeOf(fileOf([], { format: 'something-else' }))).toBe('notTraceFile');
    expect(codeOf(fileOf([], { version: '1' }))).toBe('notTraceFile');
    expect(codeOf(fileOf([], { version: 0 }))).toBe('notTraceFile');
    expect(codeOf(fileOf([], { version: 1.5 }))).toBe('notTraceFile');
    expect(codeOf(fileOf({ not: 'a list' }))).toBe('notTraceFile');
    expect(codeOf('null')).toBe('notTraceFile');
  });

  it('says so when a newer Prune wrote the file', () => {
    expect(codeOf(fileOf([], { version: TRACE_FILE_VERSION + 1 }))).toBe('newerVersion');
  });

  it('refuses an oversized file before parsing it, and one with too many traces', () => {
    const padding = ' '.repeat(MAX_TRACE_FILE_BYTES);
    expect(codeOf(`${fileOf([])}${padding}`)).toBe('tooLarge');
    expect(codeOf(fileOf(new Array(MAX_TRACES_PER_FILE + 1).fill(0)))).toBe('tooMany');
  });
});

describe('sanitizeTrace: one trace', () => {
  it('keeps exactly what buildTrace writes, without the id', () => {
    const t = trace();
    expect(sanitizeTrace(t)).toEqual(withoutId(t));
  });

  it('strips fields nobody writes, at every level', () => {
    const t = trace();
    const dirty = {
      ...t, importedAt: 1, extra: 'x', __proto__: { polluted: true },
      program: { ...t.program, extra: 'x' },
      files: [{ ...t.files[0], run: 'calc.exe' }],
      registry: [{ ...t.registry[0], data: 'x' }],
      services: [{ ...t.services[0], startType: 'auto' }],
      tasks: [{ ...t.tasks[0], action: 'x' }]
    };
    const clean = sanitizeTrace(dirty);
    expect(clean).not.toHaveProperty('extra');
    expect(clean).not.toHaveProperty('importedAt');
    expect(clean).not.toHaveProperty('id');
    expect(Object.keys(clean.program).sort()).toEqual(['installLocation', 'key', 'name', 'publisher', 'registryKey', 'uninstallString', 'version']);
    expect(clean.files[0]).toEqual(t.files[0]);
    expect(clean.registry[0]).toEqual(t.registry[0]);
    expect(clean.services[0]).toEqual(t.services[0]);
    expect(clean.tasks[0]).toEqual(t.tasks[0]);
  });

  it('accepts a portable install (no program) and a directory whose size is unknown', () => {
    const clean = sanitizeTrace(trace({ program: null, files: [{ path: 'D:\\Tools\\Thing', isDirectory: true, sizeBytes: null }] }));
    expect(clean.program).toBeNull();
    expect(clean.files[0].sizeBytes).toBeNull();
  });

  it('rejects a trace with a field of the wrong type or a missing one', () => {
    const bad = [
      null, 'x', [], trace({ version: 2 }), trace({ version: '1' }), trace({ createdAt: 'yesterday' }), trace({ createdAt: -1 }),
      trace({ durationMs: undefined }), trace({ installer: 5 }), trace({ partial: 'no' }), trace({ files: 'C:\\x' }),
      trace({ files: [{ path: 'C:\\x' }] }), trace({ registry: [{}] }), trace({ services: [{ pathName: 'x' }] }),
      trace({ tasks: [{ name: 'T', path: 'no-leading-backslash' }] }), trace({ alsoInstalled: [5] }),
      trace({ program: { name: 'Acme' } }), trace({ program: 'Acme' }), trace({ modifiedFileCount: Infinity })
    ];
    for (const raw of bad) expect(sanitizeTrace(raw), JSON.stringify(raw)?.slice(0, 80)).toBeNull();
  });

  it('keeps every path a local absolute path that does not climb', () => {
    for (const path of ['..\\..\\Windows', 'C:\\Program Files\\..\\Windows', 'C:\\a\\.\\b', 'relative\\path', '\\\\server\\share\\x',
      '\\\\?\\C:\\x', 'C:\\', 'C:', 'C:\\a\\\\b', 'C:/Windows', 'C:\\a\u0000b', 'C:\\a:stream', 'C:\\a\nb', `C:\\${'a'.repeat(5000)}`]) {
      expect(isLocalPath(path), path).toBe(false);
      expect(sanitizeTrace(trace({ files: [{ path, isDirectory: true, sizeBytes: 1 }] })), path).toBeNull();
    }
    for (const path of ['C:\\Program Files\\Acme', 'd:\\Games\\Thing\\', 'C:\\Users\\Pat\\AppData\\Local\\Acme Co. (x86)\\a.b']) {
      expect(isLocalPath(path), path).toBe(true);
    }
  });

  it('keeps registry paths to the two hives an installer writes', () => {
    for (const path of ['HKEY_CLASSES_ROOT\\x', 'HKLM\\SOFTWARE\\x', 'Registry::HKEY_LOCAL_MACHINE\\x', 'HKEY_LOCAL_MACHINE\\', 'HKEY_LOCAL_MACHINE']) {
      expect(sanitizeTrace(trace({ registry: [{ path }] })), path).toBeNull();
    }
    expect(sanitizeTrace(trace({ program: { ...trace().program, key: 'HKEY_USERS\\x' } }))).toBeNull();
    expect(sanitizeTrace(trace({ program: { ...trace().program, registryKey: 'C:\\x' } }))).toBeNull();
  });

  it('bounds every string and every list', () => {
    expect(sanitizeTrace(trace({ program: { ...trace().program, name: 'x'.repeat(5000) } }))).toBeNull();
    expect(sanitizeTrace(trace({ program: { ...trace().program, name: '' } }))).toBeNull();
    expect(sanitizeTrace(trace({ alsoInstalled: ['x'.repeat(5000)] }))).toBeNull();
    expect(sanitizeTrace(trace({ installer: 'x'.repeat(10000) }))).toBeNull();
    expect(sanitizeTrace(trace({ services: [{ name: 'S', pathName: 'x'.repeat(10000) }] }))).toBeNull();
    const many = new Array(5001).fill({ path: 'C:\\a', isDirectory: true, sizeBytes: 1 });
    expect(sanitizeTrace(trace({ files: many }))).toBeNull();
  });
});

describe('relinkTrace', () => {
  it('leaves a trace whose key is installed here as it is', () => {
    const t = sanitizeTrace(trace());
    expect(relinkTrace(t, [{ name: 'Renamed', registryKey: 'HKEY_LOCAL_MACHINE\\software\\microsoft\\windows\\currentversion\\uninstall\\ACME\\' }]))
      .toEqual({ trace: t, installed: true });
  });

  it('moves a trace to this PC\'s key when the program is filed under another one', () => {
    const t = sanitizeTrace(trace());
    const here = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{ABC}';
    const { trace: linked, installed } = relinkTrace(t, [{ name: ' acme ', publisher: 'Acme Inc', registryKey: here }]);
    expect(installed).toBe(true);
    expect(linked.program.registryKey).toBe(here);
    expect(linked.program.key).toBe('HKEY_CURRENT_USER\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{ABC}');
    // The entry that named the old key now names the new one; the Run value is untouched.
    expect(linked.registry).toEqual([{ path: linked.program.key }, t.registry[1]]);
    expect(t.program.registryKey).toBe(trace().program.registryKey); // the original is not mutated
  });

  it('uses the publisher only to settle an ambiguous name, and never guesses', () => {
    const t = sanitizeTrace(trace());
    const two = [
      { name: 'Acme', publisher: 'Other', registryKey: 'HKLM:\\SOFTWARE\\U\\A1' },
      { name: 'Acme', publisher: 'Acme Inc', registryKey: 'HKLM:\\SOFTWARE\\U\\A2' }
    ];
    expect(relinkTrace(t, two).trace.program.registryKey).toBe('HKLM:\\SOFTWARE\\U\\A2');
    const twins = [two[1], { ...two[1], registryKey: 'HKLM:\\SOFTWARE\\U\\A3' }];
    expect(relinkTrace(t, twins)).toEqual({ trace: t, installed: false });
  });

  it('says a program is not installed here, and that a portable trace has none', () => {
    const t = sanitizeTrace(trace());
    expect(relinkTrace(t, [{ name: 'Other', registryKey: 'HKLM:\\SOFTWARE\\U\\Other' }])).toEqual({ trace: t, installed: false });
    expect(relinkTrace(t, [])).toEqual({ trace: t, installed: false });
    const portable = sanitizeTrace(trace({ program: null }));
    expect(relinkTrace(portable, acmeHere)).toEqual({ trace: portable, installed: null });
  });
});

describe('traceFingerprint', () => {
  it('is the same for the same install, whatever its id, time, order, case or key', () => {
    const t = trace();
    const same = trace({
      createdAt: 1, durationMs: 1, installer: 'E:\\elsewhere.exe',
      files: [...t.files].reverse().map((f) => ({ ...f, path: f.path.toUpperCase() })),
      program: { ...t.program, key: 'HKEY_CURRENT_USER\\X\\{ABC}', registryKey: 'HKCU:\\X\\{ABC}' },
      registry: [{ path: 'HKEY_CURRENT_USER\\X\\{ABC}' }, t.registry[1]]
    });
    expect(traceFingerprint(sanitizeTrace(same))).toBe(traceFingerprint(sanitizeTrace(t)));
  });

  it('differs when the program or what it recorded differs', () => {
    const base = traceFingerprint(sanitizeTrace(trace()));
    expect(traceFingerprint(sanitizeTrace(trace({ program: { ...trace().program, version: '2.0' } })))).not.toBe(base);
    expect(traceFingerprint(sanitizeTrace(trace({ files: [] })))).not.toBe(base);
    expect(traceFingerprint(sanitizeTrace(trace({ tasks: [] })))).not.toBe(base);
  });
});

describe('export and import', () => {
  it('exports every trace, or one, with the header', async () => {
    const a = trace({ createdAt: 1 });
    const b = trace({ createdAt: 2, program: { ...trace().program, name: 'Beta' } });
    await saveTrace(a, { root });
    await saveTrace(b, { root });
    const all = await buildTraceFile({ root, now: () => Date.UTC(2026, 9, 24), version: () => '3.1.0' });
    expect(all).toMatchObject({ format: 'prune-install-traces', version: 1, exportedAt: '2026-10-24T00:00:00.000Z', pruneVersion: '3.1.0' });
    expect(all.traces).toEqual([withoutId(b), withoutId(a)]);

    const one = await buildTraceFile({ id: a.id, root, version: () => '3.1.0' });
    expect(one.traces).toEqual([withoutId(a)]);
    expect(await buildTraceFile({ id: newTraceId(), root })).toBeNull();
    expect(await buildTraceFile({ id: '..\\x', root })).toBeNull();
  });

  it('round-trips: what is exported imports back into an empty store as the same traces', async () => {
    const a = trace();
    const b = trace({ program: null, files: [{ path: 'D:\\Portable', isDirectory: true, sizeBytes: 9 }], registry: [], services: [], tasks: [], alsoInstalled: [] });
    await saveTrace(a, { root });
    await saveTrace(b, { root });
    const file = JSON.stringify(await buildTraceFile({ root }));

    const fresh = join(root, 'fresh');
    const summary = await importIt(file, { root: fresh });
    expect(summary).toEqual({ imported: 2, skipped: 0, rejected: 0, notInstalled: 0 });

    const listed = await listTraces({ root: fresh });
    expect(listed).toHaveLength(2);
    for (const item of listed) {
      expect(isTraceId(item.id)).toBe(true);
      expect([a.id, b.id]).not.toContain(item.id);
      expect(item.importedAt).toBe(5);
      const stored = await getTrace(item.id, { root: fresh });
      const original = stored.program ? a : b;
      expect(withoutId({ ...stored, importedAt: undefined })).toEqual({ ...withoutId(original), importedAt: undefined });
    }
  });

  it('skips duplicates of what is here and of what came earlier in the file, and says how many', async () => {
    const a = trace();
    await saveTrace(a, { root });
    const twin = { ...a, id: 'ffffffffffffffff', createdAt: 99 };
    const other = trace({ program: { ...a.program, name: 'Other', key: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\U\\Other', registryKey: 'HKLM:\\SOFTWARE\\U\\Other' } });
    const summary = await importIt(fileOf([twin, other, { ...other, createdAt: 3 }]));
    expect(summary).toEqual({ imported: 1, skipped: 2, rejected: 0, notInstalled: 1 });
    expect(readdirSync(root)).toHaveLength(2);

    // Importing the same file again changes nothing.
    expect(await importIt(fileOf([twin, other]))).toEqual({ imported: 0, skipped: 2, rejected: 0, notInstalled: 0 });
    expect(readdirSync(root)).toHaveLength(2);
  });

  it('counts the traces that do not pass and imports the rest', async () => {
    const summary = await importIt(fileOf([trace(), { version: 1 }, 'x', null, trace({ files: [{ path: '..\\..\\boot.ini', isDirectory: false, sizeBytes: 1 }] })]));
    expect(summary).toEqual({ imported: 1, skipped: 0, rejected: 4, notInstalled: 0 });
  });

  it('never uses the id in the file, so a path-like id names nothing', async () => {
    const outside = join(root, '..', 'victim.json');
    const ids = ['..\\..\\victim', '../victim', 'C:\\Windows\\win', 'victim', 'aaaaaaaaaaaaaaaa'];
    const traces = ids.map((id, i) => trace({ id, program: { ...trace().program, name: `P${i}` } }));
    const store = join(root, 'store');
    const summary = await importIt(fileOf(traces), { root: store });
    expect(summary.imported).toBe(ids.length);
    expect(existsSync(outside)).toBe(false);
    const names = readdirSync(store);
    expect(names).toHaveLength(ids.length);
    for (const name of names) expect(name).toMatch(/^[a-f0-9]{16}\.json$/);
    expect(names).not.toContain('aaaaaaaaaaaaaaaa.json');
  });

  it('relinks imported traces to this PC\'s programs and counts the ones not installed here', async () => {
    const elsewhere = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\AcmeUser';
    const summary = await importIt(fileOf([trace(), trace({ program: { ...trace().program, name: 'Gone' } })]), {
      listPrograms: async () => [{ name: 'Acme', publisher: 'Acme Inc', registryKey: elsewhere }]
    });
    expect(summary).toEqual({ imported: 2, skipped: 0, rejected: 0, notInstalled: 1 });
    const listed = await listTraces({ root });
    expect(listed.find((t) => t.programName === 'Acme').registryKey).toBe(elsewhere);
    // Kept, with the key it was recorded under.
    expect(listed.find((t) => t.programName === 'Gone').registryKey).toBe(trace().program.registryKey);
  });

  it('still imports when the program list cannot be read, without claiming what is installed', async () => {
    const summary = await importIt(fileOf([trace()]), { listPrograms: async () => { throw new Error('no PowerShell'); } });
    expect(summary).toEqual({ imported: 1, skipped: 0, rejected: 0, notInstalled: null });
  });

  it('throws the file\'s problem and saves nothing', async () => {
    await expect(importIt('{nope')).rejects.toMatchObject({ code: 'notJson' });
    await expect(importIt(JSON.stringify({ format: 'x', version: 1, traces: [trace()] }))).rejects.toMatchObject({ code: 'notTraceFile' });
    expect(readdirSync(root)).toEqual([]);
  });

  it('ignores files in the store that are not traces when looking for duplicates', async () => {
    writeFileSync(join(root, 'bad.json'), '{not json');
    writeFileSync(join(root, '0123456789abcdef.json'), '{not json');
    expect((await importIt(fileOf([trace()]))).imported).toBe(1);
  });
});
