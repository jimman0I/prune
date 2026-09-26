import { describe, it, expect } from 'vitest';
import { mergeScannedRule, scanLogLine, executeLogLine, logRuleName, DEFAULT_LOG_MESSAGES } from './scanLog.js';

describe('mergeScannedRule', () => {
  it('creates the category on the first rule that belongs to it', () => {
    const next = mergeScannedRule([], { id: 'a', category: 'Applications', name: 'A' });
    expect(next).toEqual([{ category: 'Applications', items: [{ id: 'a', category: 'Applications', name: 'A' }] }]);
  });

  it('appends into an existing category, keeping arrival order', () => {
    let cats = mergeScannedRule([], { id: 'a', category: 'Applications' });
    cats = mergeScannedRule(cats, { id: 'b', category: 'Applications' });
    expect(cats).toHaveLength(1);
    expect(cats[0].items.map(i => i.id)).toEqual(['a', 'b']);
  });

  it('keeps categories in the order they first appeared', () => {
    let cats = mergeScannedRule([], { id: 'a', category: 'Applications' });
    cats = mergeScannedRule(cats, { id: 'b', category: 'Developer' });
    cats = mergeScannedRule(cats, { id: 'c', category: 'Applications' });
    expect(cats.map(c => c.category)).toEqual(['Applications', 'Developer']);
  });

  // React only re-renders what it sees change, and the tree fills in
  // while the scan is still running -- mutating the previous array would
  // leave the UI showing a stale count until something else moved.
  it('never mutates the array it was given', () => {
    const before = [{ category: 'Applications', items: [{ id: 'a' }] }];
    const snapshot = JSON.stringify(before);
    mergeScannedRule(before, { id: 'b', category: 'Applications' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });
});

describe('scanLogLine', () => {
  it('reports a real size', () => {
    expect(scanLogLine({ name: 'Discord Cache', sizeBytes: 396361728, present: true, accessible: true }))
      .toEqual({ label: 'Discord Cache', detail: '378 MB', tone: 'size' });
  });

  // The three states that all used to read as "0 B" are genuinely
  // different answers, and the log is where they're easiest to see.
  it('distinguishes software that is not installed', () => {
    expect(scanLogLine({ name: 'Slack Cache', sizeBytes: 0, present: false }).detail).toBe('not installed');
  });

  it('distinguishes a folder it could not read', () => {
    const line = scanLogLine({ name: 'Prefetch', sizeBytes: 0, present: true, accessible: false });
    expect(line.detail).toBe('needs admin');
    expect(line.tone).toBe('warning');
  });

  it('distinguishes a rule with nothing to measure', () => {
    expect(scanLogLine({ name: 'DNS Cache', sizeBytes: null, present: true, accessible: true }).detail)
      .toBe('nothing to measure');
  });

  it('reports an installed but genuinely empty cache as empty, not as nothing', () => {
    expect(scanLogLine({ name: 'Zoom', sizeBytes: 0, present: true, accessible: true }).detail).toBe('empty');
  });
});

describe('executeLogLine', () => {
  it('reports a real deletion, BleachBit-style ("Delete <name>")', () => {
    expect(executeLogLine({ id: 'discord_cache', name: 'Discord Cache', freedBytes: 396361728, skipped: [] }))
      .toEqual({ label: 'Delete Discord Cache', detail: '378 MB', tone: 'size' });
  });

  it('says Recycle instead of Delete when autoQuarantine is off', () => {
    expect(executeLogLine({ id: 'x', name: 'X Cache', freedBytes: 1024, recycled: true, skipped: [] }).label)
      .toBe('Recycle X Cache');
  });

  it('reports a rule that was already empty as empty, not as a silent zero', () => {
    expect(executeLogLine({ id: 'x', name: 'X Cache', freedBytes: 0, skipped: [] }).detail).toBe('already empty');
  });

  it('surfaces locked files rather than hiding them behind the freed total', () => {
    const line = executeLogLine({ id: 'x', name: 'X Cache', freedBytes: 1024, skipped: [{ path: 'a' }, { path: 'b' }] });
    expect(line.detail).toBe('1 KB, 2 locked');
  });

  it('warns when nothing could be freed at all because everything was locked', () => {
    const line = executeLogLine({ id: 'x', name: 'X Cache', freedBytes: 0, skipped: [{ path: 'a' }] });
    expect(line).toEqual({ label: 'Delete X Cache', detail: '1 locked', tone: 'warning' });
  });

  it('surfaces an unknown-rule-id error from the stream as its own line', () => {
    expect(executeLogLine({ id: 'ghost', error: 'Unknown rule id "ghost"' }))
      .toEqual({ label: 'ghost', detail: 'Unknown rule id "ghost"', tone: 'warning' });
  });

  it('says "Compact", not "Delete", for a rule with no files removed but a real byte reduction', () => {
    const line = executeLogLine({ id: 'x', name: 'X Database', freedBytes: 2048, skipped: [], vacuumed: true });
    expect(line).toEqual({ label: 'Compact X Database', detail: '2 KB', tone: 'size' });
  });

  it('does not report a held-back or failed vacuum as a silent success', () => {
    // vacuumed: true only means the action RAN, not that it succeeded --
    // sqliteVacuumAction.execute can still return freedBytes: 0 with a
    // real skipped[] entry (missing file, excluded/too-recent guard, or
    // the VACUUM subprocess itself failing on a locked/corrupt database).
    const line = executeLogLine({
      id: 'x',
      name: 'X Database',
      freedBytes: 0,
      vacuumed: true,
      skipped: [{ path: 'x.db', reason: 'modified too recently' }]
    });
    expect(line).toEqual({ label: 'Compact X Database', detail: '1 skipped', tone: 'warning' });
  });

  it('reports a vacuum that genuinely had nothing to reclaim as empty', () => {
    const line = executeLogLine({ id: 'x', name: 'X Database', freedBytes: 0, vacuumed: true, skipped: [] });
    expect(line).toEqual({ label: 'Compact X Database', detail: 'already empty', tone: 'muted' });
  });

  it('says "Clear", not "Delete", for a registry-only rule', () => {
    const line = executeLogLine({ id: 'x', name: 'X Recent Files', freedBytes: 0, registryKeysRemoved: 1, skipped: [] });
    expect(line).toEqual({ label: 'Clear X Recent Files', detail: '1 registry entry', tone: 'size' });
  });

  it('still says "Delete" for an ordinary file-removal rule, unchanged', () => {
    const line = executeLogLine({ id: 'x', name: 'X Cache', freedBytes: 1024, skipped: [] });
    expect(line.label).toBe('Delete X Cache');
  });

  it('reports a registry-only rule whose key was already gone as absent, not a silent zero', () => {
    const line = executeLogLine({ id: 'x', name: 'X Recent Files', freedBytes: 0, registryKeysRemoved: 0, skipped: [] });
    expect(line).toEqual({ label: 'Clear X Recent Files', detail: 'already absent', tone: 'muted' });
  });

  it('says "Trim", not "Delete" or "Compact", for a json-edit result', () => {
    const line = executeLogLine({ id: 'x', name: 'X Preferences', freedBytes: 512, skipped: [], edited: true });
    expect(line).toEqual({ label: 'Trim X Preferences', detail: '512 B', tone: 'size' });
  });

  it('reports a json-edit that removed a key but freed nothing measurable as empty, not silently 0 B', () => {
    const line = executeLogLine({ id: 'x', name: 'X Preferences', freedBytes: 0, skipped: [], edited: true });
    expect(line).toEqual({ label: 'Trim X Preferences', detail: 'already empty', tone: 'muted' });
  });

  it('does not collapse a skipped/failed json edit into a fake success', () => {
    const line = executeLogLine({
      id: 'x', name: 'X Preferences', freedBytes: 0, edited: true,
      skipped: [{ path: 'prefs.json', reason: 'not valid JSON' }]
    });
    expect(line).toEqual({ label: 'Trim X Preferences', detail: '1 skipped', tone: 'warning' });
  });
});

describe('mergeScannedRule over a pre-listed tree', () => {
  // The tree is built from the rule list before any scan runs, so every
  // scanned rule arrives to find a placeholder already sitting there.
  // Appending would have shown all forty rules twice.
  const listed = [
    { category: 'Applications', items: [
      { id: 'discord_cache', name: 'Discord Cache', sizeBytes: null, recommended: true },
      { id: 'spotify_cache', name: 'Spotify Cache', sizeBytes: null, recommended: true }
    ] }
  ];

  it('fills in the placeholder rather than adding a second row', () => {
    const next = mergeScannedRule(listed, {
      id: 'spotify_cache', category: 'Applications', name: 'Spotify Cache', sizeBytes: 5581061233, present: true
    });
    expect(next[0].items).toHaveLength(2);
    expect(next[0].items[1].sizeBytes).toBe(5581061233);
  });

  it('leaves the row where it was', () => {
    // A tree that reorders itself while the reader is looking at it is
    // worse than one that fills in quietly.
    const next = mergeScannedRule(listed, {
      id: 'spotify_cache', category: 'Applications', sizeBytes: 1, present: true
    });
    expect(next[0].items.map((i) => i.id)).toEqual(['discord_cache', 'spotify_cache']);
  });

  it('keeps fields the scan does not resend', () => {
    const next = mergeScannedRule(listed, { id: 'discord_cache', category: 'Applications', sizeBytes: 42 });
    expect(next[0].items[0].name).toBe('Discord Cache');
    expect(next[0].items[0].recommended).toBe(true);
  });

  it('still appends a rule with no placeholder', () => {
    const next = mergeScannedRule(listed, { id: 'brand_new', category: 'Applications', sizeBytes: 7 });
    expect(next[0].items.map((i) => i.id)).toEqual(['discord_cache', 'spotify_cache', 'brand_new']);
  });
});

/* The wording around a rule's name is the current language's, handed in as
 * `messages`. A recognisably non-English set proves every branch reads its
 * wording from there and none of it is still built in code. */
const FAKE = {
  scan: { nothingToMeasure: 'S-none', needsAdmin: 'S-admin', notInstalled: 'S-absent', empty: 'S-empty' },
  execute: {
    delete: (name) => `X-delete ${name}`,
    recycle: (name) => `X-recycle ${name}`,
    clear: (name) => `X-clear ${name}`,
    compact: (name) => `X-compact ${name}`,
    trim: (name) => `X-trim ${name}`,
    registryEntries: (n) => `X-reg ${n}`,
    alreadyAbsent: 'X-absent',
    skipped: (n) => `X-skipped ${n}`,
    alreadyEmpty: 'X-empty',
    locked: (n) => `X-locked ${n}`,
    lockedAfterSize: (size, n) => `${size} X-and-locked ${n}`
  }
};
const named = (rule) => rule.name;

describe('scanLogLine with another language messages', () => {
  it('words every non-size answer from the messages', () => {
    expect(scanLogLine({ name: 'A' }, named, FAKE).detail).toBe('S-none');
    expect(scanLogLine({ name: 'A', sizeBytes: 0, present: true, accessible: false }, named, FAKE).detail).toBe('S-admin');
    expect(scanLogLine({ name: 'A', sizeBytes: 0, present: false }, named, FAKE).detail).toBe('S-absent');
    expect(scanLogLine({ name: 'A', sizeBytes: 0, present: true }, named, FAKE).detail).toBe('S-empty');
  });

  it('keeps the tones and formats a size the same in every language', () => {
    expect(scanLogLine({ name: 'A', sizeBytes: 2048, present: true }, named, FAKE)).toEqual({ label: 'A', detail: '2 KB', tone: 'size' });
    expect(scanLogLine({ name: 'A', sizeBytes: 0, present: true, accessible: false }, named, FAKE).tone).toBe('warning');
  });

  it('defaults to the English wording', () => {
    expect(scanLogLine({ name: 'A', sizeBytes: 0, present: false }, named, DEFAULT_LOG_MESSAGES).detail).toBe('not installed');
  });
});

describe('executeLogLine with another language messages', () => {
  const run = (item) => executeLogLine({ id: 'r', name: 'A', ...item }, named, FAKE);

  it('words the registry branch', () => {
    expect(run({ registryKeysRemoved: 3 })).toEqual({ label: 'X-clear A', detail: 'X-reg 3', tone: 'size' });
    expect(run({ registryKeysRemoved: 0 })).toEqual({ label: 'X-clear A', detail: 'X-absent', tone: 'muted' });
  });

  it('words the compact and trim branches', () => {
    for (const [flag, verb] of [['vacuumed', 'X-compact'], ['edited', 'X-trim']]) {
      expect(run({ [flag]: true, freedBytes: 1024 })).toEqual({ label: `${verb} A`, detail: '1 KB', tone: 'size' });
      expect(run({ [flag]: true, freedBytes: 0, skipped: [1, 2] })).toEqual({ label: `${verb} A`, detail: 'X-skipped 2', tone: 'warning' });
      expect(run({ [flag]: true, freedBytes: 0 })).toEqual({ label: `${verb} A`, detail: 'X-empty', tone: 'muted' });
    }
  });

  it('words the delete and recycle branches, with and without locked files', () => {
    expect(run({ freedBytes: 1024 })).toEqual({ label: 'X-delete A', detail: '1 KB', tone: 'size' });
    expect(run({ freedBytes: 1024, recycled: true }).label).toBe('X-recycle A');
    expect(run({ freedBytes: 1024, skipped: [1] }).detail).toBe('1 KB X-and-locked 1');
    expect(run({ freedBytes: 0, skipped: [1, 2, 3] })).toEqual({ label: 'X-delete A', detail: 'X-locked 3', tone: 'warning' });
    expect(run({ freedBytes: 0 })).toEqual({ label: 'X-delete A', detail: 'X-empty', tone: 'muted' });
  });

  it('passes an error through untouched', () => {
    expect(run({ error: 'boom' })).toEqual({ label: 'A', detail: 'boom', tone: 'warning' });
  });

  it('keeps the English plural for one registry entry by default', () => {
    expect(executeLogLine({ id: 'r', name: 'A', registryKeysRemoved: 1 }).detail).toBe('1 registry entry');
    expect(executeLogLine({ id: 'r', name: 'A', registryKeysRemoved: 2 }).detail).toBe('2 registry entries');
  });
});

describe('logRuleName', () => {
  // Three rules are all called "Cache"; the log is the one place they sit
  // in a flat list with nothing above them to say which application they
  // belong to.
  const label = { categoryName: (c) => `<${c}>`, ruleName: (r) => r.name };

  it('leads with the category the rule belongs to', () => {
    expect(logRuleName({ id: 'brave-cache', name: 'Cache', category: 'Brave' }, label)).toBe('<Brave> · Cache');
  });

  it('finds the category from the tree when the event carries none, as a clean result does', () => {
    const categoryOf = (id) => (id === 'brave-cache' ? 'Brave' : undefined);
    expect(logRuleName({ id: 'brave-cache', name: 'Cache' }, { ...label, categoryOf })).toBe('<Brave> · Cache');
  });

  it('is just the name when the category cannot be found, rather than a blank prefix', () => {
    expect(logRuleName({ id: 'x', name: 'Cache' }, label)).toBe('Cache');
  });

  it('shows through both log lines', () => {
    const nameOf = (item) => logRuleName(item, label);
    expect(scanLogLine({ id: 'a', name: 'Cache', category: 'Brave', sizeBytes: 0, present: false }, nameOf).label).toBe('<Brave> · Cache');
    expect(executeLogLine({ id: 'a', name: 'Cache', category: 'Brave', freedBytes: 1024 }, nameOf).label).toBe('Delete <Brave> · Cache');
  });
});
