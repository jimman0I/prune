# Batch Uninstall Scan Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `BatchUninstallModal.jsx` currently scans a program for leftovers the instant its spawned uninstaller *process* exits, not once the uninstall has actually finished — confirmed live with Riot Client/VALORANT, whose real 32GB removal happens asynchronously after `RiotClientServices.exe` returns almost immediately. The batch flow declared "Uninstalled 1 of 1" and cleaned only small artifacts while the real game install sat untouched. This plan adds a single combined "ready to scan" confirmation for the whole batch — one click, not one per program — between the uninstall loop finishing and any leftover scan starting. Full design rationale: `docs/superpowers/specs/2026-09-19-batch-uninstall-scan-gate-design.md`.

**Architecture:** `BatchUninstallModal.jsx` gains a new `readyToScan` phase (and a `scanning` phase for the scan-in-progress UI) between `running` and `review`. `runBatch` stops after the uninstall loop instead of scanning inline; a new `startScans` function (single-flighted, mirroring `UninstallModal.jsx`'s own `startScan`) performs the scan loop once the user clicks through. The gate is skipped entirely (straight to `review`, unchanged) when there is nothing to gate: `scanLeftoversAfterUninstall` is off, or no succeeded program is eligible for a scan (all failed, or an all-Store batch).

**Tech Stack:** React frontend (Vitest + Testing Library), i18n catalog (`frontend/src/i18n/catalog.js`, 40 languages, completeness enforced by `catalog.test.js`).

---

### Task 1: New i18n keys across all 40 catalog languages

**Files:**
- Modify: `frontend/src/i18n/catalog.js`

No new test file — `frontend/src/i18n/catalog.test.js` (pre-existing, unmodified) already enforces that every language has every key, correctly typed, non-blank. Running it is this task's own verification.

**Exact current English block** (`frontend/src/i18n/catalog.js`, inside `en`'s `batchUninstallModal`, already read in full):

```js
      removingLine: {
        quarantine: 'Moving leftovers to Quarantine…',
        recycle: 'Sending leftovers to the Recycle Bin…',
        permanent: 'Deleting leftovers permanently…'
      },
      uninstalledOf: (removed, total) => `Uninstalled ${removed} of ${total}.`,
```

This exact `removingLine: { ... },` block (three lines, identical key names, only the string values translated) appears once inside `batchUninstallModal` in every one of the 40 language blocks in this file — it is a reliable anchor to find the right insertion point in each one.

- [ ] **Step 1: Add the three new keys to English**

In the `en` block, change:

```js
      removingLine: {
        quarantine: 'Moving leftovers to Quarantine…',
        recycle: 'Sending leftovers to the Recycle Bin…',
        permanent: 'Deleting leftovers permanently…'
      },
      uninstalledOf: (removed, total) => `Uninstalled ${removed} of ${total}.`,
```

to:

```js
      removingLine: {
        quarantine: 'Moving leftovers to Quarantine…',
        recycle: 'Sending leftovers to the Recycle Bin…',
        permanent: 'Deleting leftovers permanently…'
      },
      scanningLine: 'Scanning for leftovers…',
      readyToScan: {
        body: (n) => `${n} uninstaller${n === 1 ? '' : 's'} finished running. Some — game launchers especially — keep removing files in the background after their own window closes. Give it a moment if you're not sure, then click Scan to check for anything left behind.`,
        scanButton: 'Scan for leftovers'
      },
      uninstalledOf: (removed, total) => `Uninstalled ${removed} of ${total}.`,
```

- [ ] **Step 2: Add the same three keys, translated, to all 39 other languages**

For each of the 39 non-English codes in `frontend/src/i18n/languages.js` (`af, ar, ca, cs, cy, da, de, el, es, et, fi, fr, he, hu, id, is, it, ja, ko, lt, ms, nb, nl, pl, ps, pt-BR, pt, ro, ru, sk, sq, sr, sv, th, tr, uk, vi, zh-CN, zh-TW`), find that language's own `batchUninstallModal` block's `removingLine: { ... },` and insert the same three keys immediately after it, in that order, translated into that language.

Do not translate from scratch in isolation — each language's own catalog block already carries the same concepts nearby, translated by whoever wrote that block, and matching their existing vocabulary/register keeps this addition indistinguishable from work already there:
- That same language's `uninstallModal.readyToScan.body` and `uninstallModal.readyToScan.scanButton` (an equivalent "uninstaller finishing up, click Scan" sentence for the single-uninstall flow) is the direct model for `batchUninstallModal.readyToScan.body`/`scanButton` — same idea, scaled from one program to a batch of N.
- That same language's `uninstallModal.progress.scanningLeftovers` ("Scanning for leftovers") is the direct model for `batchUninstallModal.scanningLine`.

`readyToScan.body` MUST stay a function of `n` (an arrow function, matching English's shape exactly) with correct pluralization for that language's own rules — `catalog.test.js` fails the whole suite if any language's value is a plain string where English has a function, so check this deliberately for each one, not just copy English's `n === 1 ? '' : 's'` English-only pattern verbatim into e.g. Japanese or Chinese (languages with no plural marking at all still need a function of `n`, it just may not vary its output by `n`).

Right-to-left languages (`ar`, `he`, `ps`) and CJK languages (`ja`, `ko`, `zh-CN`, `zh-TW`) get real, natural translations in their own script — not transliterations or English left in place.

- [ ] **Step 3: Run the completeness check**

Run: `cd frontend && npx vitest run src/i18n/catalog.test.js`
Expected: PASS, all 4 tests — in particular "gives every language every key English has, and nothing extra" and "matches English's type at every key" and "leaves no value blank". If it fails, the failure message names exactly which language/key/problem to fix (e.g. `de is missing batchUninstallModal.scanningLine`, or `ja.batchUninstallModal.readyToScan.body is string, English is function`) — fix precisely that language/key and re-run.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/i18n/catalog.js
git commit -m "feat(i18n): add batch uninstall readyToScan/scanning strings for all 40 languages"
```

Note: do NOT add a `Co-Authored-By: Claude` line — this project's convention is no AI attribution in commits.

---

### Task 2: The `readyToScan` gate in `BatchUninstallModal.jsx`, and updating every test file it breaks

**Files:**
- Modify: `frontend/src/components/BatchUninstallModal.jsx`
- Modify: `frontend/src/components/BatchUninstallModal.render.test.jsx`
- Modify: `frontend/src/components/BatchUninstallModal.store.test.jsx`
- Modify: `frontend/src/components/BatchUninstallModal.settings.test.jsx`
- Modify: `frontend/src/components/BatchUninstallModal.language.render.test.jsx`
- Not modified: `frontend/src/components/BatchUninstallModal.order.test.jsx` (only asserts uninstall order/confirm-list text, never reaches the scan; unaffected by this change — run it anyway in Step 8 to confirm)

This is one task, not several, because the component change and its five sibling test files are tightly coupled: changing the phase machine changes what every one of these files must click through to reach the screens they assert on. Read `frontend/src/components/BatchUninstallModal.jsx`, `UninstallModal.jsx` (the pattern this mirrors), and all five test files above in full before starting — their exact current content is quoted below, but reading the real files first will show anything this plan's quotes missed.

**Exact current `BatchUninstallModal.jsx` code being changed** (already read in full; line numbers are from the version this plan was written against and may drift slightly):

```js
  const [phase, setPhase] = useState('confirm');
  const [statuses, setStatuses] = useState(() =>
    Object.fromEntries(programs.map((p) => [p.id, { state: 'pending' }]))
  );
  const [leftovers, setLeftovers] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [removal, setRemoval] = useState(null);
  const [error, setError] = useState(null);
  // How many leftover scans the batch actually ran. Zero is not the same
  // as "ran and found nothing" -- see the review phase below.
  const [scanCount, setScanCount] = useState(0);
```

```js
  const runBatch = useSingleFlight(async () => {
    setPhase('running');
    const scans = [];

    for (const program of ordered) {
      setStatus(program.id, { state: 'running' });
      try {
        // A Store app has no registered uninstall command for the stream to
        // run. It goes through Remove-AppxPackage instead, by package name,
        // the same call the single-app dialog makes.
        if (program.source === 'store') {
          await removeStoreApp(program.packageFullName);
        } else {
          await streamUninstall(program.id, () => {});
        }
        appendHistoryEntry({
          programName: program.name,
          publisher: program.publisher,
          sizeBytes: program.sizeBytes
        }).catch(() => { /* logging must never fail an uninstall that worked */ });
        setStatus(program.id, { state: 'done' });

        // Scan straight after each one rather than all at the end: the
        // program's own files are freshest now, and a later uninstaller
        // could remove a shared folder this one still had.
        //
        // Not for a Store app. The scan matches on publisher, and 68 of the
        // 81 Store apps on the dev machine are published by Microsoft
        // Corporation -- a publisher search for that would offer to
        // quarantine a large part of Windows.
        if (program.source !== 'store' && scanAfter) {
          const scan = await scanForLeftovers(deriveSearchTerm(program.name), program.publisher);
          scans.push({ program: program.name, scan });
        }
      } catch (err) {
        // Recorded and skipped. The rest of the queue still runs.
        setStatus(program.id, { state: 'failed', message: err.message });
      }
    }

    setScanCount(scans.length);
    const merged = mergeLeftovers(scans);
    setLeftovers(merged);
    const keys = [];
    for (const group of ['files', 'registryKeys']) {
      (merged[group]?.items || []).forEach((_, i) => keys.push(`${group}:${i}`));
    }
    setSelected(new Set(preselect ? keys : []));
    setPhase('review');
  });
```

```jsx
        <button
          onClick={onClose}
          disabled={phase === 'running' || phase === 'removing'}
          className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium disabled:opacity-40"
        >
          {t('batchUninstallModal.close')}
        </button>
```

```jsx
        {(phase === 'running' || phase === 'removing') && (
          <div className="space-y-1.5">
            {ordered.map((program) => {
              const status = statuses[program.id] || { state: 'pending' };
              return (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-[color:var(--surface-subtle)]">
                  <span className="text-[12.5px] truncate">{program.name}</span>
                  <span className={`text-[11.5px] font-mono shrink-0 ${STATUS_STYLE[status.state]}`}>
                    {STATUS_LABEL[status.state]}
                  </span>
                </div>
              );
            })}
            {phase === 'removing' && (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] pt-3">
                {REMOVING_LINE[destination]}
              </p>
            )}
          </div>
        )}

        {phase === 'review' && leftovers && (
```

**Step 1: Write/adjust failing tests first (TDD)** — before touching `BatchUninstallModal.jsx`, update the five test files below to expect the new gate. Running them against the *unmodified* component should fail (the gate doesn't exist yet, so a test that clicks a "Scan for leftovers" button will time out finding it; a test asserting no scan happened without a click will instead see the scan already ran).

**1a. `BatchUninstallModal.render.test.jsx`** — no phase-flow assertions in this file's two existing tests (they only check `streamUninstall` call count/order/concurrency, never wait for `review`), so they need **no changes**. Add one new `describe` block covering the gate itself:

```jsx
describe('the readyToScan gate', () => {
  it('does not scan until Scan for leftovers is clicked, once every uninstaller has exited', async () => {
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={() => {}} onFinished={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));

    const scanButton = await screen.findByRole('button', { name: 'Scan for leftovers' });
    expect(scanForLeftovers).not.toHaveBeenCalled();

    await user.click(scanButton);
    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(2));
    expect(scanForLeftovers.mock.calls.map((c) => c[0])).toEqual(['Thing One', 'Thing Two']);
  });

  it('closes from the gate without ever scanning, and still finishes the batch', async () => {
    const onClose = vi.fn();
    const onFinished = vi.fn();
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={onClose} onFinished={onFinished} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await screen.findByRole('button', { name: 'Scan for leftovers' });

    // Two "Close" buttons exist once the gate is up: the header's own, and
    // the gate's dedicated one -- this targets the one rendered last, the
    // same convention UninstallModal.render.test.jsx already uses for its
    // own readyToScan step.
    const closeButtons = screen.getAllByRole('button', { name: 'Close' });
    await user.click(closeButtons[closeButtons.length - 1]);

    expect(scanForLeftovers).not.toHaveBeenCalled();
    expect(onFinished).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
```

(`deriveSearchTerm` on `'Thing One'`/`'Thing Two'` — check `frontend/src/lib/searchTerm.js` if the exact expected search-term strings need adjusting; the existing single-flow tests already exercise the same function, so match whatever it actually returns for these fixture names rather than assuming the raw name passes through unchanged.)

**1b. `BatchUninstallModal.store.test.jsx`** — one existing test needs a click added, because it is the one case in this file where a real (non-Store) program succeeds and the gate now appears:

Change:

```js
  it('is not followed by a leftover scan', async () => {
    /* The registry program still is -- that is what the scan is for. The
     * Store app is not, because the scan matches on publisher, and on the
     * dev machine most Store apps are Microsoft's. */
    await startBatch([calculator, thing]);

    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    const scannedPublishers = scanForLeftovers.mock.calls.map((c) => c[1]);
    expect(scannedPublishers).toEqual(['Acme']);
  });
```

to:

```js
  it('is not followed by a leftover scan', async () => {
    /* The registry program still is -- that is what the scan is for. The
     * Store app is not, because the scan matches on publisher, and on the
     * dev machine most Store apps are Microsoft's. */
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={[calculator, thing]} onClose={() => {}} onFinished={() => {}} />);
    await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
    await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));

    await waitFor(() => expect(scanForLeftovers).toHaveBeenCalledTimes(1));
    const scannedPublishers = scanForLeftovers.mock.calls.map((c) => c[1]);
    expect(scannedPublishers).toEqual(['Acme']);
  });
```

(`startBatch` is this file's own helper using `userEvent`+`renderScreen`+click already — inlined here only because it needs a second click the helper doesn't take a parameter for; leave `startBatch` itself and every other call site using it unchanged.)

The `'the review after a batch that scanned nothing'` describe block's three tests (Store-only batch, all-failed batch, and the one real successful `[thing]`-only batch) — re-read them against the new design: a Store-only batch and an all-failed batch both have zero eligible programs, so the gate is skipped by design and these two need **no changes**. The third, `'still reports a clean uninstall when a scan ran and found nothing'`, runs `[thing]` alone (succeeds, non-Store) so the gate **will** appear — update it:

```js
  it('still reports a clean uninstall when a scan ran and found nothing', async () => {
    // The case the sentence is FOR. Guarding the two above must not lose it.
    const { user } = await run([thing]);
    await user.click(await screen.findByRole('button', { name: 'Scan for leftovers' }));

    expect(await screen.findByText(/No leftovers found/i)).toBeTruthy();
  });
```

**1c. `BatchUninstallModal.settings.test.jsx`** — the shared `run()` helper only starts the batch; two of its three call sites need a click added afterward since `thing` always succeeds and is non-Store (the third, the `scanLeftoversAfterUninstall: false` test, has the gate skipped by design and needs no change). Rather than editing each call site, add the click to the end of `run()` itself, since `run()` is unconditionally followed by scan-dependent assertions in every test except the settings-off one:

```js
const run = async () => {
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={[thing]} onClose={() => {}} onFinished={() => {}} />);
  // Settings arrive first, the way they would in the app: the dialog is
  // opened from a screen that has long since loaded them.
  await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
  await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
  return user;
};
```

to:

```js
const run = async () => {
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={[thing]} onClose={() => {}} onFinished={() => {}} />);
  // Settings arrive first, the way they would in the app: the dialog is
  // opened from a screen that has long since loaded them.
  await waitFor(() => expect(fetchSettings).toHaveBeenCalled());
  await user.click(screen.getByRole('button', { name: 'Start uninstalling' }));
  // thing always succeeds and is never a Store app, so the readyToScan
  // gate always appears here -- except when scanLeftoversAfterUninstall
  // is off, which that one test below checks for itself before calling
  // this helper, and which skips the gate by design (nothing to scan
  // means nothing to confirm).
  const scanButton = screen.queryByRole('button', { name: 'Scan for leftovers' });
  if (scanButton) await user.click(scanButton);
  return user;
};
```

Using a synchronous `queryByRole` right after the click (not `findByRole`) is safe here: by the time `user.click` resolves, `runBatch`'s uninstall loop and its own synchronous phase transition (`readyToScan` or straight to `review`) have already happened inside the same `act()`-wrapped update — there is no further async gap to wait through before the phase settles once `streamUninstall`'s mocked promise (`mockResolvedValue()`, resolves immediately) has resolved. If this proves flaky in practice, change it to `await screen.findByRole('button', { name: 'Scan for leftovers' }).catch(() => null)` instead and click that if non-null.

The `'skips the leftover scans when they are turned off, and says so'` test needs **no changes** — it already asserts `scanForLeftovers` was never called and that `Done` renders, both still true (gate skipped by design, straight to `review` with `scanCount: 0`).

**1d. `BatchUninstallModal.language.render.test.jsx`** — the shared `run()` helper is used by the large majority of this file's tests, all of which uninstall two real (non-Store) programs (`programs`, both succeed) — the gate will appear for every one of them except the one `scanLeftoversAfterUninstall: false` test, which does not use `run()` at all (it calls `renderScreen` and clicks the Store-removal path directly) — check this by re-reading the file; if the no-scan test does use `run()`, give `run()` a parameter for it instead of hardcoding.

First, find this language's own Greek translation for `batchUninstallModal.readyToScan.scanButton` from Task 1's own new catalog entry for `el` (read it back from `catalog.js` once Task 1 is committed, rather than guessing it here) and use that exact string in the click below.

Change:

```js
const run = async () => {
  const onClose = vi.fn();
  const onFinished = vi.fn();
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={programs} onClose={onClose} onFinished={onFinished} />);
  await ready();
  await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
  await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
  return { user, onClose, onFinished };
};
```

to:

```js
const run = async () => {
  const onClose = vi.fn();
  const onFinished = vi.fn();
  const user = userEvent.setup();
  renderScreen(<BatchUninstallModal programs={programs} onClose={onClose} onFinished={onFinished} />);
  await ready();
  await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
  await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));
  // `programs` are both real, non-Store, and always succeed here, so the
  // readyToScan gate always appears for this helper's callers -- click
  // through it in the language this whole file tests in.
  await user.click(await screen.findByRole('button', { name: '<GREEK_SCAN_BUTTON_TEXT>' }));
  return { user, onClose, onFinished };
};
```

(replace `<GREEK_SCAN_BUTTON_TEXT>` with the real translated string from `catalog.js`'s `el.batchUninstallModal.readyToScan.scanButton`.)

Then re-check every test in this file that does NOT go through `run()` (the Store-only and mixed-Store-and-registry confirm-step tests, which never click Start at all, and the `translates the running-phase status labels` / `translates the removed/failed status labels` tests, which click Start but deliberately never let `streamUninstall` resolve for at least one program — these stay on `running` and never reach the gate, so they need no changes) and the `translates the Store-app no-scan message` test (waits for `removeStoreApp` called twice for an all-Store batch — zero eligible programs, gate skipped by design, no change needed).

Add one new test asserting the new copy actually translates, following this file's own established pattern:

```js
  it('translates the readyToScan gate: body and Scan button', async () => {
    const user = userEvent.setup();
    renderScreen(<BatchUninstallModal programs={programs} onClose={vi.fn()} onFinished={vi.fn()} />);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Έναρξη απεγκατάστασης' }));
    await waitFor(() => expect(streamUninstall).toHaveBeenCalledTimes(2));

    // Assert against a distinctive fragment of the real Greek body text
    // from catalog.js's el.batchUninstallModal.readyToScan.body, and the
    // real translated scanButton/scanningLine text -- read the actual
    // committed strings from catalog.js rather than guessing them here.
    expect(screen.getByText(/<DISTINCTIVE GREEK FRAGMENT OF readyToScan.body>/)).toBeTruthy();
    const scanButton = screen.getByRole('button', { name: '<GREEK_SCAN_BUTTON_TEXT>' });
    await user.click(scanButton);
    expect(await screen.findByText('<GREEK_SCANNING_LINE_TEXT>')).toBeTruthy();
  });
```

Fill in the three placeholders from the real, already-committed `el` strings once Task 1 is done — do not invent Greek text in this test file; it must match `catalog.js` exactly or it tests nothing real.

- [ ] **Step 2: Run all five files to confirm they fail against the unmodified component**

Run: `cd frontend && npx vitest run src/components/BatchUninstallModal.render.test.jsx src/components/BatchUninstallModal.store.test.jsx src/components/BatchUninstallModal.settings.test.jsx src/components/BatchUninstallModal.language.render.test.jsx`
Expected: FAIL — the new/updated tests time out looking for a "Scan for leftovers" button that doesn't exist yet, or (for tests asserting no premature scan) see `scanForLeftovers` already called.

- [ ] **Step 3: Add state for the gate**

In `BatchUninstallModal.jsx`, change:

```js
  const [scanCount, setScanCount] = useState(0);
```

to:

```js
  const [scanCount, setScanCount] = useState(0);
  // Which succeeded, non-Store programs are waiting on a leftover scan --
  // populated once, when the uninstall loop finishes and the readyToScan
  // gate opens; read once the gate's own Scan button is clicked. See
  // docs/superpowers/specs/2026-09-19-batch-uninstall-scan-gate-design.md.
  const [scannable, setScannable] = useState([]);
```

- [ ] **Step 4: Split `runBatch` -- stop after the uninstall loop, add `finishWithNoScans` and `startScans`**

Replace the whole `runBatch` block quoted above with:

```js
  const runBatch = useSingleFlight(async () => {
    setPhase('running');
    const succeeded = [];

    for (const program of ordered) {
      setStatus(program.id, { state: 'running' });
      try {
        // A Store app has no registered uninstall command for the stream to
        // run. It goes through Remove-AppxPackage instead, by package name,
        // the same call the single-app dialog makes.
        if (program.source === 'store') {
          await removeStoreApp(program.packageFullName);
        } else {
          await streamUninstall(program.id, () => {});
        }
        appendHistoryEntry({
          programName: program.name,
          publisher: program.publisher,
          sizeBytes: program.sizeBytes
        }).catch(() => { /* logging must never fail an uninstall that worked */ });
        setStatus(program.id, { state: 'done' });
        succeeded.push(program);
      } catch (err) {
        // Recorded and skipped. The rest of the queue still runs.
        setStatus(program.id, { state: 'failed', message: err.message });
      }
    }

    // Not for a Store app. The scan matches on publisher, and 68 of the
    // 81 Store apps on the dev machine are published by Microsoft
    // Corporation -- a publisher search for that would offer to
    // quarantine a large part of Windows.
    const eligible = succeeded.filter((program) => program.source !== 'store');

    if (scanAfter && eligible.length > 0) {
      // Every uninstaller has exited, but an exited process is not proof
      // its real work is done -- confirmed live with Riot Client, whose
      // real removal keeps running well after RiotClientServices.exe
      // returns. The batch pauses here, once for the whole batch rather
      // than once per program, for an explicit human confirmation before
      // ANY leftover scan runs. See
      // docs/superpowers/specs/2026-09-19-batch-uninstall-scan-gate-design.md
      // for why this is one gate, not N, and the freshness trade-off that
      // choice accepts.
      setScannable(eligible);
      setPhase('readyToScan');
      return;
    }

    // Nothing to gate: the leftover scan is off, or nothing eligible
    // succeeded (all failures, or an all-Store batch) -- either way zero
    // scans would run whether or not anyone confirmed anything.
    finishWithNoScans();
  });

  const finishWithNoScans = () => {
    setScanCount(0);
    setLeftovers(mergeLeftovers([]));
    setSelected(new Set());
    setPhase('review');
  };

  /* Single-flight for the same reason runBatch is: the click that starts
   * the batch's leftover scans should not be able to fire twice. Its
   * failure path returns to 'readyToScan', not 'confirm' or 'running' --
   * every uninstall already ran; only the scan itself failed and can be
   * retried without touching any program again. */
  const startScans = useSingleFlight(async () => {
    setError(null);
    setPhase('scanning');
    try {
      const scans = [];
      // Still scanned in the original per-program order -- mergeLeftovers'
      // own de-duplication and per-item program attribution are unchanged
      // by when the scan runs, only by what order it runs in.
      for (const program of scannable) {
        const scan = await scanForLeftovers(deriveSearchTerm(program.name), program.publisher);
        scans.push({ program: program.name, scan });
      }
      setScanCount(scans.length);
      const merged = mergeLeftovers(scans);
      setLeftovers(merged);
      const keys = [];
      for (const group of ['files', 'registryKeys']) {
        (merged[group]?.items || []).forEach((_, i) => keys.push(`${group}:${i}`));
      }
      setSelected(new Set(preselect ? keys : []));
      setPhase('review');
    } catch (err) {
      setError(err.message);
      setPhase('readyToScan');
    }
  });
```

`mergeLeftovers` is already imported at the top of this file; no new import is needed for `finishWithNoScans`'s `mergeLeftovers([])` call.

- [ ] **Step 5: Disable the header Close button during `scanning` too**

Change:

```jsx
        <button
          onClick={onClose}
          disabled={phase === 'running' || phase === 'removing'}
```

to:

```jsx
        <button
          onClick={onClose}
          disabled={phase === 'running' || phase === 'scanning' || phase === 'removing'}
```

(`readyToScan` is deliberately NOT in this disabled list -- it is a waiting state, not active async work, matching `UninstallModal.jsx`'s own `readyToScan` step, which never disables its header Close either.)

- [ ] **Step 6: Render the `scanning` phase's status line, and the new `readyToScan` screen**

Change:

```jsx
        {(phase === 'running' || phase === 'removing') && (
          <div className="space-y-1.5">
            {ordered.map((program) => {
              const status = statuses[program.id] || { state: 'pending' };
              return (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-[color:var(--surface-subtle)]">
                  <span className="text-[12.5px] truncate">{program.name}</span>
                  <span className={`text-[11.5px] font-mono shrink-0 ${STATUS_STYLE[status.state]}`}>
                    {STATUS_LABEL[status.state]}
                  </span>
                </div>
              );
            })}
            {phase === 'removing' && (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] pt-3">
                {REMOVING_LINE[destination]}
              </p>
            )}
          </div>
        )}

        {phase === 'review' && leftovers && (
```

to:

```jsx
        {(phase === 'running' || phase === 'scanning' || phase === 'removing') && (
          <div className="space-y-1.5">
            {ordered.map((program) => {
              const status = statuses[program.id] || { state: 'pending' };
              return (
                <div key={program.id} className="flex items-center justify-between gap-4 px-3.5 py-2 rounded-lg bg-[color:var(--surface-subtle)]">
                  <span className="text-[12.5px] truncate">{program.name}</span>
                  <span className={`text-[11.5px] font-mono shrink-0 ${STATUS_STYLE[status.state]}`}>
                    {STATUS_LABEL[status.state]}
                  </span>
                </div>
              );
            })}
            {phase === 'removing' && (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] pt-3">
                {REMOVING_LINE[destination]}
              </p>
            )}
            {phase === 'scanning' && (
              <p className="text-[12.5px] text-[color:var(--text-secondary)] pt-3">
                {t('batchUninstallModal.scanningLine')}
              </p>
            )}
          </div>
        )}

        {phase === 'readyToScan' && (
          <div className="py-4">
            <p className="text-[13px] text-[color:var(--text-secondary)] mb-5">
              {t('batchUninstallModal.readyToScan.body', scannable.length)}
            </p>
            {error && <p className="text-[12.5px] text-[color:var(--danger)] mb-4 select-text">{t('uninstallModal.scanFailed', error)}</p>}
            <div className="flex items-center gap-2.5">
              <button className="btn-primary" onClick={startScans}>{t('batchUninstallModal.readyToScan.scanButton')}</button>
              <button className="btn-ghost px-3 py-1.5 rounded-lg text-[12px] font-medium" onClick={() => { onFinished?.(); onClose(); }}>{t('batchUninstallModal.close')}</button>
            </div>
          </div>
        )}

        {phase === 'review' && leftovers && (
```

(The `error` shown here reuses `uninstallModal.scanFailed`, the exact same shared key `UninstallModal.jsx`'s own `readyToScan` step already reuses for the same purpose -- no new key needed for the failure path.)

- [ ] **Step 7: Run the five test files again**

Run: `cd frontend && npx vitest run src/components/BatchUninstallModal.render.test.jsx src/components/BatchUninstallModal.store.test.jsx src/components/BatchUninstallModal.settings.test.jsx src/components/BatchUninstallModal.language.render.test.jsx`
Expected: PASS, every test in all four files.

- [ ] **Step 8: Run the unmodified sibling and the whole component suite**

Run: `cd frontend && npx vitest run src/components/BatchUninstallModal.order.test.jsx`
Expected: PASS unchanged (confirms this file genuinely needed no edits).

Run: `cd frontend && npx vitest run src/components/UninstallModal.render.test.jsx src/components/UninstallModal.language.render.test.jsx`
Expected: PASS unchanged (confirms the single-uninstall flow, which this task never touches, is unaffected).

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/BatchUninstallModal.jsx frontend/src/components/BatchUninstallModal.render.test.jsx frontend/src/components/BatchUninstallModal.store.test.jsx frontend/src/components/BatchUninstallModal.settings.test.jsx frontend/src/components/BatchUninstallModal.language.render.test.jsx
git commit -m "fix(batch-uninstall): gate the leftover scan on an explicit confirmation, not the uninstaller process exiting"
```

Note: do NOT add a `Co-Authored-By: Claude` line.

---

### Task 3: Full three-suite verification

**Files:** none (verification only)

- [ ] **Step 1: Full frontend suite**

Run: `cd frontend && npx vitest run`
Expected: PASS, no regressions anywhere in the suite (not just the files this plan touched) -- in particular re-confirm `src/i18n/catalog.test.js` and every `BatchUninstallModal*`/`UninstallModal*` file together in one run, since Vitest's shared module cache can occasionally surface an ordering issue a single-file run wouldn't.

- [ ] **Step 2: Full backend suite**

Run: `cd backend && npx vitest run`
Expected: PASS, no regressions (this task touches no backend code; the 3-4 pre-existing elevation-gated `pendingReboot`/`quarantine` failures, if present, are expected and unrelated).

- [ ] **Step 3: Full electron suite**

Run: `cd electron && node --test *.test.cjs`
Expected: PASS, no regressions (this task touches no Electron code).

- [ ] **Step 4: Manual verification**

Using the dev frontend + dev backend combo, open a batch uninstall of at least two real (or fixture) programs, let it run to completion, and confirm: the batch lands on a "Scan for leftovers" screen naming how many uninstallers finished, no `scanForLeftovers` network call happens until that button is clicked (check the Network tab or backend logs), and clicking it proceeds through a scanning state into the same review screen as before. Confirm closing from that screen (without scanning) still marks the batch finished (program list refreshes).

- [ ] **Step 5: Report**

Summarize: the design decision made (one combined gate, not N; full rationale in the spec doc), the accepted freshness trade-off, files touched, and the final commit list (Task 1's and Task 2's commits, by subject line and short SHA).
