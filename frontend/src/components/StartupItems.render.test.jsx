// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';
import { isCopyable } from '../testSupport/copyable.js';

/** The Startup screen, rendered.
 *
 * The second-largest component in the app and the only screen besides
 * Applications that CHANGES something on the machine -- it writes to
 * StartupApproved, the same record Task Manager writes. Its helper
 * libraries are covered on their own (groupStartupItems,
 * startupToggleState, the api wrappers); what was not covered is the
 * wiring, and this screen grew three new read-only sources in 2.2.0
 * whose whole correctness lives in that wiring.
 *
 * Mocked at the api layer rather than at the hooks, deliberately. Mocking
 * useStartupItems/useStartupToggle would replace the optimistic update,
 * the rollback and the outcome decision with a stub -- which is most of
 * what is worth testing here. Faking three fetches instead leaves all of
 * that real.
 *
 * `importOriginal` and a spread rather than a bare factory: a factory
 * replaces the WHOLE module, and useSystemQueries imports a great many
 * functions from api.js. Anything not named in the factory would arrive
 * `undefined` and fail at a call site that has nothing to do with this
 * screen.
 */

const fetchStartupItems = vi.fn();
const setStartupItemEnabled = vi.fn();

vi.mock('../lib/api.js', async (importOriginal) => ({
  ...(await importOriginal()),
  fetchStartupItems: (...args) => fetchStartupItems(...args),
  fetchStartupIcons: async () => ({}),
  setStartupItemEnabled: (...args) => setStartupItemEnabled(...args)
}));

const StartupItems = (await import('./StartupItems.jsx')).default;

/* `location` and `rawScope` are on the base fixture because they are what
 * groupStartupItems buckets by -- an entry missing them lands in a group
 * keyed on the empty string, which renders but under a heading no
 * assertion here would recognise. */
const entry = (over = {}) => ({
  id: 'e1',
  name: 'Thing',
  command: 'C:\\Program Files\\Thing\\thing.exe',
  description: 'Thing Launcher',
  publisher: 'Acme',
  location: 'Run',
  rawScope: 'user',
  enabled: true,
  running: false,
  exists: true,
  toggleNote: null,
  ...over
});

/** The real refusal text for a scheduled task, copied from
 * backend/src/services/startupToggle.js. Only the opening clause is
 * asserted on, so rewording the advice does not break this. */
const TASK_NOTE = 'This is a scheduled task. Windows keeps its on/off state on the task itself, '
  + 'not with the sign-in entries — change it in Task Scheduler.';

const rowFor = (name) => screen.getByText(name).closest('div[class*="grid"]');

beforeEach(() => {
  vi.clearAllMocks();
  fetchStartupItems.mockResolvedValue([entry()]);
  setStartupItemEnabled.mockResolvedValue({ ok: true, enabled: false });
});

describe('what can be copied', () => {
  it('the reason the startup entries could not be read', async () => {
    fetchStartupItems.mockRejectedValue(new Error('reg.exe exited with 1'));
    renderScreen(<StartupItems />);
    const message = await screen.findByText(/Couldn't read the startup entries: reg\.exe exited with 1/, {}, { timeout: 5000 });
    expect(isCopyable(message)).toBe(true);
  });

  it('the launch path, but not the entry name', async () => {
    renderScreen(<StartupItems />);
    expect(isCopyable(await screen.findByText('C:\\Program Files\\Thing\\thing.exe'))).toBe(true);
    expect(isCopyable(screen.getByText('Thing'))).toBe(false);
  });

  it('the reason Windows refused a switch', async () => {
    setStartupItemEnabled.mockResolvedValue({ ok: false, error: 'Access is denied.' });
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    await user.click(screen.getByRole('switch'));

    expect(isCopyable(await screen.findByText('Access is denied.'))).toBe(true);
  });
});

describe('the startup list', () => {
  it('lists what the machine reported, and counts it', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'a', name: 'Steam' }),
      entry({ id: 'b', name: 'Discord', enabled: false })
    ]);
    renderScreen(<StartupItems />);

    expect(await screen.findByText('Steam')).toBeTruthy();
    expect(screen.getByText('Discord')).toBeTruthy();
    // "2 entries / 1 enabled" -- the counts sit in their own spans, so
    // each number is matched with its own label rather than as a phrase.
    expect(screen.getByText('2').parentElement.textContent).toMatch(/entries/);
    expect(screen.getByText('1').parentElement.textContent).toMatch(/enabled/);
  });

  it('says plainly when there is nothing, and what was looked at', async () => {
    // An empty list is a real and good outcome on this screen. Without
    // this, "nothing runs at sign-in" is indistinguishable from a screen
    // that failed to load.
    fetchStartupItems.mockResolvedValue([]);
    renderScreen(<StartupItems />);

    expect(await screen.findByText(/Nothing runs at sign-in/)).toBeTruthy();
    expect(screen.getByText(/Run and RunOnce keys/)).toBeTruthy();
  });
});

