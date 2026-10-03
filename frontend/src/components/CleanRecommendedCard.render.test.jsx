// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderScreen, makeTestClient } from '../testSupport/renderScreen.jsx';
import { APP_VERSION } from '../lib/appVersion.js';
import { scanFingerprint, saveScanCache, loadScanCache } from '../lib/deepCleanScanCache.js';

/** The Dashboard's one-click Clean recommended. These pin what a person would
 * notice: it never removes anything on the first click, it says the total and
 * the destination before it does, it measures first when Deep Clean has no
 * remembered scan, it never takes a rule that loses data, and it keeps the
 * Moved / Freed honesty of Deep Clean's own result. */

const streamDeepCleanExecute = vi.fn();
const fetchDeepCleanRules = vi.fn();
const streamDeepCleanScan = vi.fn();
let settingsRecord = null;
const fetchSettings = vi.fn(async () => settingsRecord);
const updateSettings = vi.fn(async (partial) => {
  settingsRecord = { ...settingsRecord, ...partial };
  return settingsRecord;
});

vi.mock('../lib/api.js', () => ({
  fetchDeepCleanRules: (...a) => fetchDeepCleanRules(...a),
  streamDeepCleanScan: (...a) => streamDeepCleanScan(...a),
  streamDeepCleanExecute: (...a) => streamDeepCleanExecute(...a),
  fetchSettings: (...a) => fetchSettings(...a),
  updateSettings: (...a) => updateSettings(...a)
}));

const CleanRecommendedCard = (await import('./CleanRecommendedCard.jsx')).default;

const MB = 1024 * 1024;
const RULES = [{
  category: 'Windows',
  items: [
    { id: 'temp', name: 'Temporary files', category: 'Windows', paths: ['%TEMP%'], sizeBytes: null, present: true, recommended: true },
    { id: 'logs', name: 'Log files', category: 'Windows', paths: ['%LOGS%'], sizeBytes: null, present: true, recommended: true },
    { id: 'thumbs', name: 'Thumbnail cache', category: 'Windows', paths: ['%THUMBS%'], sizeBytes: null, present: true },
    { id: 'cookies', name: 'Cookies', category: 'Windows', paths: ['%COOKIES%'], sizeBytes: null, present: true, recommended: true, risky: true }
  ]
}];

const SIZES = { temp: 5 * MB, logs: 3 * MB, thumbs: 2 * MB, cookies: 1 * MB };

const baseSettings = () => ({
  excludeFolders: [], excludeExtensions: [], hideUnavailableRules: false, skipRecentHours: 24
});

function seedCache({ settings = settingsRecord, savedAt = Date.now() - 3 * 60 * 60 * 1000 } = {}) {
  const tree = [{
    category: 'Windows',
    items: Object.entries(SIZES).map(([id, sizeBytes]) => ({ id, sizeBytes, fileCount: 2, present: true, accessible: true }))
  }];
  const fingerprint = scanFingerprint({ settings, rules: RULES, appVersion: APP_VERSION });
  expect(saveScanCache({ tree, fingerprint, savedAt })).toBe(true);
}

const render = (props = {}, options) => renderScreen(<CleanRecommendedCard armDelayMs={0} {...props} />, options);
const button = (name) => screen.getByRole('button', { name });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  settingsRecord = baseSettings();
  fetchDeepCleanRules.mockResolvedValue(RULES);
  streamDeepCleanScan.mockImplementation(async (onEvent) => {
    onEvent('start', { total: 4 });
    for (const [id, sizeBytes] of Object.entries(SIZES)) {
      onEvent('rule', { id, category: 'Windows', sizeBytes, fileCount: 2, present: true, accessible: true });
    }
  });
  streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
    onEvent('start', { total: ids.length });
    for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', movedBytes: SIZES[id], quarantineBatch: `C:\\q\\${id}`, skipped: [] });
  });
});

