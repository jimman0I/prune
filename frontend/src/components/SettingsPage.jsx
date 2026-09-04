import { useEffect, useState } from 'react';
import { fetchSettings, updateSettings, runSandboxTest } from '../lib/api.js';

// electron/package.json is this app's real, single source of truth for
// name/version (checked 2026-09-01, rebranded from "unrevo" to "Prune":
// productName "Prune", version "1.0.1") -- hand-copied here rather than
// wired through Vite's build pipeline, matching this codebase's existing
// convention of small hand-curated constants over new plumbing for a
// value that changes on release cadence, not per-request.
const APP_NAME = 'Prune';
const APP_VERSION = '1.0.1';

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
        checked ? 'bg-[color:var(--accent-coral)]' : 'bg-white/10'
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

export default function SettingsPage() {
  const [tab, setTab] = useState('general');
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [newFolder, setNewFolder] = useState('');
  const [sandboxRunning, setSandboxRunning] = useState(false);
  const [sandboxReport, setSandboxReport] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchSettings()
      .then((result) => { if (!cancelled) setSettings(result); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  // Optimistic update: apply locally immediately, persist in the
  // background, and roll back to the pre-update settings if the save
  // actually fails -- so a toggle or folder edit never silently diverges
  // from what the backend has on disk.
  const save = async (partial) => {
    const previous = settings;
    setSettings((prev) => ({ ...prev, ...partial }));
    setSaveError(null);
    try {
      const result = await updateSettings(partial);
      setSettings(result);
    } catch (err) {
      setSettings(previous);
      setSaveError(err.message);
    }
  };

  const handleAddFolder = () => {
    const path = newFolder.trim();
    if (!path || settings.excludeFolders.includes(path)) return;
    save({ excludeFolders: [...settings.excludeFolders, path] });
    setNewFolder('');
  };

  const handleRemoveFolder = (path) => {
    save({ excludeFolders: settings.excludeFolders.filter((f) => f !== path) });
  };

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
      <div className="text-[11px] text-[color:var(--text-muted)] font-mono uppercase tracking-[0.16em] mb-2">Configuration</div>
      <h1 className="display-heading text-[30px] leading-none mb-6">Settings</h1>

      <div className="flex items-center gap-1.5 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-colors ${
              tab === t.id
                ? 'bg-[color:var(--accent-coral-soft)] text-[color:var(--accent-coral)]'
                : 'text-[color:var(--text-secondary)] hover:text-[color:var(--text-primary)] hover:bg-white/[0.04]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="glass-panel flex flex-col items-center justify-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[color:var(--accent-coral)]/10 border border-[color:var(--accent-coral)]/25 flex items-center justify-center mb-5">
            <div className="w-6 h-6 border-2 border-[color:var(--accent-coral)] border-t-transparent rounded-full animate-spin"></div>
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
                <div className="flex items-center justify-between gap-4 mb-4">
                  <div>
                    <div className="text-[14px] font-medium text-[color:var(--text-primary)]">Auto-Quarantine</div>
                    <p className="text-[12.5px] text-[color:var(--text-secondary)] mt-1">
                      Send removed files to Quarantine instead of deleting them outright.
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
                <div className="text-[14px] font-medium text-[color:var(--text-primary)] mb-1">Exclude Folders</div>
                <p className="text-[12.5px] text-[color:var(--text-secondary)] mb-4">
                  Folders Smart Cleanup and the leftover scanner will never touch.
                </p>

                <div className="flex items-center gap-2 mb-4">
                  <input
                    type="text"
                    value={newFolder}
                    onChange={(e) => setNewFolder(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddFolder(); }}
                    placeholder="C:\Path\To\Folder"
                    className="flex-1 min-w-0 font-mono text-[12.5px] px-3 py-2 rounded-lg bg-white/[0.04] border border-[color:var(--border-subtle)] text-[color:var(--text-primary)] placeholder:text-[color:var(--text-muted)] focus:outline-none focus:border-[color:var(--accent-coral)]/50"
                  />
                  <button className="btn-ghost px-3.5 py-2 rounded-lg text-[12px] font-medium shrink-0" onClick={handleAddFolder}>
                    Add
                  </button>
                </div>

                {settings.excludeFolders.length === 0 ? (
                  <p className="text-[12.5px] text-[color:var(--text-muted)]">No excluded folders.</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {settings.excludeFolders.map((path) => (
                      <div key={path} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.03]">
                        <div className="font-mono text-[12px] text-[color:var(--text-secondary)] truncate min-w-0">{path}</div>
                        <button
                          aria-label={`Remove ${path}`}
                          onClick={() => handleRemoveFolder(path)}
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
