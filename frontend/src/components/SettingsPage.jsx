import { useState, memo } from 'react';
import { runSandboxTest } from '../lib/api.js';
import { classifyExclusion } from '../lib/exclusionInput.js';
import { positiveOrOff } from '../lib/limitInput.js';
import AutomationSettings from './AutomationSettings.jsx';
import { useSettings } from '../hooks/useSystemQueries.js';

// electron/package.json is this app's real, single source of truth for
// name/version (checked 2026-09-06 for the 2.1.2 release: productName
// "Prune", version "2.1.2") -- hand-copied here rather than wired through
// Vite's build pipeline, matching this codebase's existing convention of
// small hand-curated constants over new plumbing for a value that changes
// on release cadence, not per-request.
//
// The cost of that convention is that this has to be bumped by hand with
// the three package.json files and their lockfiles, and nothing fails if
// it is not -- the About panel simply reports the previous release. It
// was already a release behind once.
const APP_NAME = 'Prune';
const APP_VERSION = '2.1.2';

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'cleanup', label: 'Cleanup' },
  { id: 'about', label: 'About' }
];

/** The same bespoke on/off switch DeepCleanTree.jsx uses, duplicated
 * rather than imported -- this codebase keeps small controls local to the
 * component that draws them rather than in a shared UI module. */