describe('with no remembered scan', () => {
  it('says it will measure first, and measures nothing until asked', async () => {
    render();
    expect(await screen.findByText('Nothing has been measured yet. Prune measures first, then asks before it cleans.')).toBeTruthy();
    await waitFor(() => expect(button('Measure and review').disabled).toBe(false));
    await new Promise((r) => setTimeout(r, 30));
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
    expect(streamDeepCleanExecute).not.toHaveBeenCalled();
  });

  it('measures on the click, then asks with the total and the destination, and cleans nothing yet', async () => {
    const user = userEvent.setup();
    render();
    await waitFor(() => expect(button('Measure and review').disabled).toBe(false));
    await user.click(button('Measure and review'));

    // 5 MB + 3 MB: the two recommended rules that do not lose data.
    expect((await screen.findByTestId('clean-recommended-prompt')).textContent).toBe('Move 8 MB to Quarantine?');
    expect(screen.getByTestId('clean-recommended-mode').textContent).toBe('Moves to Quarantine.');
    expect(streamDeepCleanScan).toHaveBeenCalledTimes(1);
    expect(streamDeepCleanExecute).not.toHaveBeenCalled();
    // A fresh measurement carries no "from the last scan" note.
    expect(screen.queryByTestId('clean-recommended-cache-note')).toBeNull();
  });

  it('remembers what it measured, so Deep Clean opens on it', async () => {
    const user = userEvent.setup();
    render();
    await waitFor(() => expect(button('Measure and review').disabled).toBe(false));
    await user.click(button('Measure and review'));
    await screen.findByTestId('clean-recommended-prompt');
    expect(loadScanCache()?.rules.temp?.sizeBytes).toBe(5 * MB);
  });

  it('says so when the measurement turns out to be nothing worth cleaning', async () => {
    const user = userEvent.setup();
    streamDeepCleanScan.mockImplementation(async (onEvent) => {
      onEvent('start', { total: 4 });
      for (const id of Object.keys(SIZES)) onEvent('rule', { id, category: 'Windows', sizeBytes: 0, fileCount: 0, present: true, accessible: true });
    });
    render();
    await waitFor(() => expect(button('Measure and review').disabled).toBe(false));
    await user.click(button('Measure and review'));
    expect(await screen.findByText('Nothing recommended needs cleaning right now.')).toBeTruthy();
    expect(screen.queryByTestId('clean-recommended-prompt')).toBeNull();
  });

  it('asks nothing when the measurement is stopped', async () => {
    const user = userEvent.setup();
    streamDeepCleanScan.mockImplementation((onEvent, signal) => new Promise((_, reject) => {
      onEvent('start', { total: 4 });
      signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    }));
    render();
    await waitFor(() => expect(button('Measure and review').disabled).toBe(false));
    await user.click(button('Measure and review'));
    await user.click(await screen.findByRole('button', { name: 'Stop' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Stop' })).toBeNull());
    expect(screen.queryByTestId('clean-recommended-prompt')).toBeNull();
    expect(button('Measure and review')).toBeTruthy();
  });
});

describe('with a remembered scan', () => {
  it('shows the total and when it was measured, and does not scan', async () => {
    seedCache();
    render();
    expect(await screen.findByText('Can be cleaned: 8 MB')).toBeTruthy();
    expect(screen.getByText('Across 2 recommended cleaners', { exact: false })).toBeTruthy();
    expect(screen.getByTestId('clean-recommended-last-measured').textContent).toContain('Last measured: 3 hours ago');
    expect(screen.getByTestId('clean-recommended-mode').textContent).toBe('Moves to Quarantine.');
    await new Promise((r) => setTimeout(r, 30));
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('asks first, and says the sizes are from the last scan', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    expect(screen.getByTestId('clean-recommended-prompt').textContent).toBe('Move 8 MB to Quarantine?');
    expect(screen.getByTestId('clean-recommended-cache-note').textContent)
      .toBe('Sizes are from the last scan. Each item is checked again as it is cleaned.');
    expect(streamDeepCleanExecute).not.toHaveBeenCalled();
  });

  it('puts keyboard focus on Cancel, the safe choice, when the question opens', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    expect(document.activeElement).toBe(button('Cancel'));
  });

  it('cancels without cleaning, and returns focus to the first button', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Cancel'));
    expect(streamDeepCleanExecute).not.toHaveBeenCalled();
    expect(screen.queryByTestId('clean-recommended-prompt')).toBeNull();
    expect(document.activeElement).toBe(button('Review and clean'));
  });

  it('cleans only the recommended rules that do not lose data, from the shown plan', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Move to Quarantine'));
    await waitFor(() => expect(streamDeepCleanExecute).toHaveBeenCalledTimes(1));
    expect(streamDeepCleanExecute.mock.calls[0][0]).toEqual(['temp', 'logs']);
    expect(streamDeepCleanScan).not.toHaveBeenCalled();
  });

  it('reports Moved, not Freed, for what went to Quarantine, and offers the way to empty it', async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();
    seedCache();
    render({ onNavigate });
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Move to Quarantine'));

    const result = await screen.findByTestId('clean-recommended-result');
    expect(result.textContent).toBe('Moved 8 MB to Quarantine. The space comes back when you empty it.');
    expect(result.textContent).not.toMatch(/Freed 8/);
    await user.click(button('Open Quarantine'));
    expect(onNavigate).toHaveBeenCalledWith('quarantine');
  });

  it('settles the remembered scan after a clean, exactly as Deep Clean does', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Move to Quarantine'));
    await screen.findByTestId('clean-recommended-result');

    const stored = loadScanCache();
    expect(stored.rules.temp.sizeBytes).toBe(0);
    expect(stored.rules.logs.sizeBytes).toBe(0);
    expect(stored.rules.thumbs.sizeBytes).toBe(2 * MB);
    expect(streamDeepCleanScan).not.toHaveBeenCalled();

    // Done puts the card back at rest: nothing recommended is left.
    await user.click(button('Done'));
    expect(await screen.findByText('Nothing recommended needs cleaning right now.')).toBeTruthy();
  });

  it('shows the progress while it runs, and Stop ends it with what was cleaned', async () => {
    const user = userEvent.setup();
    seedCache();
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent, signal) => {
      onEvent('start', { total: ids.length });
      onEvent('rule', { id: 'temp', name: 'temp', category: 'Windows', movedBytes: 5 * MB, quarantineBatch: 'C:\\q\\temp', skipped: [] });
      await new Promise((_, reject) => signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' }))));
    });
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Move to Quarantine'));

    expect(await screen.findByText('Cleaning… 1 of 2')).toBeTruthy();
    await user.click(button('Stop'));
    const result = await screen.findByTestId('clean-recommended-result');
    expect(result.textContent).toBe('Moved 5 MB to Quarantine. The space comes back when you empty it.');
    expect(loadScanCache().rules.temp.sizeBytes).toBe(0);
    expect(loadScanCache().rules.logs.sizeBytes).toBe(3 * MB);
  });

  it('says what failed when the clean itself fails', async () => {
    const user = userEvent.setup();
    seedCache();
    streamDeepCleanExecute.mockRejectedValue(new Error('backend gone'));
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Move to Quarantine'));
    expect(await screen.findByText("Couldn't clean: backend gone")).toBeTruthy();
  });

  it('measures again on Rescan, then asks with the fresh total', async () => {
    const user = userEvent.setup();
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Rescan' }));
    expect((await screen.findByTestId('clean-recommended-prompt')).textContent).toBe('Move 8 MB to Quarantine?');
    expect(streamDeepCleanScan).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('clean-recommended-cache-note')).toBeNull();
  });

  it('keeps a second view of the same scan honest: a clean here empties it there', async () => {
    const user = userEvent.setup();
    seedCache();
    const client = makeTestClient();
    render({}, { client });
    const other = render({}, { client });
    const second = within(other.container);
    expect(await second.findByText('Can be cleaned: 8 MB')).toBeTruthy();

    await user.click((await screen.findAllByRole('button', { name: 'Review and clean' }))[0]);
    await user.click(button('Move to Quarantine'));
    await screen.findByTestId('clean-recommended-result');

    expect(await second.findByText('Nothing recommended needs cleaning right now.')).toBeTruthy();
  });
});

