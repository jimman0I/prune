import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WINDOWS_TOOLS, TOOL_GROUPS, isKnownTool, launchPlan, listWindowsTools, launchWindowsTool, toolAvailable, resetToolCache
} from './windowsTools.js';

/** The Windows tools list. Nothing here starts a real tool: the shell host is
 * a fake `exec`, and file existence and protocol checks are injected. */

const SYS = 'C:\\Windows\\System32';
const everything = { exists: () => true, hasProtocol: async () => true, systemDir: SYS };

beforeEach(() => resetToolCache());

/** A fake execFile: records the call and answers with `stdout`. */
function fakeExec(stdout = 'STARTED\r\n', error = null) {
  const calls = [];
  const exec = vi.fn((file, args, options, callback) => {
    calls.push({ file, args, options });
    callback(error, stdout, '');
  });
  return { exec, calls };
}

describe('the allow-list', () => {
  it('is fixed: every id once, every group known, frozen against additions', () => {
    const ids = WINDOWS_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(22);
    for (const tool of WINDOWS_TOOLS) expect(TOOL_GROUPS, tool.id).toContain(tool.group);
    expect(Object.isFrozen(WINDOWS_TOOLS)).toBe(true);
    expect(WINDOWS_TOOLS.every((t) => Object.isFrozen(t))).toBe(true);
    expect(() => WINDOWS_TOOLS.push({ id: 'x' })).toThrow();
  });

  it('knows ids exactly, and nothing that only looks like one', () => {
    expect(isKnownTool('services')).toBe(true);
    for (const junk of ['Services', 'services.msc', 'C:\\Windows\\System32\\cmd.exe', '', null, undefined, 3, ['services'], { id: 'services' }, 'constructor', '__proto__', 'toString']) {
      expect(isKnownTool(junk), String(junk)).toBe(false);
    }
  });

  it('starts each tool from a full System32 path, with fixed arguments', () => {
    expect(launchPlan('services', { systemDir: SYS })).toEqual({ launch: 'open', file: `${SYS}\\services.msc`, args: '', verb: '' });
    expect(launchPlan('systemRestore', { systemDir: SYS }).file).toBe(`${SYS}\\rstrui.exe`);
    expect(launchPlan('programsAndFeatures', { systemDir: SYS })).toEqual({ launch: 'open', file: `${SYS}\\control.exe`, args: 'appwiz.cpl', verb: '' });
    expect(launchPlan('networkConnections', { systemDir: SYS }).args).toBe('ncpa.cpl');
    expect(launchPlan('flushDns', { systemDir: SYS })).toEqual({ launch: 'capture', file: `${SYS}\\ipconfig.exe`, args: '/flushdns', verb: '' });
    expect(launchPlan('windowsSecurity', { systemDir: SYS })).toEqual({ launch: 'uri', file: 'windowsdefender:', args: '', verb: '' });
    expect(launchPlan('nope')).toBeNull();
  });

  it('runs the repair commands elevated, in a console that stays open', () => {
    expect(launchPlan('sfc', { systemDir: SYS })).toEqual({ launch: 'console', file: `${SYS}\\cmd.exe`, args: '/k sfc /scannow', verb: 'RunAs' });
    expect(launchPlan('dism', { systemDir: SYS }).args).toBe('/k DISM /Online /Cleanup-Image /RestoreHealth');
    // Read-only: no /f, nothing repaired or scheduled without being asked.
    expect(launchPlan('chkdsk', { systemDir: SYS }).args).toBe('/k chkdsk %SystemDrive%');
    const elevated = WINDOWS_TOOLS.filter((t) => launchPlan(t.id, { systemDir: SYS }).verb === 'RunAs').map((t) => t.id);
    expect(elevated).toEqual(['sfc', 'dism', 'chkdsk']);
  });

  it('never names a web address or a browser', () => {
    const text = JSON.stringify(WINDOWS_TOOLS);
    expect(text).not.toMatch(/https?:|www\.|\.html?\b|chrome|msedge|firefox|iexplore/i);
  });
});

describe('listWindowsTools', () => {
  it('lists every tool in group order, the ones that may ask for administrator marked', async () => {
    const tools = await listWindowsTools(everything);
    expect(tools).toHaveLength(WINDOWS_TOOLS.length);
    const groups = tools.map((t) => t.group);
    expect(groups).toEqual([...groups].sort((a, b) => TOOL_GROUPS.indexOf(a) - TOOL_GROUPS.indexOf(b)));
    expect(tools.filter((t) => t.elevated).map((t) => t.id)).toEqual(['sfc', 'dism', 'chkdsk', 'flushDns']);
    expect(tools.find((t) => t.id === 'flushDns')).toMatchObject({ kind: 'action', command: 'ipconfig /flushdns' });
    expect(tools.find((t) => t.id === 'sfc').command).toBe('sfc /scannow');
    expect(tools.find((t) => t.id === 'services')).toEqual({ id: 'services', group: 'manage', elevated: false, kind: 'window' });
  });

  it('leaves out a tool whose file is not on this PC -- Group Policy on Home', async () => {
    const exists = (path) => !/gpedit\.msc$/i.test(path);
    const ids = (await listWindowsTools({ ...everything, exists })).map((t) => t.id);
    expect(ids).not.toContain('groupPolicy');
    expect(ids).toContain('services');
  });

  it('needs every file a tool uses, not just the one it opens', async () => {
    const exists = (path) => !/\\sfc\.exe$/i.test(path);
    const ids = (await listWindowsTools({ ...everything, exists })).map((t) => t.id);
    expect(ids).not.toContain('sfc');
    expect(ids).toContain('dism');
  });

  it('offers Windows Security only where its protocol is registered, and asks once', async () => {
    const hasProtocol = vi.fn(async () => false);
    expect((await listWindowsTools({ ...everything, hasProtocol })).map((t) => t.id)).not.toContain('windowsSecurity');
    await listWindowsTools({ ...everything, hasProtocol });
    expect(hasProtocol).toHaveBeenCalledTimes(1);
    expect(hasProtocol).toHaveBeenCalledWith('windowsdefender');
  });

  it.runIf(process.platform === 'win32')('reads the real System32 of this machine: the tools every Windows has are there', async () => {
    const ids = (await listWindowsTools()).map((t) => t.id);
    for (const id of ['sfc', 'services', 'eventViewer', 'deviceManager', 'programsAndFeatures', 'flushDns']) {
      expect(ids, id).toContain(id);
    }
  });
});

