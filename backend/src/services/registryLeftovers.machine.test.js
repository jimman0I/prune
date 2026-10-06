import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  buildRegistryScript, normalizeRegistryItems, isProtectedKey,
  FIREWALL_RULE_ROOTS, MSCONFIG_STARTUP_ROOTS, EVENT_LOG_ROOTS
} from './registryLeftovers.js';

const execFileAsync = promisify(execFile);

/** Firewall rules, MSConfig's disabled-startup records and Event Log sources:
 * the three machine-wide places Revo's leftover scan reads that Prune did not.
 *
 * All three live in HKLM, which a test cannot write without elevation, so the
 * script takes the roots as options and this points each at a throwaway HKCU
 * key of the same shape. Real PowerShell, real registry, removed afterwards. */
const MARK = 'PruneMachineFixture5521';
// Under Console, not Software: the scan's generic Software passes would
// otherwise also see these fixtures (and flag the root key, named for the mark).
const FW = 'HKCU\\Console\\PruneFxFw';
const MSC = 'HKCU\\Console\\PruneFxMsconfig';
const EVT = 'HKCU\\Console\\PruneFxEventLog';
const ps = (key) => key.replace('HKCU\\', 'HKCU:\\');
const OWN = `C:\\nowhere\\${MARK}`;
const PRESENT = join(tmpdir(), `${MARK}-present.exe`);

const reg = (args) => execFileAsync('reg', args, { timeout: 15000 });
const add = (key, name, data) => reg(['add', key, '/v', name, '/t', 'REG_SZ', '/d', data, '/f']);
const rule = (app, name) => `v2.31|Action=Allow|Active=TRUE|Dir=In|Protocol=6|App=${app}|Name=${name}|`;

beforeAll(async () => {
  writeFileSync(PRESENT, 'x');
  // Firewall rules: one in the program's folder, one that only matches by name
  // (its exe is gone), one that matches by name but whose exe still exists, and
  // one that has nothing to do with the program.
  await add(FW, '{A-anchored}', rule(`${OWN}\\app.exe`, 'Some app'));
  await add(FW, '{B-name-gone}', rule('C:\\nowhere\\elsewhere\\y.exe', `${MARK} helper`));
  await add(FW, '{C-name-present}', rule(PRESENT, `${MARK} present`));
  await add(FW, '{D-unrelated}', rule('C:\\nowhere\\unrelated\\z.exe', 'Unrelated'));
  // MSConfig: a record named for the program, one whose command is in its
  // folder, and an unrelated one.
  await add(`${MSC}\\${MARK} entry`, 'command', 'C:\\nowhere\\named\\run.exe');
  await add(`${MSC}\\SomethingElse`, 'command', `${OWN}\\run.exe`);
  await add(`${MSC}\\Unrelated`, 'command', 'C:\\nowhere\\unrelated\\run.exe');
  // Event Log sources: message file gone (by name), message file present,
  // message file in the program's folder, unrelated.
  await add(`${EVT}\\${MARK}Stale`, 'EventMessageFile', 'C:\\nowhere\\gone\\msg.dll');
  await add(`${EVT}\\${MARK}Live`, 'EventMessageFile', PRESENT);
  await add(`${EVT}\\InOwnFolder`, 'EventMessageFile', `${OWN}\\msg.dll`);
  await add(`${EVT}\\Unrelated`, 'EventMessageFile', 'C:\\nowhere\\unrelated\\msg.dll');
}, 60000);

afterAll(async () => {
  rmSync(PRESENT, { force: true });
  for (const key of [FW, MSC, EVT]) await reg(['delete', key, '/f']).catch(() => {});
}, 60000);

async function scan(options) {
  const roots = { firewallRoots: [ps(FW)], msconfigRoots: [ps(MSC)], eventLogRoots: [ps(EVT)] };
  const { stdout, stderr } = await execFileAsync(
    'powershell',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', buildRegistryScript(MARK, { ...roots, ...options })],
    { timeout: 90000, maxBuffer: 32 * 1024 * 1024 }
  );
  const trimmed = stdout.trim();
  const parsed = trimmed ? JSON.parse(trimmed) : null;
  return { stderr, items: normalizeRegistryItems(parsed ? (Array.isArray(parsed) ? parsed : [parsed]) : []) };
}
const values = (items, root) => items.filter((i) => i.path.toUpperCase().includes(root.split('\\').pop().toUpperCase())).map((i) => i.valueName);
const keys = (items, root) => items
  .filter((i) => !i.valueName && i.path.toUpperCase().includes(root.split('\\').pop().toUpperCase()))
  .map((i) => i.path.split('\\').pop());

describe('firewall rules', () => {
  it('offers a rule whose program is in the program\'s own folder, in every mode', async () => {
    const { stderr, items } = await scan({ anchors: [OWN] });
    expect(stderr).toBe('');
    expect(values(items, FW)).toEqual(['{A-anchored}']);
    expect(items.find((i) => i.valueName === '{A-anchored}').anchored).toBe(true);
  });

  it('adds the by-name match only in Advanced, and only when the program is gone', async () => {
    const { items } = await scan({ advanced: true, anchors: [OWN] });
    expect(values(items, FW).sort()).toEqual(['{A-anchored}', '{B-name-gone}']);
    // the rule for an executable that still exists, and the unrelated one, are never offered
    expect(values(items, FW)).not.toContain('{C-name-present}');
    expect(values(items, FW)).not.toContain('{D-unrelated}');
  });
});

describe('MSConfig startup records', () => {
  it('takes the whole subkey, by name or by a command in the program\'s folder', async () => {
    const { stderr, items } = await scan({ anchors: [OWN] });
    expect(stderr).toBe('');
    expect(keys(items, MSC).sort()).toEqual([`${MARK} entry`, 'SomethingElse'].sort());
    expect(keys(items, MSC)).not.toContain('Unrelated');
  });
});

describe('Event Log sources', () => {
  it('are left alone outside Advanced', async () => {
    const { items } = await scan({ anchors: [OWN] });
    expect(keys(items, EVT)).toEqual([]);
  });

  it('offers a stale source by name and one whose message file is in the program\'s folder', async () => {
    const { items } = await scan({ advanced: true, anchors: [OWN] });
    expect(keys(items, EVT).sort()).toEqual([`${MARK}Stale`, 'InOwnFolder'].sort());
    // a source whose message file still exists is in use, whatever it is called
    expect(keys(items, EVT)).not.toContain(`${MARK}Live`);
    expect(keys(items, EVT)).not.toContain('Unrelated');
  });
});

describe('protection', () => {
  it('never offers the containers themselves, or Services as a whole', () => {
    for (const root of [...FIREWALL_RULE_ROOTS, ...MSCONFIG_STARTUP_ROOTS, ...EVENT_LOG_ROOTS]) {
      expect(isProtectedKey(root)).toBe(true);
    }
    expect(isProtectedKey('HKLM:\\System\\CurrentControlSet\\Services')).toBe(true);
    expect(isProtectedKey('HKLM:\\System\\CurrentControlSet\\Services\\EventLog')).toBe(true);
  });
});