describe('the removal mode', () => {
  it('says Delete now is immediate and styles the confirmation as the danger it is', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), deepCleanRemoval: 'delete' };
    seedCache();
    render();
    expect((await screen.findByTestId('clean-recommended-mode')).textContent).toBe('Deletes immediately.');
    await user.click(button('Review and clean'));
    expect(screen.getByTestId('clean-recommended-prompt').textContent).toBe("Delete 8 MB now? This can't be undone.");
    const confirm = button('Delete');
    expect(confirm.className).toMatch(/btn-danger/);
    expect(confirm.className).not.toMatch(/btn-primary/);
  });

  it('reports Freed, not Moved, for what was deleted', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), deepCleanRemoval: 'delete' };
    seedCache();
    streamDeepCleanExecute.mockImplementation(async (ids, onEvent) => {
      onEvent('start', { total: ids.length });
      for (const id of ids) onEvent('rule', { id, name: id, category: 'Windows', freedBytes: SIZES[id], skipped: [] });
    });
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    await user.click(button('Delete'));
    expect((await screen.findByTestId('clean-recommended-result')).textContent).toBe('Freed 8 MB.');
    expect(screen.queryByRole('button', { name: 'Open Quarantine' })).toBeNull();
  });

  it('names the Recycle Bin when Auto-Quarantine is off', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), autoQuarantine: false };
    seedCache();
    render();
    await user.click(await screen.findByRole('button', { name: 'Review and clean' }));
    expect(screen.getByTestId('clean-recommended-prompt').textContent).toBe('Move 8 MB to the Recycle Bin?');
    expect(button('Move to Recycle Bin')).toBeTruthy();
  });
});

describe('when the rules cannot be listed', () => {
  it('leaves the button off rather than acting on nothing', async () => {
    fetchDeepCleanRules.mockRejectedValue(new Error('down'));
    render();
    await screen.findByText('Nothing has been measured yet. Prune measures first, then asks before it cleans.');
    expect(button('Measure and review').disabled).toBe(true);
  });
});

describe('what is held back until the app is idle', () => {
  it('does not ask the backend for anything before its delay', async () => {
    render({ armDelayMs: 60_000 });
    await screen.findByText('Clean recommended');
    await new Promise((r) => setTimeout(r, 30));
    expect(fetchDeepCleanRules).not.toHaveBeenCalled();
  });
});

describe('in another language', () => {
  it('writes the question, the destination and the age in the chosen language', async () => {
    const user = userEvent.setup();
    settingsRecord = { ...baseSettings(), language: 'de' };
    seedCache();
    render();
    expect(await screen.findByText('Empfohlenes bereinigen')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Prüfen und bereinigen' }));
    expect(screen.getByTestId('clean-recommended-prompt').textContent).toBe('8 MB in die Quarantäne verschieben?');
    expect(screen.getByTestId('clean-recommended-cache-note').textContent).toMatch(/Größen stammen|Größen|letzten/);
  });
});
