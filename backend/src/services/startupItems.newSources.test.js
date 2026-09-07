import { describe, it, expect } from 'vitest';
import { normalizeStartupItem, attachEnabledState } from './startupItems.js';

/** The three autorun sources Prune did not read.
 *
 * Revo's Autorun Manager lists 77 things on this machine and Prune listed
 * 15, and the difference was not a bug in the Run-key scan -- it was three
 * whole locations Prune never looked at: scheduled tasks, automatic
 * services, and the startup tasks Windows Store apps register. Measured
 * here: 10, 20 and 10 rows respectively, which takes the screen from 15
 * entries to 55.
 *
 * The header comment used to say scheduled tasks were "deliberately
 * absent -- there are hundreds of them, almost all of them Windows' own,
 * and a list nobody can read is not a feature". That was true of all 202
 * of them and stops being true once Microsoft's own are filtered out by
 * path: 11 remain, and they are all things a person installed.
 */

const task = (over = {}) => ({
  name: 'FanControl',
  key: '\FanControl',
  command: 'C:\Program Files\FanControl\FanControl.exe',
  scope: 'machine',
  location: 'Scheduled task',
  source: 'task',
  enabled: true,
  ...over
});

describe('normalizeStartupItem, for the new sources', () => {
  it('keeps a scheduled task and reads its executable', () => {
    const item = normalizeStartupItem(task());
    expect(item.name).toBe('FanControl');
    expect(item.executable).toBe('C:\Program Files\FanControl\FanControl.exe');
    expect(item.source).toBe('task');
  });

  it('builds the id from the key, so two rows sharing a name stay apart', () => {
    // Real collision on this machine: two distinct services are both
    // displayed as "Gaming Services". Keyed by display name they became
    // one row, which is a duplicate React key AND a toggle that would act
    // on whichever of the two was found first.
    const a = normalizeStartupItem({
      name: 'Gaming Services', key: 'GamingServices',
      command: 'C:\a.exe', scope: 'machine', location: 'Service', source: 'service', enabled: true
    });
    const b = normalizeStartupItem({
      name: 'Gaming Services', key: 'GamingServicesNet',
      command: 'C:\b.exe', scope: 'machine', location: 'Service', source: 'service', enabled: true
    });
    expect(a.id).not.toBe(b.id);
  });

  it('keeps a Windows app startup task even though it has no command', () => {
    // A Store app registers a startup task by package identity; there is
    // no command line anywhere for Prune to read. Dropping rows with no
    // command -- which is what the Run-key reader does, correctly -- would
    // have silently lost all ten of these.
    const item = normalizeStartupItem({
      name: 'Claude', key: 'Claude\ClaudeStartup', command: '',
      scope: 'user', location: 'Windows app', source: 'appx', enabled: true
    });
    expect(item).not.toBeNull();
    expect(item.name).toBe('Claude');
    expect(item.executable).toBeNull();
    // Nothing to check, so nothing is claimed either way.
    expect(item.exists).toBeNull();
  });

  it('still drops a Run-key row with no command at all', () => {
    // The command IS the entry for a Run value. An empty one is malformed,
    // not a different kind of thing.
    expect(normalizeStartupItem({
      name: 'Broken', command: '', scope: 'user', location: 'Run', source: 'registry'
    })).toBeNull();
  });
});

describe('attachEnabledState, for the new sources', () => {
  const approved = {};

  it('keeps the state the source reported rather than looking it up', () => {
    // StartupApproved records Run, Run32 and StartupFolder entries and
    // nothing else. A scheduled task's on/off state lives on the task, and
    // a Store app's lives in its own registry value -- reading either from
    // StartupApproved would report every one of them as enabled.
    const [on] = attachEnabledState([normalizeStartupItem(task({ enabled: true }))], approved);
    const [off] = attachEnabledState([normalizeStartupItem(task({ enabled: false, key: '\Adobe' }))], approved);
    expect(on.enabled).toBe(true);
    expect(off.enabled).toBe(false);
  });

  it('says why each new kind cannot be switched from here', () => {
    // The screen renders an inert tick plus this sentence instead of a
    // control that does nothing. Without a note of its own, each of these
    // would inherit the RunOnce refusal, which says something untrue.
    const kinds = [
      ['task', 'Scheduled task'],
      ['service', 'Service'],
      ['appx', 'Windows app']
    ];
    for (const [source, location] of kinds) {
      const [item] = attachEnabledState(
        [normalizeStartupItem(task({ source, location, key: 'k-' + source }))],
        approved
      );
      expect(item.toggleNote, source).toBeTruthy();
      expect(item.toggleNote, source).not.toMatch(/RunOnce/);
    }
  });

  it('leaves an ordinary Run entry reading StartupApproved as before', () => {
    const run = normalizeStartupItem({
      name: 'Discord', command: 'C:\d.exe', scope: 'user', location: 'Run', source: 'registry'
    });
    const [item] = attachEnabledState([run], {});
    expect(item.toggleNote).toBeNull();
    expect(item.enabled).toBe(true);
  });
});
