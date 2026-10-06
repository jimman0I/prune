import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildRegistryScript, normalizeRegistryItems, isProtectedKey, SHARED_DLL_ROOTS
} from './registryLeftovers.js';

const execFileAsync = promisify(execFile);

/** The SharedDLLs pass and the extra Run-type roots Revo's leftover scan reads.
 *
 * SharedDLLs lives in HKLM, which a test cannot write without elevation, so
 * the script takes its roots as a parameter and this points it at a throwaway
 * HKCU key with the same shape: value name = a file's full path, data = a
 * count. Real PowerShell, real registry, removed again afterwards. */
const MARKER = 'PruneSharedFixture4471';
const ROOT_KEY = `HKCU\\Software\\${MARKER}Root`;
const ROOT_PS = `HKCU:\\Software\\${MARKER}Root`;
const GONE = `C:\\nowhere\\${MARKER}\\gone.dll`;
const PRESENT = join(tmpdir(), `${MARKER}-present.dll`);
const UNRELATED_GONE = 'C:\\nowhere\\SomethingElse\\other.dll';

const reg = (args) => execFileAsync('reg', args, { timeout: 15000 });

beforeAll(async () => {
  writeFileSync(PRESENT, 'x');
  for (const name of [GONE, PRESENT, UNRELATED_GONE]) {
    await reg(['add', ROOT_KEY, '/v', name, '/t', 'REG_DWORD', '/d', '1', '/f']);
  }
}, 60000);

afterAll(async () => {
  rmSync(PRESENT, { force: true });
  await reg(['delete', ROOT_KEY, '/f']).catch(() => {});
}, 60000);

async function scan(pattern, options) {
  const { stdout, stderr } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', buildRegistryScript(pattern, options)],
    { timeout: 90000, maxBuffer: 32 * 1024 * 1024 }
  );
  const trimmed = stdout.trim();
  const parsed = trimmed ? JSON.parse(trimmed) : null;
  return { stderr, items: normalizeRegistryItems(parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : []) };
}

describe('SharedDLLs leftovers', () => {
  it('offers a reference count for a file that is gone, one value at a time', async () => {
    const { stderr, items } = await scan(MARKER, { sharedDllRoots: [ROOT_PS] });
    expect(stderr).toBe('');
    const hit = items.find((i) => i.valueName === GONE);
    expect(hit, 'the count for the missing DLL').toBeTruthy();
    expect(hit.path.toUpperCase()).toContain(`${MARKER}ROOT`.toUpperCase());
  });

  it('leaves a count alone when the file is still on disk', async () => {
    // A shared DLL that exists may be in use by another program; matching on
    // the name alone is not enough to say its count is stale.
    const { items } = await scan(MARKER, { sharedDllRoots: [ROOT_PS] });
    expect(items.find((i) => i.valueName === PRESENT)).toBeUndefined();
  });

  it('never offers a count that does not match the program', async () => {
    const { items } = await scan(MARKER, { sharedDllRoots: [ROOT_PS] });
    expect(items.find((i) => i.valueName === UNRELATED_GONE)).toBeUndefined();
  });

  it('treats a count under the program\'s own folder as anchored, whether or not the file exists', async () => {
    const { items } = await scan('(?!)', { sharedDllRoots: [ROOT_PS], anchors: [`C:\\nowhere\\${MARKER}`] });
    const hit = items.find((i) => i.valueName === GONE);
    expect(hit?.anchored).toBe(true);
  });

  it('keeps the real SharedDLLs containers protected: only their values may be offered', () => {
    for (const root of SHARED_DLL_ROOTS) expect(isProtectedKey(root)).toBe(true);
  });
});

describe('the extra Run-type roots', () => {
  const POLICY_RUN = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Policies\\Explorer\\Run';

  it('protects the policy Run key and RunServices from whole-key deletion', () => {
    expect(isProtectedKey(POLICY_RUN)).toBe(true);
    expect(isProtectedKey('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServices')).toBe(true);
    expect(isProtectedKey('HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServicesOnce')).toBe(true);
  });

  it('reads them in the scan script, quoted', () => {
    const script = buildRegistryScript('x');
    expect(script).toContain(`'${POLICY_RUN}'`);
    expect(script).toContain("'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunServices'");
  });
});
