import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { decide, classifyButton, normalizeLabel, initialState, HANDOVER, OBSERVER_SCRIPT } from './wizardAutomation.js';

/** The decider: given what the uninstaller's window shows, what to do. It
 * presses only what plainly means "go on", and hands the wizard back for
 * anything that is the person's to answer. */

const button = (id, name, extra = {}) => ({ id, name, automationId: '0', enabled: true, ...extra });
const win = (extra = {}) => ({ hwnd: 1, title: 'Foo Uninstall', className: 'Wizard', enabled: true, cannotControl: false, texts: [], buttons: [], radios: [], checkboxes: [], edits: 0, ...extra });
const step = (windows, state) => decide({ windows }, state);

describe('normalizeLabel / classifyButton', () => {
  it('reads labels the way they look on screen', () => {
    expect(normalizeLabel('&Next >')).toBe('next');
    expect(normalizeLabel('< &Back')).toBe('back');
    expect(normalizeLabel('Uninstall...')).toBe('uninstall');
    expect(normalizeLabel('Save && Exit')).toBe('save & exit');
  });

  it('knows go, stop and neutral words, and the Win32 IDs only in a real dialog', () => {
    expect(classifyButton({ name: 'Uninstall' })).toBe('go');
    expect(classifyButton({ name: 'Restart now' })).toBe('stop');
    expect(classifyButton({ name: 'Show details' })).toBe('neutral');
    expect(classifyButton({ name: 'Ja', automationId: '6' }, '#32770')).toBe('go');
    expect(classifyButton({ name: 'Nein', automationId: '7' }, '#32770')).toBe('stop');
    expect(classifyButton({ name: 'Ja', automationId: '6' }, 'WindowsForms10.Window')).toBe('unknown');
  });
});

