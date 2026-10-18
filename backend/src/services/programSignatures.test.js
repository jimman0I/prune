import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  signatureFileFor, signatureStatus, signerName, buildSignatureScript, readSignatures,
  resolveSignatures, clearSignatureCache
} from './programSignatures.js';

describe('signatureStatus', () => {
  it('reduces Windows\' words to valid, unsigned and broken, and nothing else', () => {
    expect(signatureStatus('Valid')).toBe('valid');
    expect(signatureStatus('NotSigned')).toBe('unsigned');
    expect(signatureStatus('HashMismatch')).toBe('broken');
    expect(signatureStatus('NotTrusted')).toBe('broken');
    expect(signatureStatus('NotSupportedFileFormat')).toBeNull();
    expect(signatureStatus('UnknownError')).toBeNull();
  });
});

describe('signerName', () => {
  it('takes the common name, quoted or not, and falls back to the organisation', () => {
    expect(signerName('CN=Microsoft Corporation, O=Microsoft Corporation, L=Redmond, S=Washington, C=US')).toBe('Microsoft Corporation');
    expect(signerName('CN="Riot Games, Inc.", O="Riot Games, Inc.", C=US')).toBe('Riot Games, Inc.');
    expect(signerName('O=Example Ltd, C=GB')).toBe('Example Ltd');
    expect(signerName(undefined)).toBe('');
  });
});

describe('signatureFileFor', () => {
  const none = async () => null;

  it('prefers the executable the vendor named as its icon', async () => {
    const program = { name: 'Thing', displayIcon: 'C:\\Program Files\\Thing\\thing.exe,0', uninstallString: '"C:\\Program Files\\Thing\\unins000.exe"' };
    expect(await signatureFileFor(program, { findExecutable: none })).toBe('C:\\Program Files\\Thing\\thing.exe');
  });

  it('then the main executable in the program\'s folder, then its uninstaller', async () => {
    const found = async () => 'C:\\Apps\\Thing\\thing.exe';
    expect(await signatureFileFor({ name: 'Thing', installLocation: 'C:\\Apps\\Thing', uninstallString: '"C:\\Apps\\Thing\\u.exe"' }, { findExecutable: found })).toBe('C:\\Apps\\Thing\\thing.exe');
    expect(await signatureFileFor({ name: 'Thing', uninstallString: '"C:\\Apps\\Thing\\u.exe" /S' }, { findExecutable: none })).toBe('C:\\Apps\\Thing\\u.exe');
  });

  it('never asks about a launcher or one of Windows\' own tools', async () => {
    expect(await signatureFileFor({ name: 'Game', uninstallString: '"C:\\Program Files (x86)\\Steam\\steam.exe" steam://uninstall/480' }, { findExecutable: none })).toBeNull();
    expect(await signatureFileFor({ name: 'Msi', uninstallString: 'MsiExec.exe /X{GUID}' }, { findExecutable: none })).toBeNull();
    expect(await signatureFileFor({ name: 'Drv', uninstallString: '"C:\\WINDOWS\\SysWOW64\\RunDll32.EXE" "C:\\x\\NVI2.DLL",UninstallPackage' }, { findExecutable: none })).toBeNull();
  });
});

describe('readSignatures', () => {
  it('splits the files across PowerShell runs and reads each answer', async () => {
    const paths = Array.from({ length: 65 }, (_, i) => `C:\\p\\${i}.exe`);
    const run = vi.fn(async (script) => {
      const inScript = paths.filter((p) => script.includes(`'${p}'`));
      return inScript.map((p, i) => ({ path: p, status: i % 2 ? 'Valid' : 'NotSigned', subject: 'CN=Vendor, O=Vendor' }));
    });
    const result = await readSignatures(paths, { run });
    expect(run).toHaveBeenCalledTimes(3);
    expect(Object.keys(result)).toHaveLength(65);
    expect(result['C:\\p\\1.exe']).toEqual({ status: 'valid', signer: 'Vendor' });
    expect(result['C:\\p\\0.exe']).toEqual({ status: 'unsigned' });
  });

  it('keeps going when one run fails, and quotes paths as literals', async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error('boom')).mockResolvedValue([]);
    expect(await readSignatures(Array.from({ length: 40 }, (_, i) => `C:\\${i}.exe`), { run })).toEqual({});
    expect(buildSignatureScript(["C:\\Bob's\\a.exe"])).toContain("'C:\\Bob''s\\a.exe'");
  });
});

describe('resolveSignatures', () => {
  let dir;
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'prune-sig-')); clearSignatureCache(); });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('answers per program, asks about a shared file once, and remembers it until the file changes', async () => {
    const exe = join(dir, 'app.exe');
    writeFileSync(exe, 'v1');
    const programs = [{ id: 'a', name: 'A', uninstallString: `"${exe}"` }, { id: 'b', name: 'B', uninstallString: `"${exe}" /x` }];
    const read = vi.fn(async (paths) => Object.fromEntries(paths.map((p) => [p, { status: 'valid', signer: 'Vendor' }])));
    const findExecutable = async () => null;

    expect(await resolveSignatures(programs, { read, findExecutable })).toEqual({ a: { status: 'valid', signer: 'Vendor' }, b: { status: 'valid', signer: 'Vendor' } });
    expect(read).toHaveBeenCalledWith([exe]);

    await resolveSignatures(programs, { read, findExecutable });
    expect(read).toHaveBeenCalledTimes(1);

    writeFileSync(exe, 'version two, a different size');
    await resolveSignatures(programs, { read, findExecutable });
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('leaves out a program whose file is gone', async () => {
    const read = vi.fn(async () => ({}));
    expect(await resolveSignatures([{ id: 'x', name: 'X', uninstallString: `"${join(dir, 'gone.exe')}"` }], { read, findExecutable: async () => null })).toEqual({});
    expect(read).not.toHaveBeenCalled();
  });
});

describe('the script', () => {
  it('runs against a real file and gets an answer from Windows', async () => {
    const { runPowerShellJson } = await import('./powershell.js');
    // PowerShell itself rather than Notepad: the build runner's Windows
    // Server image has no notepad.exe in System32, and this test runs
    // through powershell.exe, so it is always there.
    const file = join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    // A PowerShell 7 module path, as the GitHub runner sets it and as a
    // PowerShell 7 terminal does: inherited raw, it stops Windows PowerShell
    // loading the module Get-AuthenticodeSignature lives in, and the answer
    // was silently empty. services/powershell.js now starts it without it.
    const saved = process.env.PSModulePath;
    process.env.PSModulePath = 'C:\\Program Files\\PowerShell\\Modules;c:\\program files\\powershell\\7\\Modules';
    try {
      const rows = await runPowerShellJson(buildSignatureScript([file]), { timeoutMs: 60000 });
      const row = Array.isArray(rows) ? rows[0] : rows;
      expect(['Valid', 'NotSigned']).toContain(row?.status);
    } finally {
      if (saved === undefined) delete process.env.PSModulePath; else process.env.PSModulePath = saved;
    }
  }, 60000);
});
