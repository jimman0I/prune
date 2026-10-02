import { describe, it, expect, vi } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPickerScript, pickPath, PICKER_KINDS } from './filePicker.js';

describe('buildPickerScript', () => {
  it('knows a folder picker and an installer picker', () => {
    expect(PICKER_KINDS).toEqual(['folder', 'installer']);
  });

  it('shows the dialog owned by a topmost form, so it cannot open behind Prune', () => {
    for (const kind of PICKER_KINDS) {
      const script = buildPickerScript(kind);
      expect(script).toContain('TopMost');
      expect(script).toContain('ShowDialog($owner)');
    }
  });

  it('asks the installer picker for programs and installers only', () => {
    const script = buildPickerScript('installer');
    expect(script).toContain('OpenFileDialog');
    expect(script).toMatch(/\*\.exe/);
    expect(script).toMatch(/\*\.msi/);
  });

  it('parses as PowerShell (nothing is run)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'prune-picker-'));
    try {
      for (const kind of PICKER_KINDS) {
        const file = join(dir, `${kind}.ps1`);
        writeFileSync(file, buildPickerScript(kind), 'utf8');
        const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
          `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
        expect(stdout.trim(), kind).toBe('errors=0');
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60000);

  it('rejects a kind it does not know', () => {
    expect(() => buildPickerScript('anything')).toThrow(/kind/);
  });
});

describe('pickPath', () => {
  const dir = mkdtempSync(join(tmpdir(), 'prune-pick-'));
  const folder = join(dir, 'Chosen');
  mkdirSync(folder);
  const exe = join(dir, 'setup.exe');
  writeFileSync(exe, 'x');

  it('returns the chosen folder', async () => {
    const run = vi.fn(async () => folder);
    expect(await pickPath('folder', { run })).toEqual({ path: folder });
  });

  it('returns null when the dialog was cancelled', async () => {
    expect(await pickPath('folder', { run: async () => '' })).toEqual({ path: null });
    expect(await pickPath('folder', { run: async () => null })).toEqual({ path: null });
  });

  it('only returns what exists and is the right kind of thing', async () => {
    expect(await pickPath('folder', { run: async () => join(dir, 'missing') })).toEqual({ path: null });
    expect(await pickPath('folder', { run: async () => exe })).toEqual({ path: null });
    expect(await pickPath('installer', { run: async () => folder })).toEqual({ path: null });
    expect(await pickPath('installer', { run: async () => exe })).toEqual({ path: exe });
  });

  it('refuses a second dialog while one is open', async () => {
    let release;
    const first = pickPath('folder', { run: () => new Promise((resolve) => { release = () => resolve(folder); }) });
    await expect(pickPath('folder', { run: async () => folder })).rejects.toThrow(/already open/i);
    release();
    expect(await first).toEqual({ path: folder });
  });

  it('refuses an unknown kind', async () => {
    await expect(pickPath('anything', { run: async () => folder })).rejects.toThrow(/kind/);
  });
});