describe('an entry Prune cannot switch', () => {
  /* The property this file exists for.
   *
   * Three of the sources on this screen -- scheduled tasks, services and
   * Store app startup tasks -- are read-only, and they are new. Every one
   * of them is switched somewhere Prune does not write. A switch on those
   * rows would not fail loudly: it would write a StartupApproved value
   * for a key Windows never reads for that kind of entry, report success,
   * and leave the entry running at sign-in exactly as before. */
  it('offers no switch at all, and says where to change it instead', async () => {
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'task', name: 'OneDrive Reporting Task', source: 'task', toggleNote: TASK_NOTE })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('OneDrive Reporting Task');

    const row = rowFor('OneDrive Reporting Task');
    expect(within(row).queryByRole('switch')).toBeNull();
    expect(within(row).getByText(/This is a scheduled task/)).toBeTruthy();
  });

  it('still shows whether it is on, since that is a fact about the machine', async () => {
    // Read-only is not the same as unknown. The tick stays; only the
    // control goes.
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'task', name: 'Task A', source: 'task', toggleNote: TASK_NOTE, enabled: true }),
      entry({ id: 'task2', name: 'Task B', source: 'task', toggleNote: TASK_NOTE, enabled: false })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('Task A');

    // The enabled one draws the tick polyline; the disabled one draws an
    // empty box. Asserted on the mark itself because that is the only
    // thing separating them once the button is gone.
    expect(rowFor('Task A').querySelector('svg')).toBeTruthy();
    expect(rowFor('Task B').querySelector('svg')).toBeNull();
  });

  it('but a normal Run entry does get one', async () => {
    // Without this, the assertion above is met by a screen that renders
    // no switches at all.
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    expect(within(rowFor('Thing')).getByRole('switch')).toBeTruthy();
  });
});

describe('switching an entry', () => {
  it('asks for the opposite of what the row currently is, by id', async () => {
    // By id and never by name: the same name legitimately appears in both
    // hives, and those are two different entries.
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'hkcu-discord', name: 'Discord', enabled: true }),
      entry({ id: 'hklm-discord', name: 'Discord', rawScope: 'machine', location: 'Run', enabled: false })
    ]);
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findAllByText('Discord');

    const enabledSwitch = screen.getByRole('switch', { name: /Disable Discord/ });
    await user.click(enabledSwitch);

    expect(setStartupItemEnabled).toHaveBeenCalledTimes(1);
    expect(setStartupItemEnabled).toHaveBeenCalledWith('hkcu-discord', false);
  });

  it('moves the row before the machine has answered', async () => {
    // The write spawns PowerShell and a machine-wide entry waits on a UAC
    // prompt, so a switch that only moved on success would sit still for
    // seconds. Held here by a call that never settles.
    setStartupItemEnabled.mockImplementation(() => new Promise(() => {}));
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('false');
    });
  });

  it('puts the row back and says why when Windows refuses', async () => {
    setStartupItemEnabled.mockResolvedValue({ ok: false, error: 'Access is denied.' });
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    await user.click(screen.getByRole('switch'));

    expect(await screen.findByText('Access is denied.')).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });

  it('puts the row back in silence when the user declines the prompt', async () => {
    /* A declined UAC prompt is a decision the user just made, not a
     * failure. The row snapping back IS the message; a red line under it
     * would report their own choice to them as something going wrong.
     *
     * This is the case most likely to regress into the one above, since
     * both arrive at onSettled having not reached the requested state. */
    setStartupItemEnabled.mockResolvedValue({ cancelled: true });
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    await user.click(screen.getByRole('switch'));

    await waitFor(() => {
      expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
    });
    expect(screen.queryByText(/denied|failed|couldn't|error/i)).toBeNull();
  });

  it('follows the machine when it reports a state nobody asked for', async () => {
    // ok: true with the wrong state is exactly what the backend's
    // read-back exists to catch. The row has to follow the machine rather
    // than the click.
    setStartupItemEnabled.mockResolvedValue({ ok: true, enabled: true });
    const user = userEvent.setup();
    renderScreen(<StartupItems />);
    await screen.findByText('Thing');

    await user.click(screen.getByRole('switch'));

    expect(await screen.findByText(/Windows still has this enabled/)).toBeTruthy();
    expect(screen.getByRole('switch').getAttribute('aria-checked')).toBe('true');
  });
});

