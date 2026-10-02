import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  installTraceRoot, saveTrace, listTraces, getTrace, deleteTrace, loadTraceFindings, newTraceId, isTraceId
} from './installTraces.js';

let root;
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'prune-traces-')); });
afterEach(() => { rmSync(root, { recursive: true, force: true }); });

const trace = (overrides = {}) => ({
  id: newTraceId(), version: 1, createdAt: 1000, installer: 'C:\\dl\\setup.exe',
  program: { name: 'Acme', publisher: 'Acme Inc', version: '1.0', installLocation: 'D:\\Acme', registryKey: 'HKLM:\\SOFTWARE\\U\\Acme', key: 'HKEY_LOCAL_MACHINE\\SOFTWARE\\U\\Acme' },
  files: [{ path: 'D:\\Acme', isDirectory: true, sizeBytes: 10 }], registry: [], services: [], tasks: [],
  ...overrides
});

describe('trace ids', () => {
  it('are random hex, and only that shape is accepted', () => {
    const id = newTraceId();
    expect(isTraceId(id)).toBe(true);
    expect(newTraceId()).not.toBe(id);
    for (const bad of ['', '..\\x', '../x', 'abc', 'g'.repeat(16), 5, null, `${id}.json`]) expect(isTraceId(bad), String(bad)).toBe(false);
  });
});

describe('the trace store', () => {
  it('saves a trace as userData/install-traces/<id>.json and reads it back', async () => {
    const t = trace();
    await saveTrace(t, { root });
    expect(readdirSync(root)).toEqual([`${t.id}.json`]);
    expect(await getTrace(t.id, { root })).toEqual(t);
  });

  it('lists a summary of each, newest first', async () => {
    const a = trace({ createdAt: 1 });
    const b = trace({ createdAt: 2, program: { ...trace().program, name: 'Newer' } });
    await saveTrace(a, { root });
    await saveTrace(b, { root });
    const list = await listTraces({ root });
    expect(list.map((t) => t.id)).toEqual([b.id, a.id]);
    expect(list[0]).toMatchObject({ id: b.id, programName: 'Newer', registryKey: 'HKLM:\\SOFTWARE\\U\\Acme', fileCount: 1, createdAt: 2 });
    expect(list[0]).not.toHaveProperty('files');
  });

  it('skips a file it cannot parse rather than failing the list', async () => {
    await saveTrace(trace(), { root });
    writeFileSync(join(root, 'bad.json'), '{not json');
    writeFileSync(join(root, 'notes.txt'), 'x');
    expect(await listTraces({ root })).toHaveLength(1);
  });

  it('is an empty list before anything was ever traced', async () => {
    expect(await listTraces({ root: join(root, 'missing') })).toEqual([]);
  });

  it('deletes a trace and says whether there was one', async () => {
    const t = trace();
    await saveTrace(t, { root });
    expect(await deleteTrace(t.id, { root })).toBe(true);
    expect(existsSync(join(root, `${t.id}.json`))).toBe(false);
    expect(await deleteTrace(t.id, { root })).toBe(false);
  });

  it('never touches a path built from an id that is not an id', async () => {
    const outside = join(root, '..', 'victim.json');
    writeFileSync(outside, '{}');
    try {
      expect(await deleteTrace('..\\victim', { root })).toBe(false);
      expect(await getTrace('../victim', { root })).toBeNull();
      expect(existsSync(outside)).toBe(true);
    } finally {
      rmSync(outside, { force: true });
    }
  });

  it('sits beside the quarantine under the app-data folder', () => {
    process.env.UNREVO_QUARANTINE_ROOT = join(root, 'data', 'quarantine');
    try {
      expect(installTraceRoot()).toBe(join(root, 'data', 'install-traces'));
    } finally {
      delete process.env.UNREVO_QUARANTINE_ROOT;
    }
  });
});

describe('loadTraceFindings', () => {
  it('keeps only what is still on the machine', async () => {
    const present = join(root, 'Present');
    mkdirSync(present);
    writeFileSync(join(present, 'a.bin'), 'abcd');
    const t = trace({
      files: [
        { path: present, isDirectory: true, sizeBytes: 4 },
        { path: join(root, 'Gone'), isDirectory: true, sizeBytes: 9 }
      ],
      registry: [{ path: 'HKEY_CURRENT_USER\\Software\\Acme' }, { path: 'HKEY_CURRENT_USER\\Software\\Gone' }],
      tasks: [{ name: 'AcmeTask', path: '\\' }, { name: 'GoneTask', path: '\\' }],
      services: [{ name: 'AcmeSvc', pathName: 'x' }]
    });
    const runPs = vi.fn(async () => ({
      registry: [{ path: 'HKEY_CURRENT_USER\\Software\\Acme' }],
      tasks: [{ name: 'AcmeTask', path: '\\' }]
    }));
    const found = await loadTraceFindings(t, { runPs });
    expect(found.files).toEqual([{ path: present, sizeBytes: 4 }]);
    expect(found.registry).toEqual([{ path: 'HKEY_CURRENT_USER\\Software\\Acme' }]);
    expect(found.tasks).toEqual([{ name: 'AcmeTask', path: '\\' }]);
    expect(found.services).toEqual([{ name: 'AcmeSvc', displayName: 'AcmeSvc', pathName: 'x' }]);
  });

  it('asks PowerShell only when the trace has registry keys or tasks to check', async () => {
    const runPs = vi.fn();
    await loadTraceFindings(trace(), { runPs });
    expect(runPs).not.toHaveBeenCalled();
  });

  it('still returns the files when the PowerShell check fails', async () => {
    const present = join(root, 'P');
    mkdirSync(present);
    const t = trace({ files: [{ path: present, isDirectory: true, sizeBytes: 1 }], registry: [{ path: 'HKEY_CURRENT_USER\\Software\\A' }] });
    const found = await loadTraceFindings(t, { runPs: async () => { throw new Error('ps failed'); } });
    expect(found.files).toHaveLength(1);
    expect(found.registry).toEqual([]);
  });

  it('is empty for no trace', async () => {
    expect(await loadTraceFindings(null, {})).toEqual({ files: [], registry: [], tasks: [], services: [] });
  });
});