describe('decide', () => {
  it('presses Next on an ordinary page and never Cancel', () => {
    const { action } = step([win({ buttons: [button('b', '< Back', { enabled: false }), button('n', '&Next >'), button('c', 'Cancel')] })]);
    expect(action).toMatchObject({ act: 'invoke', id: 'n', label: 'Next' });
  });

  it('prefers the strongest go word when there are several', () => {
    const { action } = step([win({ buttons: [button('n', 'Next'), button('u', 'Uninstall'), button('c', 'Cancel')] })]);
    expect(action.id).toBe('u');
  });

  it('answers a localized message box by its control IDs', () => {
    const { action } = step([win({ className: '#32770', buttons: [button('y', '&Ja', { automationId: '6' }), button('n', '&Nein', { automationId: '7' })] })]);
    expect(action).toMatchObject({ act: 'invoke', id: 'y' });
  });

  it('works on the popup, not the wizard it disabled', () => {
    const wizard = win({ hwnd: 1, enabled: false, buttons: [button('n', 'Next')] });
    const popup = win({ hwnd: 2, className: '#32770', buttons: [button('ok', 'OK', { automationId: '1' })] });
    expect(step([wizard, popup]).action.id).toBe('ok');
  });

  it('waits on a progress page where only Cancel or Show details can be pressed', () => {
    expect(step([win({ buttons: [button('d', 'Show details'), button('c', 'Cancel'), button('n', 'Next', { enabled: false })] })]).action).toEqual({ act: 'wait' });
    expect(step([]).action).toEqual({ act: 'wait' });
  });

  it('waits out a progress page even when its text mentions data', () => {
    expect(step([win({ texts: ['Removing data files and settings...'], buttons: [button('c', 'Cancel')] })]).action).toEqual({ act: 'wait' });
  });

  it('chooses Remove on a modify/repair/remove page before pressing Next', () => {
    const page = win({
      radios: [{ id: 'm', name: 'Modify', checked: true }, { id: 'r', name: 'Repair', checked: false }, { id: 'x', name: 'Remove', checked: false }],
      buttons: [button('n', 'Next >'), button('c', 'Cancel')]
    });
    expect(step([page]).action).toMatchObject({ act: 'select', id: 'x' });
    page.radios[0].checked = false;
    page.radios[2].checked = true;
    expect(step([page]).action).toMatchObject({ act: 'invoke', id: 'n' });
  });

  it('chooses restart later, and unticks restart-now and website boxes', () => {
    const page = win({
      radios: [{ id: 'now', name: 'Yes, restart now', checked: true }, { id: 'later', name: 'No, I will restart later', checked: false }],
      checkboxes: [{ id: 'web', name: 'Visit our website', checked: true }, { id: 'keep', name: 'Create a log file', checked: true }],
      buttons: [button('f', '&Finish')]
    });
    expect(step([page]).action).toMatchObject({ act: 'toggle', id: 'web' });
    page.checkboxes[0].checked = false;
    expect(step([page]).action).toMatchObject({ act: 'select', id: 'later' });
    page.radios[1].checked = true;
    expect(step([page]).action).toMatchObject({ act: 'invoke', id: 'f' });
  });

  it('hands back a question about the person\'s own data or settings', () => {
    const page = win({ texts: ['Do you want to keep your settings and saved games?'], buttons: [button('y', 'Yes'), button('n', 'No')] });
    expect(step([page]).action).toMatchObject({ act: 'handover', reason: HANDOVER.personal, hwnd: 1 });
    const box = win({ checkboxes: [{ id: 'p', name: 'Also remove my preferences', checked: false }], buttons: [button('u', 'Uninstall')] });
    expect(step([box]).action.reason).toBe(HANDOVER.personal);
  });

  it('hands back a page that wants something typed', () => {
    expect(step([win({ edits: 1, buttons: [button('n', 'Next')] })]).action.reason).toBe(HANDOVER.typing);
  });

  it('hands back a button it does not know, even beside one it does', () => {
    expect(step([win({ buttons: [button('n', 'Next'), button('s', 'Send report')] })]).action.reason).toBe(HANDOVER.unknownButton);
    expect(step([win({ buttons: [button('r', 'Retry'), button('i', 'Ignore')] })]).action.reason).toBe(HANDOVER.unknownChoice);
  });

  it('hands back radio choices it cannot read', () => {
    const page = win({ radios: [{ id: 'a', name: 'Typical', checked: true }, { id: 'b', name: 'Custom', checked: false }], buttons: [button('n', 'Next')] });
    expect(step([page]).action.reason).toBe(HANDOVER.unknownChoice);
  });

  it('hands back a window it is not allowed to press (an elevated uninstaller)', () => {
    expect(step([win({ cannotControl: true, buttons: [button('n', 'Next')] })]).action.reason).toBe(HANDOVER.elevated);
  });

  it('gives up on a page that keeps coming back', () => {
    const page = win({ texts: ['Close Foo first.'], buttons: [button('ok', 'OK')] });
    let state = initialState();
    for (let i = 0; i < 3; i += 1) {
      const result = step([page], state);
      expect(result.action.act).toBe('invoke');
      state = result.state;
    }
    expect(step([page], state).action.reason).toBe(HANDOVER.loop);
  });

  it('never mutates the state it was given', () => {
    const state = initialState();
    step([win({ buttons: [button('n', 'Next')] })], state);
    expect(state).toEqual({ presses: 0, seen: {} });
  });
});

describe('the observer script', () => {
  it('parses as PowerShell (nothing is run)', async () => {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const root = mkdtempSync(join(tmpdir(), 'prune-wizard-test-'));
    try {
      const file = join(root, 'observer.ps1');
      writeFileSync(file, OBSERVER_SCRIPT, 'utf8');
      const { stdout } = await promisify(execFile)('powershell', ['-NoProfile', '-NonInteractive', '-Command',
        `$e = $null; [System.Management.Automation.Language.Parser]::ParseFile('${file}', [ref]$null, [ref]$e) | Out-Null; 'errors=' + @($e).Count`], { timeout: 30000 });
      expect(stdout.trim()).toBe('errors=0');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }, 60000);
});