describe('what the status column says', () => {
  it('calls an entry whose file is gone Invalid, even while it is running', async () => {
    /* Three different facts that a single column would have to merge, and
     * the precedence matters: an entry pointing at a file that is gone is
     * the reason to be on this screen at all. Something else on the
     * machine having started a process of the same name must not hide it
     * behind a green Running pill. */
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'orphan', name: 'Ghost', exists: false, running: true })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('Ghost');

    const row = rowFor('Ghost');
    expect(within(row).getByText('Invalid')).toBeTruthy();
    expect(within(row).queryByText('Running')).toBeNull();
  });

  it('says Not checked rather than guessing for a command resolved through PATH', async () => {
    // `exists: null` is not `exists: false`. Reporting it as Invalid
    // would mark a working entry as a leftover.
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'path', name: 'PathThing', exists: null })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('PathThing');

    const row = rowFor('PathThing');
    expect(within(row).getByText('Not checked')).toBeTruthy();
    expect(within(row).queryByText('Invalid')).toBeNull();
  });
});

describe('the group headings', () => {
  it('warns about administrator on machine-wide groups only', async () => {
    // HKLM cannot be written unelevated, so the switch raises a consent
    // prompt -- worth knowing before it appears rather than after. Said
    // once per group, and only where it is true.
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'u', name: 'UserThing', rawScope: 'user' }),
      entry({ id: 'm', name: 'MachineThing', rawScope: 'machine' })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('MachineThing');

    const warnings = screen.getAllByText(/Changing these asks for administrator/);
    expect(warnings).toHaveLength(1);

    // And it is under the HKLM heading, not the HKCU one -- a single
    // warning in the wrong group would pass a bare count.
    const machineHeading = screen.getByText('Registry: HKLM Run').closest('div');
    expect(within(machineHeading).getByText(/Changing these asks for administrator/)).toBeTruthy();
  });

  it('counts enabled entries per group rather than for the screen', async () => {
    // "3 of 11 enabled" answers a question no row can, and it is per
    // location because that is what decides who an entry affects.
    fetchStartupItems.mockResolvedValue([
      entry({ id: 'u1', name: 'UserOn', rawScope: 'user', enabled: true }),
      entry({ id: 'u2', name: 'UserOff', rawScope: 'user', enabled: false }),
      entry({ id: 'm1', name: 'MachineOn', rawScope: 'machine', enabled: true })
    ]);
    renderScreen(<StartupItems />);
    await screen.findByText('UserOn');

    const userHeading = screen.getByText('Registry: HKCU Run').closest('div');
    expect(within(userHeading).getByText('1 of 2 enabled')).toBeTruthy();

    const machineHeading = screen.getByText('Registry: HKLM Run').closest('div');
    expect(within(machineHeading).getByText('1 of 1 enabled')).toBeTruthy();
  });
});