describe('launchWindowsTool', () => {
  it('refuses an unknown id without starting anything', async () => {
    const { exec } = fakeExec();
    expect(await launchWindowsTool('regedit', { exec, ...everything })).toMatchObject({ ok: false, unknown: true });
    expect(await launchWindowsTool({ id: 'services' }, { exec, ...everything })).toMatchObject({ ok: false, unknown: true });
    expect(exec).not.toHaveBeenCalled();
  });

  it('refuses a listed tool that is not on this PC', async () => {
    const { exec } = fakeExec();
    expect(await launchWindowsTool('groupPolicy', { exec, ...everything, exists: () => false })).toMatchObject({ ok: false, missing: true });
    expect(exec).not.toHaveBeenCalled();
  });

  it('opens through the shell with the values in environment variables, never in the script', async () => {
    const { exec, calls } = fakeExec();
    expect(await launchWindowsTool('services', { exec, ...everything })).toEqual({ ok: true });
    const [{ file, args, options }] = calls;
    expect(file).toBe('powershell.exe');
    expect(args.join(' ')).not.toContain('services.msc');
    expect(args.at(-1)).toContain('Start-Process @start');
    expect(options.env).toMatchObject({ PRUNE_TOOL_FILE: `${SYS}\\services.msc`, PRUNE_TOOL_ARGS: '', PRUNE_TOOL_VERB: '' });
    expect(options.windowsHide).toBe(true);
  });

  it('asks for elevation for a console tool, and a declined prompt is an ordinary answer', async () => {
    const { exec, calls } = fakeExec('CANCELLED\r\n');
    expect(await launchWindowsTool('sfc', { exec, ...everything })).toEqual({ ok: false, cancelled: true });
    expect(calls[0].options.env).toMatchObject({ PRUNE_TOOL_FILE: `${SYS}\\cmd.exe`, PRUNE_TOOL_ARGS: '/k sfc /scannow', PRUNE_TOOL_VERB: 'RunAs' });
  });

  it('passes a failure on in words', async () => {
    const { exec } = fakeExec('FAILED This command cannot be run.\r\n');
    expect(await launchWindowsTool('onScreenKeyboard', { exec, ...everything })).toEqual({ ok: false, error: 'This command cannot be run.' });
  });

  it('runs Flush DNS hidden and, when that works, never asks for administrator', async () => {
    const ok = fakeExec('Successfully flushed the DNS Resolver Cache.');
    const elevate = vi.fn();
    expect(await launchWindowsTool('flushDns', { exec: ok.exec, elevate, ...everything })).toEqual({ ok: true });
    expect(ok.calls[0]).toMatchObject({ file: `${SYS}\\ipconfig.exe`, args: ['/flushdns'] });
    expect(ok.calls[0].options.windowsHide).toBe(true);
    expect(elevate).not.toHaveBeenCalled();
  });

  it('runs Flush DNS once more elevated when Windows refuses it, behind one UAC dialog', async () => {
    const refused = fakeExec('The requested operation requires elevation.', new Error('exit 1'));
    const elevate = vi.fn(async () => ({ ok: true, data: { code: 0 } }));
    expect(await launchWindowsTool('flushDns', { exec: refused.exec, elevate, ...everything })).toEqual({ ok: true });
    expect(elevate).toHaveBeenCalledTimes(1);
    expect(elevate.mock.calls[0][0]).toMatch(/ipconfig\.exe'\) \/flushdns/);

    expect(await launchWindowsTool('flushDns', { exec: refused.exec, elevate: async () => ({ ok: false, cancelled: true }), ...everything }))
      .toEqual({ ok: false, cancelled: true });
    expect(await launchWindowsTool('flushDns', { exec: refused.exec, elevate: async () => ({ ok: true, data: { code: 1 } }), ...everything }))
      .toEqual({ ok: false, error: 'The requested operation requires elevation.' });
    expect(await launchWindowsTool('flushDns', { exec: refused.exec, elevate: async () => ({ ok: false, error: 'No temp folder.' }), ...everything }))
      .toEqual({ ok: false, error: 'No temp folder.' });
  });
});

describe('toolAvailable', () => {
  it('treats a protocol check that throws as not registered', async () => {
    const tool = WINDOWS_TOOLS.find((t) => t.id === 'windowsSecurity');
    expect(await toolAvailable(tool, { ...everything, hasProtocol: async () => { throw new Error('reg.exe missing'); } })).toBe(false);
  });
});
