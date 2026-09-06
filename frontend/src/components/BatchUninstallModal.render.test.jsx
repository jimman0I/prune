// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen } from '../testSupport/renderScreen.jsx';

/** The batch uninstall, double-clicked.
 *
 * useSingleFlight is unit-tested on its own; this covers the part a unit
 * test cannot, which is that it is actually WIRED to the button. The only
 * thing stopping a second run before it was this button unmounting when
 * setPhase('running') re-rendered -- a rendering side effect standing in
 * for a guard, on a loop that runs a real uninstaller per program.
 */

const streamUninstall = vi.fn();
const scanForLeftovers = vi.fn(async () => ({ files: { items: [] }, registryKeys: { items: [] } }));
const appendHistoryEntry = vi.fn(async () => {});
const removeQuarantined = vi.fn(async () => ({ files: [], registryKeys: [] }));

vi.mock('../lib/api.js', () => ({
  streamUninstall: (...a) => streamUninstall(...a),
  scanForLeftovers: (...a) => scanForLeftovers(...a),
  appendHistoryEntry: (...a) => appendHistoryEntry(...a),
  removeQuarantined: (...a) => removeQuarantined(...a),
  scanForcedUninstall: vi.fn()
}));

const BatchUninstallModal = (await import('./BatchUninstallModal.jsx')).default;

const programs = [
  { id: 'a', name: 'Thing One', publisher: 'Acme', sizeBytes: 1024 },
  { id: 'b', name: 'Thing Two', publisher: 'Acme', sizeBytes: 2048 }
];

beforeEach(() => {
  vi.clearAllMocks();
  streamUninstall.mockImplementation(async () => {});
});

describe('starting a batch uninstall', () => {
  it('runs each program once for a single click', async () => {
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={() => {}} onFinished={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));

    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
    expect(streamUninstall.mock.calls.map((c) => c[0])).toEqual(['a', 'b']);
  });

  // A double-click test lived here and was deleted, because it could not
  // fail. In jsdom React flushes synchronously inside act(), so the
  // button is already unmounted by the time a second click is dispatched
  // -- the click is a no-op with or without the guard, and the test
  // passed just as happily against an unguarded runBatch. It looked like
  // proof and was scenery.
  //
  // The guard itself is covered where it can actually be exercised, in
  // hooks/useSingleFlight.test.js, by calling the wrapped function twice
  // before the first settles. What is left here is what this file can
  // honestly assert: the queue runs each program once, and strictly one
  // at a time.

  it('uninstalls one at a time, never in parallel', async () => {
    // Windows Installer holds a machine-wide mutex, so a second MSI
    // uninstall starting mid-flight simply fails -- the failure would
    // look like the program's fault rather than ours.
    let inFlight = 0;
    let maxConcurrent = 0;
    streamUninstall.mockImplementation(async () => {
      inFlight += 1;
      maxConcurrent = Math.max(maxConcurrent, inFlight);
      await Promise.resolve();
      inFlight -= 1;
    });

    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={() => {}} onFinished={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));

    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
    expect(maxConcurrent).toBe(1);
  });
});