function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative w-10 h-6 rounded-full transition-colors shrink-0 ${
        checked ? 'bg-[color:var(--accent-primary)]' : 'bg-white/10'
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function StepRow({ step }) {
  return (
    <div className="flex items-start gap-3 py-2">
      <div
        className={`w-4 h-4 rounded-full mt-0.5 shrink-0 flex items-center justify-center text-[9px] font-bold ${
          step.passed ? 'bg-[color:var(--success)]/20 text-[color:var(--success)]' : 'bg-[color:var(--danger)]/20 text-[color:var(--danger)]'
        }`}
      >
        {step.passed ? '✓' : '✕'}
      </div>
      <div className="min-w-0">
        <div className="text-[12.5px] text-[color:var(--text-primary)]">{step.name}</div>
        {step.detail && <div className="font-mono text-[11px] text-[color:var(--text-muted)] mt-0.5 break-all">{step.detail}</div>}
      </div>
    </div>
  );
}

function SettingsPage() {
  const [tab, setTab] = useState('general');
  const [saveError, setSaveError] = useState(null);
  const [newExclusion, setNewExclusion] = useState('');
  const [exclusionError, setExclusionError] = useState(null);
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxReport, setSandboxReport] = useState(null);

  const { settings, loading, save: saveMutation } = useSettings();
  const error = null;

  /** Optimistic, and it rolls back on a real failure.
   *
   * A toggle that waits for a disk write before moving feels broken, and
   * one that moves and never checks can silently diverge from what is
   * actually persisted. onMutate writes the change into the cache and
   * hands back the previous settings; onError puts them straight back.
   *
   * The mutation is not retried -- see queryClient.js. Re-sending a
   * settings write because the reply was slow is how a preference flips
   * back after the user has already changed it again. */
  const save = (partial) => {
    setSaveError(null);
    saveMutation.mutate(partial, {
      onError: (err) => setSaveError(err.message)
    });
  };

  /** One field, two stores.
   *
   * "Add an exclusion" is one idea to a person, but a folder is matched
   * as a path prefix and an extension as a filename suffix, so they are
   * kept apart on disk. classifyExclusion decides once, here, where the
   * user's intent is clearest -- rather than every file of every scan
   * having to guess whether "C:
ode.js" is a folder or a file type.
   *
   * A bare word is refused with a message rather than guessed at, and the
   * message says the format. Guessing has two silent failure modes:
   * "temp" as a folder excludes nothing, and as an extension excludes
   * every .temp file on the machine. */
  const handleAddExclusion = () => {
    const parsed = classifyExclusion(newExclusion);
    if (!parsed) {
      setExclusionError(
        newExclusion.trim()
          ? 'Write a full folder path (D:\Games) or a file type (*.iso).'
          : null
      );
      return;
    }

    setExclusionError(null);
    const key = parsed.kind === 'extension' ? 'excludeExtensions' : 'excludeFolders';
    const current = settings[key] ?? [];
    if (current.includes(parsed.value)) { setNewExclusion(''); return; }

    save({ [key]: [...current, parsed.value] });
    setNewExclusion('');
  };

  const handleRemoveExclusion = (kind, value) => {
    const key = kind === 'extension' ? 'excludeExtensions' : 'excludeFolders';
    save({ [key]: (settings[key] ?? []).filter((v) => v !== value) });
  };

  // One list for the screen, each row remembering which store it came
  // from so removing it puts the change back in the right place.
  const exclusions = [
    ...(settings?.excludeFolders ?? []).map((value) => ({ kind: 'folder', value })),
    ...(settings?.excludeExtensions ?? []).map((value) => ({ kind: 'extension', value }))
  ];

  const handleRunSandboxTest = async () => {
    setSandboxRunning(true);
    setSandboxReport(null);
    try {
      const report = await runSandboxTest();
      setSandboxReport(report);
    } catch (err) {
      setSandboxReport({ passed: false, steps: [], error: err.message });
    } finally {
      setSandboxRunning(false);
    }
  };

  return (
    <div className="px-12 py-10 max-w-[1400px]">
      <h1 className="display-heading text-[30px] leading-none mb-6">Settings</h1>

      <div className="flex items-center gap-1.5 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-[color:var(--accent-primary-soft)] text-[color:var(--accent-primary)]'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="glass-panel flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-primary)]/10 border border-[color:var(--accent-primary)]/25 flex items-center justify-center mb-5">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-primary)] border-t-transparent rounded-full animate-spin"></div>
          </div>
          <p className="text-[13px] text-[color:var(--text-secondary)]">Loading settings…</p>
        </div>
      )}

      {!loading && error && (
        <div className="glass-panel p-6">
          <p className="text-[13px] text-[color:var(--danger)]">Couldn't load settings: {error}</p>
        </div>
      )}

      {!loading && !error && settings && (
        <>
          {saveError && (
            <div className="mb-5 px-3.5 py-3 rounded-xl bg-[color:var(--danger-soft)] border border-[color:var(--danger)]/25">
              <p className="text-[12.5px] text-[color:var(--danger)]">Couldn't save: {saveError}</p>
            </div>
          )}

          {tab === 'general' && (
            <div className="flex flex-col gap-4">
              <div className="glass-panel p-6">
                <h2 className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">Appearance</h2>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] leading-relaxed">
                  Prune currently ships one fixed theme, Aurora Deck (dark). There's no light-mode
                  stylesheet yet, so a theme toggle here would flip a setting that has nothing to switch to.
                  This tab will grow a real toggle once a second theme exists.
                </p>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">Minimize to Tray</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Closing the window sends Prune to the system tray instead of quitting.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.minimizeToTray}
                    onChange={() => save({ minimizeToTray: !settings.minimizeToTray })}
                    label="Minimize to Tray"
                  />
                </div>
              </div>
            </div>
          )}

          {tab === 'cleanup' && (
            <div className="flex flex-col gap-4">
              <div className="glass-panel p-6">
                <AutomationSettings settings={settings} save={save} />
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">Auto-Quarantine</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Deep Clean moves what it takes into Prune's Quarantine, where you can put it
                      back. Turn this off and it goes to the Windows Recycle Bin instead — still
                      recoverable, just somewhere you already know how to empty.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.autoQuarantine}
                    onChange={() => save({ autoQuarantine: !settings.autoQuarantine })}
                    label="Auto-Quarantine"
                  />
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">Leave recent files alone</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Skip anything modified in the last few hours. In a temp folder a file being
                      written right now looks exactly like one abandoned two years ago — this is what
                      stops a half-finished install being swept up. 0 turns it off.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="720"
                      value={settings.skipRecentHours}
                      onChange={(e) => save({ skipRecentHours: Math.max(0, Number(e.target.value) || 0) })}
                      aria-label="Hours to leave recent files alone"
                      className="w-[72px] font-mono text-[12.5px] px-2.5 py-2 rounded-lg bg-white/[0.04] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                    <span className="text-[12.5px] text-[color:var(--text-muted)]">hours</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">Create a restore point first</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Before a forced removal, so Windows itself can roll the machine back. Costs a
                      few seconds, and does nothing at all if System Protection is turned off.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.createRestorePoint}
                    onChange={() => save({ createRestorePoint: !settings.createRestorePoint })}
                    label="Create a restore point first"
                  />
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">Hide cleaners that don't apply</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Most of the list is for software this machine doesn't have. Hiding those leaves
                      only what is actually here.
                    </p>
                  </div>
                  <Toggle
                    checked={settings.hideUnavailableRules}
                    onChange={() => save({ hideUnavailableRules: !settings.hideUnavailableRules })}
                    label="Hide cleaners that don't apply"
                  />
                </div>
              </div>

              {/* The two limits on the quarantine. Both empty by default,
                  and both read "blank means keep everything" -- the same
                  rule the backend applies to every ambiguous value, for
                  the same reason: a limit that fails to run wastes disk,
                  and one that runs when it should not destroys the only
                  copy of something removed by accident. */}
              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">How long to keep undo</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Everything Prune removes goes to Quarantine first, and stays until you empty
                      it. Set a number of days to drop backups older than that. Leave it blank to
                      keep them forever.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      max="3650"
                      value={settings.quarantineRetentionDays ?? ''}
                      placeholder="Never"
                      onChange={(e) => save({ quarantineRetentionDays: positiveOrOff(e.target.value) })}
                      aria-label="Days to keep quarantine backups"
                      className="w-[88px] font-mono text-[12.5px] px-2.5 py-2 rounded-lg bg-white/[0.04] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                    <span className="text-[12.5px] text-[color:var(--text-muted)]">days</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">How much undo to keep</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      A cap on the whole Quarantine folder. Over it, the oldest backups go first —
                      the most recent one is never dropped, so something big you just removed stays
                      recoverable even if it is larger than the cap on its own. Leave it blank for
                      no limit.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={settings.quarantineMaxSizeGb ?? ''}
                      placeholder="No limit"
                      onChange={(e) => save({ quarantineMaxSizeGb: positiveOrOff(e.target.value) })}
                      aria-label="Maximum quarantine size in gigabytes"
                      className="w-[88px] font-mono text-[12.5px] px-2.5 py-2 rounded-lg bg-white/[0.04] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    />
                    <span className="text-[12.5px] text-[color:var(--text-muted)]">GB</span>
                  </div>
                </div>
              </div>

              <div className="glass-panel p-6">
                <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">Exclude Folders</div>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4">
                  Folders and file types Prune will leave alone — skipped by Deep Clean and left
                  out of the Disk Map — on top of the ones it already protects: System Volume
                  Information, antivirus quarantines, the component store and a dozen others.
                </p>

                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="text"
                    value={newExclusion}
                    onChange={(e) => { setNewExclusion(e.target.value); setExclusionError(null); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddExclusion(); }}
                    placeholder="D:\Games   or   *.iso"
                    aria-label="Folder path or file type to exclude"
                    aria-invalid={Boolean(exclusionError)}
                    className="flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-white/[0.04] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-primary)]/50"
                  />
                  <button className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium shrink-0" onClick={handleAddExclusion}>
                    Add
                  </button>
                </div>

                {/* Says the format rather than just refusing. A bare word
                    is genuinely ambiguous and the user is the only one who
                    can resolve it. */}
                <p className={`text-[11.5px] mb-4 ${exclusionError ? 'text-[color:var(--danger)]' : 'text-[color:var(--text-muted)]'}`}>
                  {exclusionError || 'A full folder path, or a file type written as *.iso'}
                </p>

                {exclusions.length === 0 ? (
                  <p className="text-[12.5px] text-[color:var(--text-muted)]">Nothing excluded.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {exclusions.map(({ kind, value }) => (
                      <div key={`${kind}:${value}`} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.03]">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Which kind, at a glance. The two behave
                              differently and the row should not need to be
                              parsed to tell them apart. */}
                          <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-px rounded border shrink-0 border-[color:var(--border-subtle)] text-[color:var(--text-muted)]">
                            {kind === 'extension' ? 'Type' : 'Folder'}
                          </span>
                          <span className="font-mono text-[12px] text-[color:var(--text-secondary)] truncate min-w-0">{value}</span>
                        </div>
                        <button
                          aria-label={`Stop excluding ${value}`}
                          onClick={() => handleRemoveExclusion(kind, value)}
                          className="text-[color:var(--text-muted)] hover:text-[color:var(--danger)] transition-colors shrink-0 text-[13px] leading-none px-1"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="glass-panel p-6">
                <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">Sandbox Test</div>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4">
                  Runs the real cleanup engine against a throwaway temp directory only — never
                  your actual Temp, Windows Temp, or thumbnail cache — to prove scanning and
                  deletion genuinely work before you trust them on real files.
                </p>
                <button
                  className="btn-primary px-5 py-2.5 text-[13px] font-medium disabled:opacity-50"
                  onClick={handleRunSandboxTest}
                  disabled={sandboxRunning}
                >
                  {sandboxRunning ? 'Running…' : 'Run Sandbox Test'}
                </button>

                {sandboxReport && (
                  <div className="mt-5 pt-4 border-t border-[color:var(--border-subtle)]">
                    <div
                      className={`text-[13px] font-medium mb-2 ${
                        sandboxReport.passed ? 'text-[color:var(--success)]' : 'text-[color:var(--danger)]'
                      }`}
                    >
                      {sandboxReport.passed ? 'All checks passed' : 'Sandbox test failed'}
                    </div>
                    {sandboxReport.steps.map((step, i) => (
                      <StepRow key={i} step={step} />
                    ))}
                    {sandboxReport.error && (
                      <p className="text-[12px] text-[color:var(--danger)] mt-2 font-mono break-all">{sandboxReport.error}</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'about' && (
            <div className="glass-panel p-6">
              <h2 className="display-heading text-[20px] mb-1">{APP_NAME}</h2>
              <p className="text-[12.5px] text-[color:var(--text-muted)] font-mono mb-4">v{APP_VERSION}</p>
              <p className="text-[13px] text-[color:var(--text-secondary)] leading-relaxed max-w-[52ch]">
                A local, offline uninstaller and cleanup tool for Windows — forced removal with
                leftover-file scanning, safe quarantine-before-delete, disk mapping, and
                one-click junk cleanup.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Memoised because App owns the active-screen state.
 *
 * Screens stay mounted once visited (see Screen.jsx), so every setScreen
 * re-renders App and React then reconciles every screen that has ever
 * been opened -- hidden ones skip layout and paint, not render. Measured
 * before this was added: a hidden Disk Map rendered twice across two tab
 * switches, once per switch, and that cost grows with every tab the user
 * has visited.
 *
 * Safe here specifically because this component takes no props at all, so
 * the comparison is between two empty objects and can never produce a
 * stale screen. A component with unstable props would gain nothing from
 * this and is deliberately left alone. */
export default memo(SettingsPage);
